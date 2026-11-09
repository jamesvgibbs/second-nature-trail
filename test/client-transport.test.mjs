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
    startAudio() {},
    soundEffect() {},
    toast() {},
    updateConnection() {},
    crypto: { randomUUID: () => String(Math.random()) },
  };
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
