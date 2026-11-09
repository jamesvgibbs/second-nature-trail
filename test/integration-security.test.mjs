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
  const request = async (path, body, cookie, headers = {}) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
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
