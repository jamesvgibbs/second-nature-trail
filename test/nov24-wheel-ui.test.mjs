import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fixture as baseFixture } from "./client-simulation-fixture.mjs";
import { Engine, shortcutWheelIncident } from "../engine.mjs";
import {
  moveDaySceneModel,
  drawMoveDayScene,
  hitMoveDayHotspot,
  MOVE_DAY_GEOMETRY,
} from "../public/move-day-scene.mjs";
import { clipMove } from "../public/world.mjs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const section = (a, b) =>
  source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
function fixture(unlucky = true) {
  const f = baseFixture(0, (e) => {
      for (let i = 0; ; i++) {
        const seed = "nov24-ui-" + i;
        if (shortcutWheelIncident(seed, "neighbor", 0) === unlucky) {
          e.state.seed = seed;
          break;
        }
      }
    }),
    c = f.context;
  for (const id of ["#mission", "#phase-label", "#map-label"]) {
    f.ids.set(id, f.document.createElement("div"));
    f.persistent.add(id);
  }
  Object.assign(c, {
    moveDaySceneModel,
    hitMoveDayHotspot,
    clipMove,
    moveDayOverview: false,
    moveDayState: {
      epoch: null,
      key: "",
      selection: null,
      pending: false,
      token: 0,
      journal: [],
      focusedPeerId: null,
    },
    travelToastText: null,
    app: { querySelector: () => null },
    keyLabel: (key) => c.keys[key].toUpperCase(),
  });
  vm.runInContext(
    section("function renderMission(", "function nextChapterHTML("),
    c,
  );
  vm.runInContext(
    section("function worldKeys(", 'modal.addEventListener("keydown"'),
    c,
  );
  const near = () => {
    const t = c.state.chapter.task.target;
    f.engine.get("neighbor").position = { x: t.x, y: t.y };
    f.send();
  };
  const submit = async (choice = null) => {
    near();
    if (choice !== null) c.selectMoveDayChoice(choice);
    const p = c.moveDayPrimary();
    assert(f.requests.length);
    f.resolve();
    await p;
  };
  c.renderMission();
  return { ...f, near, submit };
}
async function reachCrossing(f) {
  await f.submit(0);
  await f.submit(1);
  assert.equal(f.context.state.chapter.task.stage, "travel");
  assert.equal(f.context.state.me.progress[0].delivery.incident, null);
  assert.doesNotMatch(
    f.ids.get("#mission").innerHTML,
    /A wheel came loose|Wheel reseated/,
  );
  await f.submit();
}
function marks(view) {
  const out = [];
  const ctx = new Proxy(
    {
      fillRect(x, y, w, h) {
        out.push({ x, y, w, h, color: this.fillStyle });
      },
      fillText(text, x, y) {
        out.push({ text, x, y });
      },
    },
    { get: (o, k) => o[k] || (() => {}) },
  );
  drawMoveDayScene(ctx, view);
  return out;
}

test("actual unlucky repair handler keeps cargo and score unchanged while pending, blocks double submit, then persists journal and permits normal delivery", async () => {
  const f = fixture(),
    c = f.context;
  await reachCrossing(f);
  assert.equal(c.state.chapter.task.stage, "repair");
  assert.match(f.ids.get("#mission").innerHTML, /A wheel came loose/);
  assert.equal(moveDaySceneModel(c.state).wheelSlipped, true);
  const broken = marks(c.state),
    before = structuredClone(c.state.me.inventory);
  f.near();
  const pending = f.ids.get("#move-day-primary").onclick();
  assert.equal(f.requests.at(-1).action.expectedStage, "repair");
  assert.equal(c.moveDayState.pending, true);
  const n = f.requests.length;
  await c.moveDayPrimary();
  assert.equal(f.requests.length, n);
  assert.equal(moveDaySceneModel(c.state).wheelSlipped, true);
  assert.equal(c.state.me.progress[0].score, 0);
  f.resolve();
  await pending;
  assert.equal(c.state.chapter.task.stage, "deliver");
  assert.equal(moveDaySceneModel(c.state).wheelSlipped, false);
  assert.equal(moveDaySceneModel(c.state).wheelRepaired, true);
  assert.deepEqual(c.state.me.inventory, before);
  assert.equal(c.state.me.progress[0].score, 0);
  assert.match(f.ids.get("#mission").innerHTML, /Wheel reseated/);
  assert.notDeepEqual(
    marks(c.state),
    broken,
    "Accepted repair changes actual canvas paint",
  );
  // Simulate page-local state loss; saved server journal remains the source.
  c.moveDayState.journal = [];
  f.send();
  assert.match(f.ids.get("#mission").innerHTML, /Wheel reseated/);
  await f.submit();
  assert.equal(c.state.me.progress[0].step, 1);
  assert.equal(c.state.me.progress[0].score, 10);
  assert.equal(c.state.me.progress[0].primary, 6);
  assert.match(f.ids.get("#mission").innerHTML, /Delivery complete/);
});

test("keyboard repair honors pause, rejected response, retry and phase change without premature wheel restoration or focus takeover", async () => {
  const f = fixture(),
    c = f.context;
  await reachCrossing(f);
  f.near();
  f.engine.host("host", {
    type: "pause",
    requestId: "pause",
    reason: "Fixture pause",
  });
  f.send();
  const n = f.requests.length;
  c.worldKeys({ key: c.keys.interact, preventDefault() {} });
  assert.equal(f.requests.length, n);
  assert.equal(moveDaySceneModel(c.state).wheelSlipped, true);
  f.engine.host("host", {
    type: "resume",
    requestId: "resume",
    reason: "Fixture resume",
  });
  f.send();
  f.canvas.focus();
  c.worldKeys({ key: c.keys.interact, preventDefault() {} });
  assert.equal(f.requests.length, n + 1);
  f.requests.at(-1).reject(Error("Connection interrupted"));
  await new Promise((r) => setImmediate(r));
  assert.equal(c.state.chapter.task.stage, "repair");
  assert.equal(c.moveDayState.pending, false);
  assert.equal(moveDaySceneModel(c.state).wheelSlipped, true);
  const retry = c.moveDayPrimary();
  f.engine.host("host", {
    type: "pause",
    requestId: "pause-again",
    reason: "Pause pending repair",
  });
  f.send();
  f.resolve();
  await retry;
  assert.equal(f.engine.get("neighbor").progress[0].delivery.stage, "repair");
  assert.equal(c.state.event.phase, "paused");
  assert.equal(c.moveDayState.pending, false);
});

test("normal shortcut and paved journeys do not invent a repair, and old in-progress deliveries restore without retroactive incidents or visits", async () => {
  const f = fixture(false);
  await reachCrossing(f);
  assert.equal(f.context.state.chapter.task.stage, "deliver");
  assert.equal(moveDaySceneModel(f.context.state).wheelSlipped, false);
  assert.doesNotMatch(
    f.ids.get("#mission").innerHTML,
    /A wheel came loose|Wheel reseated/,
  );
  await f.submit();
  assert.equal(f.context.state.me.progress[0].score, 10);
  const g = fixture(true);
  await g.submit(0);
  await g.submit(0);
  await g.submit();
  assert.equal(g.context.state.chapter.task.stage, "deliver");
  await g.submit();
  assert.equal(g.context.state.me.progress[0].score, 17);
  const old = structuredClone(g.engine.state),
    p = old.players.neighbor;
  p.progress[0].delivery = {
    stage: "deliver",
    loaded: { parts: 2 },
    route: "shortcut",
    visited: true,
  };
  delete p.visitedDestinations;
  delete p.progress[0].deliveryHistory;
  const restored = new Engine({ state: old, now: () => g.now() });
  assert.equal(
    restored.chapterView(restored.get("neighbor")).task.stage,
    "deliver",
  );
  assert.equal(
    restored.view("neighbor").me.progress[0].delivery.incident,
    null,
  );
  assert.deepEqual(restored.view("neighbor").me.visitedDestinations, {});
  assert.equal(
    moveDaySceneModel(restored.view("neighbor")).wheelSlipped,
    false,
  );
});

test("focused choice, primary and journal controls accept the remapped interact key through the actual handler", async () => {
  const f = fixture(),
    c = f.context;
  f.engine.get("neighbor").settings.keys.interact = "f";
  f.near();
  assert.equal(c.keys.interact, "f");
  c.selectMoveDayChoice(0);
  const choice = f.document.activeElement;
  assert.equal(choice.tagName, "BUTTON");
  const load = choice.onkeydown({
    key: "f",
    target: choice,
    preventDefault() {},
  });
  f.resolve();
  await load;
  assert.equal(c.state.chapter.task.stage, "route");
  f.near();
  c.selectMoveDayChoice(1);
  const route = f.document.activeElement;
  const chosen = route.onkeydown({
    key: "f",
    target: route,
    preventDefault() {},
  });
  f.resolve();
  await chosen;
  f.near();
  let control = f.ids.get("#move-day-primary");
  const crossing = control.onkeydown({
    key: "f",
    target: control,
    preventDefault() {},
  });
  f.resolve();
  await crossing;
  assert.equal(c.state.chapter.task.stage, "repair");
  control = f.ids.get("#move-day-result");
  const repair = control.onkeydown({
    key: "f",
    target: control,
    preventDefault() {},
  });
  f.resolve();
  await repair;
  assert.equal(c.state.chapter.task.stage, "deliver");
  assert.equal(c.state.me.progress[0].score, 0);
});
