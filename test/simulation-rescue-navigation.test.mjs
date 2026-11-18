import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { Engine } from "../engine.mjs";
import { createProjection, reduceProjection } from "../public/projection.mjs";
import {
  findPath,
  clipMove,
  stepToward,
  waypointReached,
} from "../public/world.mjs";
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
function fixture() {
  let now = 100000,
    seq = 0,
    version = 0,
    frameTime = 0;
  const engine = new Engine({ now: () => now });
  engine.addPlayer("p", "Player");
  engine.dispatch("p", {
    type: "setup",
    requestId: "setup",
    character: 0,
    palette: 0,
    insects: false,
  });
  const host = (type) =>
    engine.host("operator", {
      type,
      playerId: "p",
      requestId: `h-${++seq}`,
      reason: "Isolated route recovery",
    });
  host("lobby");
  host("start");
  now = engine.state.deadline;
  engine.tick();
  const arrivals = [],
    messages = [],
    context = vm.createContext({
      state: null,
      projection: createProjection(),
      reduceProjection,
      clipMove,
      findPath,
      stepToward,
      waypointReached,
      target: null,
      modal: { open: false },
      panel: "",
      currentPhase: "chapter",
      currentChapter: 0,
      isMoveDayFocused: () => false,
    // This fixture exercises the retained overview; focused filter behavior has its own adapter.
    isFilterFocused: () => false,
    isFilterAvailable: () => false,
      isPresentation: false,
      forceSafe: true,
      safe: true,
      prefs: {},
      keys: {},
      defaultKeys: {},
      normalizedSettings: (s) => s,
      connected: true,
      activeCanvas: { isConnected: true },
      activeCtx: {},
      lastMove: 0,
      serverOffset: 0,
      $: () => null,
      toast: (m) => messages.push(m),
      updateControlHints() {},
      updateConnection() {},
      refreshNeighborEmotes() {},
      measureFrame() {},
      drawMap() {},
      requestAnimationFrame() {},
      showActivity: (kind) => arrivals.push(kind),
      act(type, fields) {
        assert.equal(type, "move");
        engine.dispatch("p", { type, requestId: `m-${++seq}`, ...fields });
        context.accept(
          {
            projectionEpoch: "rescue-fixture",
            projectionVersion: ++version,
            position: engine.get("p").position,
          },
          "move",
        );
        return Promise.resolve({ ok: true });
      },
    });
  vm.runInContext(section("function accept(", "function game()"), context);
  vm.runInContext(section("function frame(", "function rect("), context);
  const send = () =>
    context.accept(
      {
        ...engine.view("p"),
        projectionEpoch: "rescue-fixture",
        projectionVersion: ++version,
      },
      "full",
      true,
    );
  send();
  const tick = () => {
    now += 200;
    frameTime += 200;
    context.frame(frameTime);
  };
  const finish = () => {
    let count = 0;
    while (context.target && count++ < 500) tick();
    assert.equal(context.target, null, "Route must finish rather than stall");
  };
  return { engine, context, host, send, tick, finish, arrivals, messages };
}

test("actual Rescue snapshot replans a blocked final waypoint and the real client frame reaches its original destination", () => {
  const f = fixture();
  const near = { x: 180, y: 160 };
  f.context.target = {
    ...near,
    path: findPath(f.context.state.me.position, near),
  };
  f.finish();
  assert.deepEqual(f.engine.get("p").position, near);
  const goal = { x: 160, y: 160 };
  f.context.target = {
    ...goal,
    path: findPath(near, goal),
    arrival: "activity",
  };
  const progress = structuredClone(f.engine.get("p").progress);
  let stale = { x: 600, y: 380 };
  for (let i = 0; i < 100; i++)
    stale = clipMove(stale, stepToward(stale, goal, 190, 0.1));
  assert.deepEqual(
    stale,
    { x: 368, y: 264 },
    "The pre-fix route deterministically stalls at this obstacle",
  );
  f.host("rescue");
  f.send();
  assert.equal(f.context.target.arrival, "activity");
  assert.deepEqual({ x: f.context.target.x, y: f.context.target.y }, goal);
  assert.equal(f.context.target.path.length, 2);
  assert.deepEqual(f.context.target.path[0], { x: 270, y: 210 });
  f.finish();
  assert.deepEqual(f.engine.get("p").position, goal);
  assert.deepEqual(f.arrivals, ["activity"]);
  assert.deepEqual(f.engine.get("p").progress, progress);
});

test("ordinary visible movement and peer-only snapshots keep the existing path object and arrival intent", () => {
  const f = fixture(),
    goal = { x: 700, y: 380 };
  f.context.target = {
    ...goal,
    path: findPath(f.context.state.me.position, goal),
    arrival: "activity",
  };
  const target = f.context.target,
    path = target.path;
  f.tick();
  assert.equal(f.context.target, target);
  assert.equal(f.context.target.path, path);
  f.engine.addPlayer("peer", "Peer");
  f.send();
  assert.equal(f.context.target, target);
  assert.equal(f.context.target.path, path);
  f.finish();
  assert.deepEqual(f.arrivals, ["activity"]);
});

test("an unreachable old destination cancels with recovery guidance, while pause still clears movement", () => {
  const f = fixture();
  f.context.target = {
    x: 160,
    y: 100,
    path: [{ x: 160, y: 100 }],
    arrival: "activity",
  };
  f.send();
  assert.equal(f.context.target, null);
  assert.match(f.messages.at(-1), /position changed.*destination/i);
  f.context.target = {
    x: 700,
    y: 380,
    path: [{ x: 700, y: 380 }],
    arrival: "activity",
  };
  f.host("pause");
  f.send();
  assert.equal(f.context.target, null);
  const before = { ...f.engine.get("p").position };
  f.tick();
  assert.deepEqual(f.engine.get("p").position, before);
  assert.deepEqual(f.arrivals, []);
});
