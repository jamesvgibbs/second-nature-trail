import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../server.mjs";

async function start(options = {}) {
  const app = createGameServer({ dbPath: ":memory:", demo: true, ...options });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const settingsSequences = new Map();
  const request = async (path, body, cookie, headers = {}) => {
    if (body?.type === "setup" && body.settingsSequence === undefined) {
      const sequence = (settingsSequences.get(cookie) || 0) + 1;
      settingsSequences.set(cookie, sequence);
      body = { ...body, settingsSequence: sequence };
    }
    return fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  const login = async (path, token) => {
    const r = await request(path, { token });
    assert.equal(r.status, 200, await r.clone().text());
    return r.headers.get("set-cookie").split(";")[0];
  };
  return { ...app, base, request, login };
}

test("player invitations never grant operator privileges; presentation has no secrets", async () => {
  const app = await start();
  try {
    const player = await app.login("/api/join", "demo-1");
    for (const path of ["/api/host/state", "/api/host/export"])
      assert.equal((await app.request(path, undefined, player)).status, 401);
    assert.equal(
      (
        await app.request(
          "/api/host/action",
          { type: "start", requestId: "attack" },
          player,
        )
      ).status,
      401,
    );
    assert.equal(
      (await app.request("/api/host/login", { token: "demo-1" })).status,
      401,
    );
    assert.equal((await app.request("/api/state")).status, 401);
    const host = await app.login("/api/host/login", "local-host-one");
    assert.equal(
      (await app.request("/api/host/state", undefined, host)).status,
      200,
    );
    assert.equal(
      (
        await app.request(
          "/api/action",
          { type: "move", x: 20, y: 20, requestId: "host-play" },
          host,
        )
      ).status,
      401,
    );
    assert.equal((await app.request("/api/presentation")).status, 401);
    assert.equal((await app.request("/api/events?presentation=1")).status, 401);
    const audience = await app.login(
      "/api/presentation/login",
      "local-presentation",
    );
    assert.equal(
      (await app.request("/api/host/state", undefined, audience)).status,
      401,
    );
    assert.equal(
      (
        await app.request(
          "/api/host/action",
          { type: "start", requestId: "presentation-attack" },
          audience,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await app.request(
          "/api/action",
          { type: "move", requestId: "presentation-move" },
          audience,
        )
      ).status,
      401,
    );
    const presentation = await (
      await app.request("/api/presentation", undefined, audience)
    ).text();
    assert.ok(!presentation.includes("demo-1"));
    assert.ok(!presentation.includes("local-host"));
    assert.ok(!presentation.includes("answerKey"));
  } finally {
    await app.close();
  }
});

test("host session opens safe display without replacing host authentication", { timeout: 10000 }, async () => {
  const app = await start();
  const playerController = new AbortController();
  const displayController = new AbortController();
  const deadline = setTimeout(() => displayController.abort(), 5000);
  const assertAudience = (view) => {
    assert.equal(view.safeVisuals, true);
    for (const key of ["audit", "controlOwner", "connections", "me", "rules", "contentHash"])
      assert.equal(Object.hasOwn(view, key), false, `Audience must not receive ${key}`);
    for (const player of view.players)
      for (const key of ["setup", "ready", "tutorial", "connectionStatus", "inventory", "items", "progress", "settings", "insects"])
        assert.equal(Object.hasOwn(player, key), false, `Audience player must not expose ${key}`);
    const inspect = (value) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        assert.ok(!["answer", "answerKey", "questions", "task", "challenge", "secretHint", "clues"].includes(key), `Audience must not receive ${key}`);
        inspect(child);
      }
    };
    inspect(view);
  };
  try {
    const host = await app.login("/api/host/login", "local-host-one");
    // A separate player session makes the audience privacy assertions non-vacuous.
    const player = await app.login("/api/join", "demo-1");
    const playerStream = await fetch(app.base + "/api/events?client=audience-fixture", {
      headers: { Cookie: player }, signal: playerController.signal,
    });
    assert.equal(playerStream.status, 200);
    await playerStream.body.getReader().read();
    const setup = await app.request("/api/action", {
      type: "setup", requestId: "audience-fixture-setup", character: 0, palette: 0,
      insects: true, settings: {},
    }, player, { "x-trail-client": "audience-fixture" });
    assert.equal(setup.status, 200, await setup.clone().text());

    const display = await app.request("/api/presentation", undefined, host);
    assert.equal(display.status, 200);
    assert.equal(display.headers.get("set-cookie"), null);
    const initial = await display.json();
    assertAudience(initial);
    assert.ok(initial.players.some((p) => p.id === "neighbor-1"));

    const stream = await fetch(app.base + "/api/events?presentation=1", {
      headers: { Cookie: host }, signal: displayController.signal,
    });
    assert.equal(stream.status, 200);
    assert.equal(stream.headers.get("set-cookie"), null);
    const reader = stream.body.getReader(), decoder = new TextDecoder();
    let buffered = "";
    const nextState = async () => {
      for (;;) {
        const boundary = buffered.indexOf("\n\n");
        if (boundary >= 0) {
          const event = buffered.slice(0, boundary);
          buffered = buffered.slice(boundary + 2);
          if (!event.startsWith("event: state\n")) continue;
          return JSON.parse(event.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n"));
        }
        const chunk = await reader.read();
        assert.equal(chunk.done, false, "Display stream ended before its state update");
        buffered += decoder.decode(chunk.value, { stream: true });
      }
    };
    const opening = await nextState();
    assertAudience(opening);
    assert.equal(opening.event.phase, "draft");
    assert.ok(opening.players.some((p) => p.id === "neighbor-1"));

    assert.equal((await app.request("/api/host/state", undefined, host)).status, 200);
    const lobby = await app.request("/api/host/action", {
      type: "lobby", requestId: "host-with-display-lobby", reason: "Verify shared host/display session",
    }, host);
    assert.equal(lobby.status, 200, await lobby.clone().text());
    let updated;
    do { updated = await nextState(); assertAudience(updated); }
    while (updated.event.phase !== "lobby");
    const stillHost = await app.request("/api/host/state", undefined, host);
    assert.equal(stillHost.status, 200);
    const privateState = await stillHost.json();
    assert.equal(privateState.event.phase, "lobby");
    assert.ok(privateState.audit.length > 0);
    assert.ok(privateState.players.some((p) => Object.hasOwn(p, "connectionStatus")));
  } finally {
    clearTimeout(deadline);
    displayController.abort();
    playerController.abort();
    await app.close();
  }
});

test("explicit takeover revokes the old session and a player cannot act without its stream lease", async () => {
  const app = await start();
  const controllers = [];
  try {
    const cookie = await app.login("/api/join", "demo-1");
    assert.equal(
      (await app.request("/api/join", { token: "demo-1" })).status,
      409,
    );
    assert.equal(
      (
        await app.request(
          "/api/action",
          { type: "move", x: 20, y: 20, requestId: "no-stream" },
          cookie,
          { "x-trail-client": "first" },
        )
      ).status,
      409,
    );
    const controller = new AbortController();
    controllers.push(controller);
    const first = await fetch(app.base + "/api/events?client=first", {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    assert.equal(first.status, 200);
    await first.body.getReader().read();
    assert.equal(
      (
        await app.request(
          "/api/action",
          { type: "move", x: 20, y: 20, requestId: "wrong-client" },
          cookie,
          { "x-trail-client": "second" },
        )
      ).status,
      409,
    );
    assert.equal(
      (await app.request("/api/events?client=second", undefined, cookie))
        .status,
      409,
    );
    const takeover = await app.request("/api/join", {
      token: "demo-1",
      takeover: true,
    });
    assert.equal(takeover.status, 200);
    const next = takeover.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await app.request("/api/state", undefined, cookie)).status,
      401,
    );
    assert.equal(
      (await app.request("/api/state", undefined, next)).status,
      200,
    );
  } finally {
    for (const c of controllers) c.abort();
    await app.close();
  }
});

test("operators can distinguish unjoined, connected, and reconnecting participants", async () => {
  const app = await start();
  const controller = new AbortController();
  try {
    const host = await app.login("/api/host/login", "local-host-one");
    const status = async () =>
      (
        await (await app.request("/api/host/state", undefined, host)).json()
      ).players.find((p) => p.id === "neighbor-1");
    assert.equal((await status()).connectionStatus, "not-joined");
    const player = await app.login("/api/join", "demo-1");
    assert.equal((await status()).connectionStatus, "reconnecting");
    const stream = await fetch(app.base + "/api/events?client=status-test", {
      headers: { Cookie: player },
      signal: controller.signal,
    });
    const reader = stream.body.getReader();
    await reader.read();
    assert.equal((await status()).connectionStatus, "connected");
    controller.abort();
    let state;
    for (let i = 0; i < 40; i++) {
      state = await status();
      if (state.connectionStatus === "reconnecting") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(state.connectionStatus, "reconnecting");
    assert.equal(state.connected, false);
    const audience = await app.login(
      "/api/presentation/login",
      "local-presentation",
    );
    assert.ok(
      !(
        await (
          await app.request("/api/presentation", undefined, audience)
        ).text()
      ).includes("connectionStatus"),
    );
  } finally {
    controller.abort();
    await app.close();
  }
});

test("mutation endpoints reject cross-origin, non-JSON, and oversized requests", async () => {
  const app = await start();
  try {
    assert.equal(
      (
        await app.request("/api/join", { token: "demo-1" }, undefined, {
          Origin: "https://hostile.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(app.base + "/api/join", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "{}",
        })
      ).status,
      415,
    );
    assert.equal(
      (await app.request("/api/join", { token: "x".repeat(17000) })).status,
      413,
    );
    assert.equal(
      (
        await fetch(app.base + "/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        })
      ).status,
      400,
    );
  } finally {
    await app.close();
  }
});

test("invitation identity and committed state survive process reconstruction", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trail-integration-"));
  const dbPath = join(dir, "event.sqlite");
  let app;
  try {
    app = await start({ dbPath });
    const secret = app.addInvitation("stable-employee", "Stable Employee");
    const cookie = await app.login("/api/join", secret);
    const controller = new AbortController();
    const stream = await fetch(app.base + "/api/events?client=persist-client", {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    await stream.body.getReader().read();
    const accepted = await app.request(
      "/api/action",
      {
        type: "setup",
        requestId: "persist-setup",
        character: 7,
        palette: 2,
        insects: false,
        settings: { reducedMotion: true },
      },
      cookie,
      { "x-trail-client": "persist-client" },
    );
    assert.equal(accepted.status, 200);
    const rejected = await app.request(
      "/api/action",
      {
        type: "setup",
        requestId: "invalid-keys",
        character: 1,
        palette: 0,
        insects: true,
        settings: { keys: { up: "x", down: "x" } },
      },
      cookie,
      { "x-trail-client": "persist-client" },
    );
    assert.equal(rejected.status, 400);
    const before = await (
      await app.request("/api/state", undefined, cookie)
    ).json();
    assert.equal(before.me.setup, true);
    assert.equal(before.me.character, 7);
    assert.equal(before.me.insects, false);
    controller.abort();
    await app.close();
    app = await start({ dbPath });
    const after = await (
      await app.request("/api/state", undefined, cookie)
    ).json();
    assert.deepEqual(after.me, before.me);
    assert.notEqual(after.projectionEpoch, before.projectionEpoch);
    assert.ok(Number.isSafeInteger(after.projectionVersion));
    const joinResponse = await app.request("/api/join", {
      token: secret,
      takeover: true,
    });
    assert.equal(joinResponse.status, 200);
    assert.equal((await joinResponse.json()).playerId, "stable-employee");
  } finally {
    if (app) await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("database ownership prevents a second server and roster mutation freezes at event start", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trail-lock-"));
  const dbPath = join(dir, "event.sqlite");
  let app;
  try {
    app = await start({ dbPath });
    assert.throws(
      () => createGameServer({ dbPath, demo: true }),
      /in use|lock/i,
    );
    const host = await app.login("/api/host/login", "local-host-one");
    assert.equal(
      (
        await app.request(
          "/api/host/action",
          { type: "lobby", reason: "Test lobby", requestId: "lobby" },
          host,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await app.request(
          "/api/host/action",
          { type: "start", reason: "Test start", requestId: "start" },
          host,
        )
      ).status,
      200,
    );
    assert.throws(
      () => app.addInvitation("late-new-roster", "Unexpected employee"),
      /frozen/i,
    );
  } finally {
    if (app) await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mixed valid and invalid queued actions preserve independent outcomes across restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trail-batch-"));
  const dbPath = join(dir, "event.sqlite");
  let app;
  const controllers = [];
  try {
    app = await start({ dbPath });
    const clients = [];
    for (let n = 1; n <= 3; n++) {
      const cookie = await app.login("/api/join", `demo-${n}`),
        id = `batch-${n}`,
        controller = new AbortController();
      controllers.push(controller);
      const stream = await fetch(app.base + `/api/events?client=${id}`, {
        headers: { Cookie: cookie },
        signal: controller.signal,
      });
      await stream.body.getReader().read();
      clients.push({ cookie, id });
    }
    const actions = clients.map((c, i) =>
      app.request(
        "/api/action",
        {
          type: "setup",
          requestId: `mixed-${i}`,
          character: i + 3,
          palette: 2,
          insects: false,
          settings: i === 1 ? { keys: { up: "a", down: "a" } } : {},
        },
        c.cookie,
        { "x-trail-client": c.id },
      ),
    );
    const responses = await Promise.all(actions);
    assert.deepEqual(
      responses.map((r) => r.status),
      [200, 400, 200],
    );
    const read = async () =>
      Promise.all(
        clients.map(
          async (c) =>
            (
              await (
                await app.request("/api/state", undefined, c.cookie)
              ).json()
            ).me,
        ),
      );
    const before = await read();
    assert.deepEqual(
      before.map((p) => p.setup),
      [true, false, true],
    );
    assert.deepEqual(
      before.map((p) => p.character),
      [3, 0, 5],
    );
    controllers.forEach((c) => c.abort());
    await app.close();
    app = await start({ dbPath });
    const after = await read();
    assert.deepEqual(after, before);
  } finally {
    controllers.forEach((c) => c.abort());
    if (app) await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("batch persistence failure rejects accepted commands and restores state and retry keys", async () => {
  const app = await start();
  const controller = new AbortController();
  try {
    const cookie = await app.login("/api/join", "demo-1");
    const stream = await fetch(app.base + "/api/events?client=fail-write", {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    await stream.body.getReader().read();
    app.db.exec(
      "CREATE TRIGGER fail_write BEFORE UPDATE ON game BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END;",
    );
    const body = {
      type: "setup",
      requestId: "retry-after-write-failure",
      character: 6,
      palette: 2,
      insects: false,
      settings: {},
    };
    const failed = await app.request("/api/action", body, cookie, {
      "x-trail-client": "fail-write",
    });
    assert.equal(failed.status, 400);
    const rejectedState = await (
      await app.request("/api/state", undefined, cookie)
    ).json();
    assert.equal(rejectedState.me.setup, false);
    assert.equal(rejectedState.me.character, 0);
    app.db.exec("DROP TRIGGER fail_write;");
    assert.equal(
      (
        await app.request("/api/action", body, cookie, {
          "x-trail-client": "fail-write",
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await app.request("/api/state", undefined, cookie)).json()).me
        .character,
      6,
    );
  } finally {
    controller.abort();
    await app.close();
  }
});

test("production credentials separate two operators from the read-only display", async () => {
  const a = "operator-a-00000000000000000000000",
    b = "operator-b-00000000000000000000000",
    p = "display-00000000000000000000000000";
  for (const options of [
    { hostTokens: [a], presentationToken: p },
    { hostTokens: [a, a], presentationToken: p },
    { hostTokens: [a, b], presentationToken: a },
  ])
    assert.throws(() =>
      createGameServer({ dbPath: ":memory:", demo: false, ...options }),
    );
  const app = createGameServer({
    dbPath: ":memory:",
    demo: false,
    hostTokens: [a, b],
    presentationToken: p,
  });
  await app.close();
});

test("projection order survives equal clocks and stale movement cannot reverse authority across reconnect", async () => {
  const app = await start();
  const controllers = [];
  let now = Date.now(),
    request = 0;
  app.engine.now = () => now;
  try {
    const host = await app.login("/api/host/login", "local-host-one");
    await app.request(
      "/api/host/action",
      {
        type: "lobby",
        requestId: "order-lobby",
        reason: "Projection ordering test",
      },
      host,
    );
    const cookie = await app.login("/api/join", "demo-1");
    const stream = async (client, takeover = false) => {
      const controller = new AbortController();
      controllers.push(controller);
      const response = await fetch(
        app.base +
          `/api/events?client=${client}${takeover ? "&takeover=1" : ""}`,
        { headers: { Cookie: cookie }, signal: controller.signal },
      );
      assert.equal(response.status, 200);
      const chunk = await response.body.getReader().read();
      const state = JSON.parse(
        new TextDecoder().decode(chunk.value).split("data: ")[1].split("\n")[0],
      );
      return { controller, state };
    };
    const post = async (action, client = "ordering") => {
      const response = await app.request(
        "/api/action",
        { requestId: `order-${++request}`, ...action },
        cookie,
        { "x-trail-client": client },
      );
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    const initial = await stream("ordering");
    const setup = await post({
      type: "setup",
      character: 0,
      palette: 0,
      insects: false,
    });
    const full = await (
      await app.request("/api/state", undefined, cookie)
    ).json();
    assert.equal(initial.state.serverTime, setup.patch.serverTime);
    assert.equal(full.serverTime, setup.patch.serverTime);
    assert.equal(initial.state.projectionEpoch, full.projectionEpoch);
    assert.ok(initial.state.projectionVersion < setup.patch.projectionVersion);
    assert.ok(setup.patch.projectionVersion < full.projectionVersion);
    const origin = full.me.position;
    now += 1000;
    const first = await post({
      type: "move",
      x: origin.x + 10,
      y: origin.y,
      movementSequence: 2,
    });
    assert.equal(first.position.x, origin.x + 10);
    assert.equal(first.projectionEpoch, full.projectionEpoch);
    assert.ok(first.projectionVersion > full.projectionVersion);
    now += 1000;
    const stale = await post({
      type: "move",
      x: origin.x,
      y: origin.y,
      movementSequence: 1,
    });
    assert.equal(stale.result.ignored, true);
    assert.deepEqual(stale.position, first.position);
    initial.controller.abort();
    await stream("ordering");
    const afterReconnect = await post({
      type: "move",
      x: origin.x,
      y: origin.y,
      movementSequence: 2,
    });
    assert.equal(afterReconnect.result.ignored, true);
    assert.deepEqual(afterReconnect.position, first.position);
    const newer = await post({
      type: "move",
      x: origin.x + 20,
      y: origin.y,
      movementSequence: 3,
    });
    assert.equal(newer.position.x, origin.x + 20);
    const malformed = await app.request(
      "/api/action",
      { type: "move", requestId: "no-move-sequence", x: origin.x, y: origin.y },
      cookie,
      { "x-trail-client": "ordering" },
    );
    assert.equal(malformed.status, 400);
    await stream("new-client", true);
    now += 1000;
    const newClient = await post(
      { type: "move", x: origin.x + 30, y: origin.y, movementSequence: 1 },
      "new-client",
    );
    assert.equal(newClient.position.x, origin.x + 30);
  } finally {
    for (const controller of controllers) controller.abort();
    await app.close();
  }
});

test("older insect-enabling inputs cannot overwrite replacement, and failed commits preserve settings retries", async () => {
  const directory = mkdtempSync(join(tmpdir(), "trail-settings-order-"));
  const dbPath = join(directory, "event.sqlite");
  let app = await start({ dbPath });
  const controllers = [];
  try {
    const cookie = await app.login("/api/join", "demo-1");
    const connect = async () => {
      const controller = new AbortController();
      controllers.push(controller);
      const stream = await fetch(app.base + "/api/events?client=preferences", {
        headers: { Cookie: cookie },
        signal: controller.signal,
      });
      await stream.body.getReader().read();
    };
    const save = (sequence, insects) =>
      app.request(
        "/api/action",
        {
          type: "setup",
          requestId: `settings-${sequence}`,
          settingsSequence: sequence,
          character: 0,
          palette: 0,
          insects,
        },
        cookie,
        { "x-trail-client": "preferences" },
      );
    await connect();
    assert.equal((await save(2, false)).status, 200);
    assert.equal((await (await save(1, true)).json()).result.ignored, true);
    assert.equal(app.engine.get("neighbor-1").insects, false);
    for (const controller of controllers) controller.abort();
    await app.close();
    app = await start({ dbPath });
    await connect();
    assert.equal((await (await save(1, true)).json()).result.ignored, true);
    assert.equal(app.engine.get("neighbor-1").insects, false);
    app.db.exec(
      "CREATE TRIGGER test_settings_failure BEFORE UPDATE ON game BEGIN SELECT RAISE(ABORT,'settings persistence failure'); END;",
    );
    assert.equal((await save(3, true)).status, 400);
    assert.equal(
      app.db
        .prepare("SELECT sequence FROM setup_cursors WHERE player=?")
        .get("neighbor-1").sequence,
      2,
    );
    assert.equal(app.engine.get("neighbor-1").insects, false);
    app.db.exec("DROP TRIGGER test_settings_failure");
    assert.equal((await save(3, true)).status, 200);
    assert.equal(app.engine.get("neighbor-1").insects, true);
    assert.equal((await save(4, false)).status, 200);
    assert.equal((await (await save(3, true)).json()).result.ignored, true);
    assert.equal(
      (await (await app.request("/api/state", undefined, cookie)).json()).me
        .insects,
      false,
    );
  } finally {
    for (const controller of controllers) controller.abort();
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("cross-role login preserves the original cookie, authority, and live player lease", { timeout: 10000 }, async () => {
  const roles = [
    { role: "player", path: "/api/join", token: "demo-1", state: "/api/state" },
    { role: "host", path: "/api/host/login", token: "local-host-one", state: "/api/host/state" },
    { role: "presentation", path: "/api/presentation/login", token: "local-presentation", state: "/api/presentation" },
  ];
  for (const original of roles) {
    const app = await start();
    const controller = new AbortController();
    try {
      const cookie = await app.login(original.path, original.token);
      if (original.role === "player") {
        const stream = await fetch(app.base + "/api/events?client=role-guard", {
          headers: { Cookie: cookie }, signal: controller.signal,
        });
        assert.equal(stream.status, 200);
        await stream.body.getReader().read();
      }
      for (const other of roles.filter((r) => r.role !== original.role)) {
        const denied = await app.request(other.path, { token: other.token }, cookie);
        assert.equal(denied.status, 409, `${original.role} -> ${other.role}`);
        assert.equal(denied.headers.get("set-cookie"), null);
        const failure = await denied.json();
        assert.match(failure.error, /separate browser or profile/);
        assert.equal(failure.code, "PROFILE_ROLE_CONFLICT");
        assert.equal((await app.request(original.state, undefined, cookie)).status, 200);
      }
      if (original.role === "player") {
        const setup = await app.request("/api/action", {
          type: "setup", requestId: "role-guard-setup", character: 0, palette: 0,
          insects: false, settings: {},
        }, cookie, { "x-trail-client": "role-guard" });
        assert.equal(setup.status, 200, await setup.clone().text());
        assert.equal((await app.request("/api/host/state", undefined, cookie)).status, 401);
      } else if (original.role === "host") {
        const lobby = await app.request("/api/host/action", {
          type: "lobby", requestId: "role-guard-lobby", reason: "Verify preserved operator session",
        }, cookie);
        assert.equal(lobby.status, 200);
        assert.equal((await app.request("/api/state", undefined, cookie)).status, 401);
      } else {
        assert.equal((await app.request("/api/host/state", undefined, cookie)).status, 401);
        assert.equal((await app.request("/api/state", undefined, cookie)).status, 401);
      }
      const relogin = await app.request(original.path, { token: original.token }, cookie);
      assert.equal(relogin.status, 200, `${original.role} same-role login must remain allowed`);
      const refreshedCookie = relogin.headers.get("set-cookie").split(";")[0];
      assert.equal((await app.request(original.state, undefined, refreshedCookie)).status, 200);
    } finally {
      controller.abort();
      await app.close();
    }
  }
});
