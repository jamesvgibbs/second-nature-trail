import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RULES } from "../content.mjs";
const { createGameServer } = await import(
  process.env.TRAIL_SERVER_MODULE ||
    new URL("../server.mjs", import.meta.url).href
);

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "trail-boundary-"));
  const dbPath = join(directory, "event.sqlite");
  let scheduledTick;
  const interval = globalThis.setInterval;
  // Prevent an unrelated automatic tick from masking request-boundary bugs.
  // The production timer callback is still exercised explicitly below.
  globalThis.setInterval = (callback, delay, ...args) => {
    if (delay !== 250) return interval(callback, delay, ...args);
    scheduledTick = callback;
    return interval(() => {}, 3600000);
  };
  let app;
  try {
    app = createGameServer({ dbPath, demo: true });
  } finally {
    globalThis.setInterval = interval;
  }
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  let now = Date.now(),
    sequence = 0;
  const clock = () => now;
  app.engine.now = clock;
  const controllers = [];
  const request = async (path, body, cookie, client) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(client ? { "x-trail-client": client } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      value: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const players = [];
  for (let n = 0; n < 2; n++) {
    const joined = await request("/api/join", { token: `demo-${n + 1}` });
    assert.equal(joined.status, 200);
    const player = { cookie: joined.cookie, client: `boundary-${n}` };
    players.push(player);
    const controller = new AbortController();
    controllers.push(controller);
    const stream = await fetch(base + `/api/events?client=${player.client}`, {
      headers: { Cookie: player.cookie },
      signal: controller.signal,
    });
    await stream.body.getReader().read();
    const setup = await request(
      "/api/action",
      {
        type: "setup",
        settingsSequence: 1,
        requestId: `setup-${n}`,
        character: 0,
        palette: 0,
        insects: false,
      },
      player.cookie,
      player.client,
    );
    assert.equal(setup.status, 200);
  }
  const host = (await request("/api/host/login", { token: "local-host-one" }))
    .cookie;
  const hostAction = async (type, extra = {}) => {
    const result = await request(
      "/api/host/action",
      {
        type,
        reason: "Boundary durability fixture",
        requestId: `host-${++sequence}`,
        ...extra,
      },
      host,
    );
    assert.equal(result.status, 200, JSON.stringify(result.value));
  };
  await hostAction("lobby");
  await hostAction("start");
  now += RULES.countdownMs;
  await hostAction("broadcast", {
    message: "Explicit synthetic completed-objective fixture",
  });
  // Award eligibility is a fixture, not a claim of played chapter coverage.
  Object.assign(app.engine.get("neighbor-1").progress[0], {
    complete: true,
    step: 3,
    primary: 36,
    score: 60,
    timeMs: 1000,
  });
  await hostAction("broadcast", {
    message: "Persist synthetic award eligibility",
  });
  const offer = await request(
    "/api/action",
    {
      type: "tradeOffer",
      expectedChapter: 0,
      requestId: "pending-trade",
      target: "neighbor-2",
      give: { item: "parts", qty: 1 },
      receive: { item: "food", qty: 1 },
    },
    players[0].cookie,
    players[0].client,
  );
  assert.equal(offer.status, 200);
  const tradeId = offer.value.result.tradeId;
  const persisted = () =>
    JSON.parse(app.db.prepare("SELECT state FROM game WHERE id=1").get().state);
  assert.equal(persisted().trades[tradeId].status, "pending");
  const move = async (movementSequence = 1) =>
    request(
      "/api/action",
      {
        type: "move",
        movementSequence,
        requestId: `boundary-move-${movementSequence}`,
        x: 620,
        y: 380,
      },
      players[0].cookie,
      players[0].client,
    );
  return {
    app,
    clock,
    dbPath,
    tradeId,
    persisted,
    move,
    tick: () => scheduledTick(),
    setNow: (value) => (now = value),
    async close() {
      app.db.exec("DROP TRIGGER IF EXISTS fail_boundary");
      controllers.forEach((c) => c.abort());
      await app.close();
    },
    remove() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function assertBoundary(state, tradeId) {
  assert.equal(
    state.phase,
    "brag",
    "chapter boundary must be durable before rejected move returns",
  );
  assert.equal(state.awards.filter((a) => a.chapter === 0).length, 1);
  assert.equal(
    state.awards.find((a) => a.chapter === 0).playerId,
    "neighbor-1",
  );
  assert.equal(state.trades[tradeId].status, "cancelled");
}

test("HTTP rejected move commits due award and trade cancellation before restart", async () => {
  const f = await fixture();
  let closed = false;
  try {
    f.setNow(f.app.engine.state.deadline);
    const result = await f.move();
    assert.equal(result.status, 400);
    assert.match(result.value.error, /Movement is frozen/);
    assertBoundary(f.persisted(), f.tradeId);
    assert.equal(f.app.engine.now, f.clock);
    await f.close();
    closed = true;
    const restarted = createGameServer({ dbPath: f.dbPath, demo: true });
    try {
      assertBoundary(restarted.engine.state, f.tradeId);
    } finally {
      await restarted.close();
    }
  } finally {
    if (!closed) await f.close();
    f.remove();
  }
});

test("move uses one captured clock when time crosses deadline inside dispatch", async () => {
  const f = await fixture();
  try {
    const deadline = f.app.engine.state.deadline,
      dispatch = f.app.engine.dispatch.bind(f.app.engine);
    f.setNow(deadline - 1);
    f.app.engine.dispatch = (id, action) => {
      if (action.type === "move") f.setNow(deadline + 1);
      return dispatch(id, action);
    };
    const result = await f.move();
    assert.equal(
      result.status,
      200,
      "move admitted just before deadline uses that captured instant",
    );
    assert.equal(f.app.engine.state.phase, "chapter");
    assert.equal(f.app.engine.now, f.clock);
    f.tick();
    const state = f.persisted();
    assertBoundary(state, f.tradeId);
    assert.deepEqual(
      state.players["neighbor-1"].position,
      result.value.position,
    );
  } finally {
    await f.close();
    f.remove();
  }
});

test("failed boundary persistence rolls back award and restores clock and movement retry", async () => {
  const f = await fixture();
  try {
    const deadline = f.app.engine.state.deadline;
    f.app.db.exec(
      "CREATE TEMP TRIGGER fail_boundary BEFORE UPDATE ON game BEGIN SELECT RAISE(ABORT,'forced boundary persistence failure'); END",
    );
    f.setNow(deadline);
    const failed = await f.move();
    assert.equal(failed.status, 400);
    assert.match(failed.value.error, /forced boundary persistence failure/);
    assert.equal(f.app.engine.now, f.clock);
    for (const state of [f.app.engine.state, f.persisted()]) {
      assert.equal(state.phase, "chapter");
      assert.equal(state.awards.length, 0);
      assert.equal(state.trades[f.tradeId].status, "pending");
    }
    f.app.db.exec("DROP TRIGGER fail_boundary");
    f.setNow(deadline - 1);
    const retry = await f.move();
    assert.equal(retry.status, 200);
    assert.notEqual(retry.value.result.ignored, true);
    f.setNow(deadline);
    const due = await f.move(2);
    assert.equal(due.status, 400);
    assert.match(due.value.error, /Movement is frozen/);
    assertBoundary(f.persisted(), f.tradeId);
    assert.equal(f.app.engine.now, f.clock);
  } finally {
    await f.close();
    f.remove();
  }
});
