import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { Engine } from "../engine.mjs";
import { createProjection, reduceProjection } from "../public/projection.mjs";

for (const pausedPhase of ["countdown", "finale"])
  test(`End scoring cannot freeze or restart a paused ${pausedPhase}`, () => {
    let now = 100000,
      seq = 0;
    const engine = new Engine({ now: () => now });
    engine.addPlayer("p", "Participant");
    const host = (type) =>
      engine.host("operator", {
        type,
        requestId: `h-${++seq}`,
        reason: "Isolated recovery regression",
      });
    host("lobby");
    host("start");
    if (pausedPhase === "finale") {
      now = engine.state.deadline;
      engine.tick();
      host("endScoring");
    }
    host("pause");
    const before = JSON.stringify(engine.state);
    assert.throws(
      () => host("endScoring"),
      /Scoring has not started or is already frozen/,
    );
    assert.equal(
      JSON.stringify(engine.state),
      before,
      "Invalid recovery must not mutate deadline, awards or audit",
    );
  });

const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
function section(start, end) {
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  assert(a >= 0 && b > a);
  return source.slice(a, b);
}
function hostUI() {
  let time = 100000,
    sequence = 0,
    version = 0,
    operator = "primary";
  const engine = new Engine({ now: () => time });
  for (const id of ["p", "q"]) {
    engine.addPlayer(
      id,
      id === "p" ? "<Long & careful participant>" : "Second participant",
    );
    engine.dispatch(id, {
      type: "setup",
      character: 0,
      palette: 0,
      insects: false,
      requestId: `setup-${id}`,
    });
  }
  const ids = new Map(),
    messages = [],
    requests = [],
    pending = [];
  class Element {
    constructor(tag = "div") {
      this.tagName = tag;
      this.children = [];
      this.value = "";
      this.dataset = {};
    }
    append(...nodes) {
      for (const n of nodes) {
        this.children.push(n);
        n.parent = this;
        if (n.id) ids.set("#" + n.id, n);
      }
    }
    set innerHTML(html) {
      this.html = html;
      this.children = [];
      if (this === app) ids.clear();
      for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
        const n = new Element();
        n.id = match[1];
        n.value = match[0].match(/\bvalue="([^"]*)"/)?.[1] || "";
        ids.set("#" + n.id, n);
        this.append(n);
      }
    }
    get innerHTML() {
      return this.html || "";
    }
    querySelector(selector) {
      return this.children.find((n) => n.tagName === selector) || null;
    }
    remove() {
      if (this.parent)
        this.parent.children = this.parent.children.filter((n) => n !== this);
      ids.delete("#" + this.id);
    }
  }
  const app = new Element(),
    body = new Element(),
    modal = { open: false };
  const stamp = () => ({
    ...engine.hostView(),
    connections: ["p", "q"],
    projectionEpoch: "host-fixture",
    projectionVersion: ++version,
  });
  const initial = stamp();
  const context = vm.createContext({
    app,
    document: {
      createElement: (tag) => new Element(tag),
      getElementById: (id) => ids.get("#" + id),
    },
    hostState: initial,
    hostProjection: reduceProjection(createProjection(), initial, {
      allowEpoch: true,
    }),
    reduceProjection,
    hostConnected: true,
    hostGeneration: 1,
    crypto: { randomUUID: () => `host-ui-${++sequence}` },
    location: { href: "" },
    $: (id) => ids.get(id),
    topbar: () => "",
    toast: (message) => messages.push(message),
    btn: (textContent, onclick, className) => ({
      textContent,
      onclick,
      className,
    }),
    open(title, html) {
      modal.open = true;
      modal.title = title;
      body.innerHTML = html;
    },
    close() {
      modal.open = false;
    },
    updateHostLive() {},
    rulesHTML: () => "<p>Frozen rules fixture</p>",
    host() {},
    api(path, action) {
      assert.equal(path, "/api/host/action");
      requests.push(structuredClone(action));
      const p = Promise.resolve().then(() => {
        engine.host(operator, action);
        return { state: stamp() };
      });
      pending.push(p);
      return p;
    },
  });
  vm.runInContext(section("const esc =", "const btn ="), context);
  vm.runInContext(
    section("async function hostCommand(", 'window.addEventListener("resize"'),
    context,
  );
  context.hostDashboard();
  const button = (id, label) => {
    const b = ids.get(id)?.children.find((b) => b.textContent === label);
    assert(b, `Missing${id}:${label}`);
    return b;
  };
  const flush = async () => {
    await Promise.allSettled(pending);
    await new Promise((resolve) => setImmediate(resolve));
  };
  const run = async (
    label,
    { reason = "Developer recovery check", seconds } = {},
  ) => {
    button("#host-actions", label).onclick();
    ids.get("#host-reason").value = reason;
    if (seconds !== undefined) ids.get("#host-seconds").value = String(seconds);
    button("#host-confirm", `Confirm: ${label}`).onclick();
    await flush();
  };
  return {
    engine,
    context,
    ids,
    messages,
    requests,
    modal,
    app,
    body,
    run,
    button,
    flush,
    advance(ms) {
      time += ms;
      engine.tick();
    },
    operator(value) {
      operator = value;
    },
  };
}

test("actual host controls require confirmation and reason, cancel countdown, retain pause time and allow backup recovery", async () => {
  const f = hostUI();
  f.button("#host-actions", "Open lobby").onclick();
  assert.equal(f.engine.state.phase, "draft");
  await f.run("Open lobby", { reason: "   " });
  assert.equal(f.requests.length, 0);
  assert.equal(f.engine.state.phase, "draft");
  await f.run("Open lobby");
  await f.run("Start event");
  assert.equal(f.engine.state.phase, "countdown");
  await f.run("Cancel countdown");
  assert.equal(f.engine.state.phase, "lobby");
  assert.equal(f.engine.state.deadline, null);
  await f.run("Start event");
  await f.run("Advance to next phase");
  assert.equal(f.engine.state.phase, "chapter");
  await f.run("Pause");
  const remaining = f.engine.state.pause.remainingMs;
  f.advance(15000);
  assert.equal(f.engine.event().remainingMs, remaining);
  const before = f.requests.length;
  await f.run("Shorten current phase", { seconds: 0 });
  assert.equal(f.requests.length, before, "Invalid UI number must not submit");
  await f.run("Shorten current phase", { seconds: 30 });
  assert.equal(f.engine.state.pause.remainingMs, 30000);
  assert.equal(f.engine.state.phase, "paused");
  f.operator("backup");
  await f.run("Resume", { reason: "Primary disconnected; backup resumes" });
  assert.equal(f.engine.event().remainingMs, 30000);
  assert.equal(f.engine.state.controlOwner, "backup");
  assert.equal(f.engine.state.phase, "chapter");
  assert(
    f.engine.state.audit.some(
      (a) =>
        a.operatorId === "backup" &&
        a.reason === "Primary disconnected; backup resumes",
    ),
  );
});

test("actual rescue, skip, early ending, export and close preserve player progress and frozen results", async () => {
  const f = hostUI();
  await f.run("Open lobby");
  await f.run("Start event");
  await f.run("Advance to next phase");
  const p = f.engine.get("p");
  p.position = { x: 120, y: 180 };
  f.engine.dispatch("p", {
    type: "quiz",
    requestId: "recorded-learning",
    expectedChapter: 0,
    index: 0,
    choice: 0,
  });
  const progress = structuredClone(p.progress),
    items = structuredClone(p.items);
  const row = f.ids.get("#host-player-p");
  row.children.find((b) => b.textContent === "Rescue").onclick();
  await f.flush();
  assert.deepEqual(p.position, { x: 600, y: 380 });
  assert.deepEqual(p.progress, progress);
  assert.deepEqual(p.items, items);
  const offer = f.engine.dispatch("p", {
    type: "tradeOffer",
    expectedChapter: 0,
    requestId: "pending-barter",
    target: "q",
    give: { item: "parts", qty: 1 },
    receive: { item: "cable", qty: 1 },
  });
  await f.run("Pause");
  await f.run("Skip chapter", { reason: "Unranked recovery test" });
  assert.equal(f.engine.state.phase, "brag");
  assert.equal(f.engine.state.ranked[0], false);
  assert.equal(f.engine.state.trades[offer.tradeId].status, "cancelled");
  await f.run("Advance to next phase");
  assert.equal(f.engine.state.chapter, 1);
  assert.equal(f.engine.state.phase, "chapter");
  await f.run("End scoring");
  assert.equal(f.engine.state.phase, "finale");
  const frozen = structuredClone(f.engine.state.snapshot);
  f.button("#host-links", "Export results").onclick();
  assert.equal(f.context.location.href, "/api/host/export");
  const restored = new Engine({
    state: JSON.parse(JSON.stringify(f.engine.state)),
    now: f.engine.now,
  });
  assert.deepEqual(restored.exportResults().awards, frozen.awards);
  assert.deepEqual(restored.exportResults().players, frozen.players);
  await f.run("Close event");
  assert.equal(f.engine.state.phase, "closed");
  assert.deepEqual(f.engine.state.snapshot, frozen);
  assert(
    f.engine.exportResults().operationalAudit.some((a) => a.type === "close"),
  );
  assert.equal(
    f.engine.exportResults().players.find((p) => p.id === "p").metrics.correct,
    0,
    "Skipped chapter first-answer result excluded from award metric",
  );
});

test("operator reconnect blocks commands and rendered errors/broadcasts do not replace authority or escape HTML", async () => {
  const f = hostUI();
  f.context.hostConnected = false;
  await f.run("Open lobby");
  assert.equal(f.requests.length, 0);
  assert.match(f.messages.at(-1), /reconnecting/);
  f.context.hostConnected = true;
  await f.run("Close event");
  assert.equal(f.engine.state.phase, "draft");
  assert.match(f.messages.at(-1), /Finish scoring/);
  await f.run("Open lobby");
  f.ids.get("#broadcast").value = "<img src=x onerror=alert(1)>";
  f.ids.get("#broadcast-form").onsubmit({ preventDefault() {} });
  await f.flush();
  assert.equal(f.engine.state.broadcast, "<img src=x onerror=alert(1)>");
  await f.run("Start event", { reason: "<script>operator note</script>" });
  assert(!f.app.innerHTML.includes("<script>"));
  assert(f.app.innerHTML.includes("&lt;script&gt;"));
  assert(!f.app.innerHTML.includes("<Long & careful participant>"));
  const display = f.engine.presentation();
  assert.equal(display.safeVisuals, true);
  assert.equal(Object.hasOwn(display, "rules"), false);
  assert.equal(Object.hasOwn(display, "audit"), false);
  assert.equal(Object.hasOwn(display, "invitations"), false);
});

test("a replaced operator connection cannot publish an old request failure into the current view", async () => {
  const f = hostUI();
  let reject;
  f.context.api = () =>
    new Promise((resolve, fail) => {
      reject = fail;
    });
  const pending = f.context.hostCommand("broadcast", {
    message: "Earlier request",
  });
  f.context.hostGeneration++;
  reject(new Error("Obsolete operator request failed"));
  await pending;
  assert.deepEqual(f.messages, []);
});

test('End scoring remains available from legitimately paused chapter and break controls', async () => {
  for (const phase of ['chapter', 'brag']) {
    const f = hostUI();
    await f.run('Open lobby');
    await f.run('Start event');
    await f.run('Advance to next phase');
    if (phase === 'brag') await f.run('Advance to next phase');
    await f.run('Pause');
    assert.equal(f.engine.state.pause.phase, phase);
    await f.run('End scoring');
    assert.equal(f.engine.state.phase, 'finale');
    assert.equal(f.engine.state.pause, null);
    assert(f.engine.state.snapshot);
    assert.equal(f.engine.event().remainingMs, 240000);
  }
});
