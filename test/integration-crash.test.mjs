import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../server.mjs";
import { findPath } from "../public/world.mjs";

async function launch(dbPath) {
  const child = fork(
    new URL("./integration-server-fixture.mjs", import.meta.url),
    [],
    {
      execPath: process.execPath,
      env: { ...process.env, TEST_DB: dbPath },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    },
  );
  let stderr = "";
  child.stderr.on("data", (b) => (stderr += b));
  const ready = await Promise.race([
    once(child, "message").then(([m]) => m),
    once(child, "exit").then(([code]) => {
      throw Error(`Child exited ${code}: ${stderr}`);
    }),
  ]);
  const base = `http://127.0.0.1:${ready.port}`;
  let seq = 0;
  const request = async (path, body, cookie, client) => {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(client ? { "x-trail-client": client } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = await r.json();
    return { r, value, cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const advance = (ms) =>
    new Promise((resolve) => {
      const id = ++seq;
      const listener = (m) => {
        if (m.type === "advanced" && m.id === id) {
          child.off("message", listener);
          resolve();
        }
      };
      child.on("message", listener);
      child.send({ type: "advance", ms, id });
    });
  return { child, base, request, advance };
}

test("SIGKILL preserves confirmed task/inventory and restart cancels pending trade after verified stale-lock recovery", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trail-kill-")),
    dbPath = join(dir, "event.sqlite");
  let app;
  const controllers = [];
  let actionSeq = 0;
  const kill = async () => {
    if (app?.child.exitCode === null && app.child.signalCode === null) {
      const exited = once(app.child, "exit");
      app.child.kill("SIGKILL");
      await exited;
    }
  };
  try {
    app = await launch(dbPath);
    const players = [];
    for (let i = 1; i <= 2; i++) {
      const joined = await app.request("/api/join", { token: `demo-${i}` });
      assert.equal(joined.r.status, 200);
      const p = { cookie: joined.cookie, client: `crash-${i}` };
      players.push(p);
      const controller = new AbortController();
      controllers.push(controller);
      const stream = await fetch(app.base + `/api/events?client=${p.client}`, {
        headers: { Cookie: p.cookie },
        signal: controller.signal,
      });
      await stream.body.getReader().read();
    }
    const act = async (p, body) => {
      const response = await app.request(
        "/api/action",
        { requestId: `crash-action-${++actionSeq}`, ...body },
        p.cookie,
        p.client,
      );
      assert.equal(response.r.status, 200, JSON.stringify(response.value));
      return response.value;
    };
    for (const p of players)
      await act(p, {
        type: "setup",
        character: 4,
        palette: 2,
        insects: false,
        settings: { reducedMotion: true },
      });
    const host = await app.request("/api/host/login", {
      token: "local-host-one",
    });
    for (const type of ["lobby", "start"]) {
      const response = await app.request(
        "/api/host/action",
        { type, reason: "Crash test", requestId: `crash-${type}` },
        host.cookie,
      );
      assert.equal(response.r.status, 200);
    }
    await app.advance(11000);
    const read = async (p) =>
      (await app.request("/api/state", undefined, p.cookie)).value;
    const p = players[0];
    for (let stage = 0; stage < 4; stage++) {
      let state = await read(p),
        target = state.chapter.task.target;
      const path = findPath(state.me.position, target);
      assert.ok(path, "Activity target must have a route");
      for (const waypoint of path) {
        let attempts = 0;
        while (
          Math.hypot(
            state.me.position.x - waypoint.x,
            state.me.position.y - waypoint.y,
          ) > 6
        ) {
          assert.ok(++attempts < 30, "Movement should reach waypoint");
          await app.advance(1000);
          await act(p, { type: "move", x: waypoint.x, y: waypoint.y });
          state = await read(p);
        }
      }
      await act(p, {
        type: "task",
        choice: 0,
        expectedChapter: 0,
        expectedStep: 0,
        expectedStage: state.chapter.task.stage,
      });
    }
    const offer = await act(p, {
      type: "tradeOffer",
      target: "neighbor-2",
      give: { item: "parts", qty: 1 },
      receive: { item: "food", qty: 1 },
      expectedChapter: 0,
    });
    await act(p, {
      type: "tradeConfirm",
      tradeId: offer.result.tradeId,
      expectedChapter: 0,
    });
    const before = await read(p);
    assert.equal(before.me.progress[0].step, 1);
    assert.ok(before.me.progress[0].score > 0);
    assert.equal(before.trades.length, 1);
    const processId = app.child.pid;
    await kill();
    controllers.forEach((c) => c.abort());
    assert.throws(() => createGameServer({ dbPath, demo: true }), /locked/i);
    const lock = JSON.parse(readFileSync(dbPath + ".lock", "utf8"));
    assert.equal(lock.pid, processId);
    assert.throws(() => process.kill(processId, 0), { code: "ESRCH" });
    unlinkSync(dbPath + ".lock");
    app = await launch(dbPath);
    const after = (await app.request("/api/state", undefined, p.cookie)).value;
    assert.equal(after.me.character, 4);
    assert.equal(after.me.insects, false);
    assert.deepEqual(after.me.inventory, before.me.inventory);
    assert.deepEqual(after.me.progress, before.me.progress);
    assert.equal(after.trades.length, 0);
  } finally {
    controllers.forEach((c) => c.abort());
    await kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("operator stream loss does not stop the authoritative countdown and chapter schedule", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trail-host-loss-")),
    dbPath = join(dir, "event.sqlite");
  const app = await launch(dbPath),
    controller = new AbortController();
  try {
    const host = await app.request("/api/host/login", {
      token: "local-host-one",
    });
    const stream = await fetch(app.base + "/api/events?client=host-loss", {
      headers: { Cookie: host.cookie },
      signal: controller.signal,
    });
    await stream.body.getReader().read();
    for (const type of ["lobby", "start"])
      assert.equal(
        (
          await app.request(
            "/api/host/action",
            {
              type,
              reason: "Host disconnect test",
              requestId: `host-loss-${type}`,
            },
            host.cookie,
          )
        ).r.status,
        200,
      );
    controller.abort();
    await app.advance(11000);
    await new Promise((r) => setTimeout(r, 300));
    let state = (await app.request("/api/host/state", undefined, host.cookie))
      .value;
    assert.equal(state.event.phase, "chapter");
    assert.equal(state.event.chapter, 0);
    await app.advance(290000);
    await new Promise((r) => setTimeout(r, 300));
    state = (await app.request("/api/host/state", undefined, host.cookie))
      .value;
    assert.equal(state.event.phase, "brag");
    assert.equal(state.event.chapter, 0);
  } finally {
    controller.abort();
    const exited = once(app.child, "exit");
    app.child.kill("SIGKILL");
    await exited;
    rmSync(dir, { recursive: true, force: true });
  }
});
