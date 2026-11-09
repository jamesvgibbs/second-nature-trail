import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createProjection, reduceProjection } from "../public/projection.mjs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const section = (a, b) =>
  source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const snapshot = (version, epoch = "a", phase = "chapter", chapter = 0) => ({
  projectionEpoch: epoch,
  projectionVersion: version,
  serverTime: 1000,
  event: { phase, chapter },
  me: { id: "self", position: { x: version, y: 0 }, progress: [{ step: 0 }] },
  players: [],
  chapter: { task: { stage: "inspect" } },
  trades: [],
});
function environment() {
  const c = {
    stream: null,
    streamGeneration: 0,
    connected: false,
    authorizationLost: false,
    client: "tab",
    isPresentation: false,
    forceSafe: true,
    persistCalls: 0,
    projection: createProjection(),
    state: null,
    sources: [],
    movementSequence: 0,
    settingsSequence: 0,
    requests: [],
    target: null,
    routePath: [],
    selection: null,
    presentedTarget: null,
    autoTargetEnabled: false,
    autoTargetRound: null,
    targetRequestPending: false,
    panel: "",
    open(title, html) { this.dialog = { title, html }; },
    btn(label, action) { return { label, action }; },
    location: { assign() {} },
    startAudio() {},
    soundEffect() {},
    toast() {},
    updateConnection() {},
    crypto: { randomUUID: () => String(Math.random()) },
  };
  const nodes = new Map();
  const node = () => ({ children: [], replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); } });
  c.$ = (id) => {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  };
  c.document = { createElement: node, createTextNode: (value) => value };
  c.open = (title, html) => { c.dialog = { title, html }; };
  c.persistReplacement = () => {
    c.persistCalls++;
  };
  c.accept = (value, kind = "full", allowEpoch = false) => {
    const next = reduceProjection(c.projection, value, { kind, allowEpoch });
    if (next === c.projection) return false;
    c.projection = next;
    c.state = next.state;
    return true;
  };
  c.takenOver = () => {
    c.streamGeneration++;
    c.connected = false;
  };
  c.api = async () => ({ otherClient: false });
  c.EventSource = class {
    constructor(url) {
      this.url = url;
      this.listeners = {};
      c.sources.push(this);
    }
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    }
    close() {
      this.closed = true;
    }
  };
  vm.createContext(c);
  vm.runInContext(
    section("function detachStream()", "function takenOver()"),
    c,
  );
  vm.runInContext(section("async function act(", "function applyPrefs()"), c);
  vm.runInContext(section("function updateConnection()", "function setup()"), c);
  return c;
}

test("SSE cannot enable actions or persist preference before its first accepted snapshot", async () => {
  const c = environment();
  c.accept(snapshot(1), "full", true);
  await c.connect();
  const stream = c.sources[0];
  stream.onopen();
  assert.equal(c.connected, false);
  assert.equal(c.persistCalls, 0);
  stream.listeners.state({ data: JSON.stringify(snapshot(2)) });
  assert.equal(c.connected, true);
  assert.equal(c.persistCalls, 1);
  stream.onerror();
  stream.onopen();
  assert.equal(c.connected, false);
  assert.equal(c.persistCalls, 1);
  stream.listeners.state({ data: JSON.stringify(snapshot(1, "restarted")) });
  assert.equal(c.connected, true);
  assert.equal(c.projection.epoch, "restarted");
  assert.equal(c.persistCalls, 2);
});

test("callbacks from replaced SSE cannot alter state, connection, or epoch", async () => {
  const c = environment();
  await c.connect();
  const old = c.sources[0];
  old.onopen();
  old.listeners.state({ data: JSON.stringify(snapshot(1)) });
  await c.connect();
  const current = c.sources[1];
  current.onopen();
  current.listeners.state({ data: JSON.stringify(snapshot(1, "new")) });
  const before = c.projection;
  old.onerror();
  old.onopen();
  old.listeners.takeover();
  old.listeners.state({ data: JSON.stringify(snapshot(900, "old")) });
  assert.equal(c.projection, before);
  assert.equal(c.connected, true);
  assert.equal(c.projection.epoch, "new");
});

test("a late lease probe cannot replace the newer requested stream", async () => {
  const c = environment(),
    probes = [];
  c.api = () => new Promise((resolve) => probes.push(resolve));
  const first = c.connect(),
    second = c.connect();
  probes[1]({ otherClient: false });
  await second;
  const current = c.stream;
  probes[0]({ otherClient: false });
  await first;
  assert.equal(c.sources.length, 1);
  assert.equal(c.stream, current);
});

test("action callbacks ignore changed chapter/phase but retain same-context SSE-confirmed commits", async () => {
  const c = environment();
  c.accept(snapshot(1), "full", true);
  c.connected = true;
  c.api = (_, data) =>
    new Promise((resolve) => c.requests.push({ data, resolve }));
  const first = c.act("task", { choice: 0 });
  c.accept(snapshot(3, "a", "brag"));
  c.requests[0].resolve({ result: { ok: true }, patch: snapshot(2) });
  assert.equal(await first, null);
  c.accept(snapshot(4, "a", "chapter", 1));
  const second = c.act("quiz", { index: 0, choice: 1 });
  c.accept(snapshot(6, "a", "chapter", 2));
  c.requests[1].resolve({
    result: { correct: true },
    patch: snapshot(5, "a", "chapter", 1),
  });
  assert.equal(await second, null);
  const third = c.act("quiz", { index: 0, choice: 1 });
  c.accept(snapshot(8, "a", "chapter", 2));
  const result = { correct: true, first: true };
  c.requests[2].resolve({ result, patch: snapshot(7, "a", "chapter", 2) });
  assert.equal(await third, result);
});

test("move inputs get increasing sequences and reversed HTTP replies preserve newest position", async () => {
  const c = environment();
  c.accept(snapshot(1), "full", true);
  c.connected = true;
  c.api = (_, data) =>
    new Promise((resolve) => c.requests.push({ data, resolve }));
  const first = c.act("move", { x: 2, y: 0 }),
    second = c.act("move", { x: 3, y: 0 });
  assert.equal(c.requests[0].data.movementSequence, 1);
  assert.equal(c.requests[1].data.movementSequence, 2);
  c.requests[1].resolve({
    projectionEpoch: "a",
    projectionVersion: 3,
    position: { x: 3, y: 0 },
    result: { ok: true },
  });
  await second;
  c.requests[0].resolve({
    projectionEpoch: "a",
    projectionVersion: 2,
    position: { x: 2, y: 0 },
    result: { ok: true },
  });
  await first;
  assert.equal(c.state.me.position.x, 3);
});

test("old-epoch HTTP completion cannot mutate or invoke success after SSE restart", async () => {
  const c = environment();
  c.accept(snapshot(1), "full", true);
  c.connected = true;
  c.api = (_, data) =>
    new Promise((resolve) => c.requests.push({ data, resolve }));
  const pending = c.act("task", { choice: 0 });
  c.accept(snapshot(1, "restarted"), "full", true);
  c.requests[0].resolve({ result: { ok: true }, patch: snapshot(500, "a") });
  assert.equal(await pending, null);
  assert.equal(c.projection.epoch, "restarted");
  assert.equal(c.projection.coreVersion, 1);
});

test("every setup gets an independent settings sequence retained across reconnects", async () => {
  const c = environment();
  c.accept(snapshot(1), "full", true);
  c.connected = true;
  c.api = async (_, data) => {
    c.requests.push(data);
    return data.type === "move"
      ? {
          projectionEpoch: "a",
          projectionVersion: 2,
          position: { x: 2, y: 0 },
          result: { ok: true },
        }
      : { patch: snapshot(c.requests.length + 2), result: { ok: true } };
  };
  await c.act("setup", { insects: true });
  await c.act("move", { x: 2, y: 0 });
  await c.act("setup", { insects: false });
  c.detachStream();
  c.connected = true;
  await c.act("setup", { insects: false });
  assert.deepEqual(
    c.requests.map((r) => [r.type, r.settingsSequence, r.movementSequence]),
    [
      ["setup", 1, undefined],
      ["move", undefined, 1],
      ["setup", 2, undefined],
      ["setup", 3, undefined],
    ],
  );
});


test("player action 401 stops gameplay and stale stream callbacks cannot restore CONNECTED", async () => {
  const c = environment();
  await c.connect();
  const stream = c.stream;
  stream.listeners.state({ data: JSON.stringify(snapshot(1)) });
  c.target = { x: 10, y: 10 };
  c.routePath = [{ x: 20, y: 20 }];
  c.selection = 1;
  c.presentedTarget = { round: 1 };
  c.autoTargetEnabled = true;
  c.autoTargetRound = "0:0:1";
  c.panel = "targeting";
  let calls = 0;
  c.api = async () => { calls++; throw Object.assign(Error("Wrong role"), { status: 401 }); };
  assert.equal(await c.act("task", { choice: 1 }), null);
  assert.equal(c.connected, false);
  assert.equal(c.authorizationLost, true);
  assert.equal(stream.closed, true);
  assert.equal(c.stream, null);
  assert.equal(c.target, null);
  assert.equal(c.routePath.length, 0);
  assert.equal(c.selection, null);
  assert.equal(c.presentedTarget, null);
  assert.equal(c.autoTargetEnabled, false);
  assert.equal(c.autoTargetRound, null);
  assert.equal(c.panel, "");
  assert.equal(c.dialog.title, "Player sign-in required");
  assert.match(c.dialog.html, /different browser or profile/);
  assert.ok(c.$("#connection").children.includes("SIGN-IN REQUIRED"));
  assert.equal(c.$("#connection").children.some((n) => n.label === "Resume here"), false);
  stream.onopen();
  stream.listeners.state({ data: JSON.stringify(snapshot(2)) });
  assert.equal(c.connected, false);
  assert.equal(await c.act("move", { x: 1, y: 1 }), null);
  assert.equal(await c.act("task", { choice: 1 }), null);
  assert.equal(calls, 1, "No later movement or scoring request may leave the signed-out tab");
});

test("unauthorized lease probe does not open a stream using a different role", async () => {
  const c = environment();
  c.api = async () => { throw Object.assign(Error("Wrong role"), { status: 401 }); };
  await c.connect();
  assert.equal(c.sources.length, 0);
  assert.equal(c.authorizationLost, true);
  assert.equal(c.connected, false);
});

test("late action 401 from a replaced connection does not sign out the current player", async () => {
  const c = environment();
  await c.connect();
  c.stream.listeners.state({ data: JSON.stringify(snapshot(1)) });
  let rejectOld;
  c.api = () => new Promise((_, reject) => { rejectOld = reject; });
  const pending = c.act("task", { choice: 0 });
  c.api = async () => ({ otherClient: false });
  await c.connect();
  c.stream.listeners.state({ data: JSON.stringify(snapshot(2)) });
  rejectOld(Object.assign(Error("Expired old request"), { status: 401 }));
  assert.equal(await pending, null);
  assert.equal(c.connected, true);
  assert.equal(c.authorizationLost, false);
});


test("cross-role join failure shows role guidance instead of invitation takeover", async () => {
  const c = environment();
  let shown;
  c.fetch = async () => ({
    ok: false, status: 409,
    json: async () => ({ error: "Use a separate browser or profile", code: "PROFILE_ROLE_CONFLICT" }),
  });
  c.landing = (message) => { shown = message; };
  vm.runInContext(section("async function api(", "async function act("), c);
  vm.runInContext(section("async function join(", "async function loadPlayer("), c);
  await c.join("demo-1");
  assert.equal(shown, "Use a separate browser or profile");
  assert.equal(c.dialog, undefined, "Cross-role conflict must not offer invitation takeover");
});


test("expired player authorization stops explicit takeover before opening SSE", async () => {
  const c = environment();
  await c.connect();
  const previous = c.stream;
  previous.listeners.state({ data: JSON.stringify(snapshot(1)) });
  c.api = async () => { throw Object.assign(Error("Expired session"), { status: 401 }); };
  await c.connect(true);
  assert.equal(previous.closed, true);
  assert.equal(c.sources.length, 1, "No takeover stream may open with an expired cookie");
  assert.equal(c.authorizationLost, true);
  assert.equal(c.connected, false);
  assert.ok(c.$("#connection").children.includes("SIGN-IN REQUIRED"));
  assert.equal(c.dialog.title, "Player sign-in required");
  previous.listeners.state({ data: JSON.stringify(snapshot(2)) });
  assert.equal(c.connected, false);
});

test("authorized explicit takeover probes authentication and permits another client lease", async () => {
  const c = environment();
  const paths = [];
  c.api = async (path) => { paths.push(path); return { otherClient: true }; };
  await c.connect(true);
  assert.equal(paths.length, 1);
  assert.equal(paths[0], "/api/lease?client=tab");
  assert.equal(c.sources.length, 1);
  assert.equal(c.stream.url, "/api/events?client=tab&takeover=1");
  assert.equal(c.connected, false, "Await the accepted current-stream snapshot");
  c.stream.listeners.state({ data: JSON.stringify(snapshot(1)) });
  assert.equal(c.connected, true);
  assert.equal(c.authorizationLost, false);
});
