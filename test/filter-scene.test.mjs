import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../engine.mjs";
import { CHAPTERS } from "../content.mjs";
import {
  filterSceneModel,
  drawFilterScene,
  hitFilterHotspot,
  FILTER_GEOMETRY as G,
} from "../public/filter-scene.mjs";
function fixture() {
  let now = 100000,
    seq = 0;
  const engine = new Engine({ now: () => now });
  engine.addPlayer("self", "Self");
  engine.get("self").setup = true;
  engine.host("qa", {
    type: "lobby",
    reason: "Isolated filter renderer fixture",
    requestId: "lobby",
  });
  engine.host("qa", {
    type: "start",
    reason: "Isolated filter renderer fixture",
    requestId: "start",
  });
  now = engine.state.deadline;
  engine.tick();
  for (let i = 0; i < 2; i++)
    engine.host("qa", {
      type: "advance",
      reason: "Unplayed earlier phase in renderer fixture",
      requestId: "advance" + i,
    });
  const view = (epoch = "scene-process") => ({
    ...engine.view("self"),
    projectionEpoch: epoch,
  });
  function act(choice) {
    const before = view(),
      t = before.chapter.task;
    engine.get("self").position = { x: t.target.x, y: t.target.y };
    now += 3100;
    return engine.dispatch("self", {
      type: "task",
      choice,
      expectedChapter: 1,
      expectedStep: before.me.progress[1].step,
      expectedStage: t.stage,
      requestId: "task" + ++seq,
    });
  }
  return { engine, view, act, now: () => now };
}
function capture(state, options = {}) {
  const marks = [];
  const ctx = {
    save() {},
    restore() {},
    fillRect(x, y, width, height) {
      assert(width >= 0 && height >= 0);
      marks.push({ type: "rect", x, y, width, height, color: this.fillStyle });
    },
    fillText(text, x, y) {
      marks.push({ type: "text", text, x, y, font: this.font });
    },
  };
  return { model: drawFilterScene(ctx, state, options), marks };
}
const intersects = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

test("inspection gates all filter evidence and authored options; private answers are never read", () => {
  const f = fixture(),
    v = f.view();
  assert.equal(v.chapter.task.stage, "inspect");
  for (const key of ["answer", "explanation", "evidence", "options"])
    Object.defineProperty(v.chapter.task, key, {
      get() {
        throw Error("Uninspected/private " + key);
      },
    });
  for (const key of ["questions", "challenge"])
    Object.defineProperty(v.chapter, key, {
      get() {
        throw Error("Unrelated " + key);
      },
    });
  const { model, marks } = capture(v);
  assert.deepEqual(model.options, []);
  assert.equal(model.evidence, "");
  assert(!marks.some((m) => /16 × 20|20 × 25/.test(m.text || "")));
  f.act(0);
  const inspected = f.view();
  Object.defineProperty(inspected.chapter.task, "answer", {
    get() {
      throw Error("Private answer");
    },
  });
  const m = capture(inspected).model;
  assert.equal(m.evidence, CHAPTERS[1].tasks[0].evidence);
  assert.deepEqual(
    m.options.map((x) => x.label),
    CHAPTERS[1].tasks[0].options,
  );
  assert.deepEqual(
    m.options.map((x) => x.id),
    [0, 1, 2],
  );
  assert.deepEqual(m.options[1].dimensions, [16, 20]);
});

test("six accepted repairs rebuild from saved state; wrong attempts never warm a home or inflate shared restoration", () => {
  const f = fixture();
  for (let step = 0; step < 6; step++) {
    const before = f.view();
    assert.equal(
      filterSceneModel(before).completedHomes.filter(Boolean).length,
      step,
    );
    f.act(0);
    const inspected = f.view(),
      m = filterSceneModel(inspected),
      answer = CHAPTERS[1].tasks[step].answer;
    f.act((answer + 1) % 3);
    assert.equal(filterSceneModel(f.view()).homeRestored, false);
    assert.equal(filterSceneModel(f.view()).step, step);
    const items =
      f.view().me.inventory.filters + f.view().me.progress[1].reserve.filters;
    const result = f.act(answer);
    assert.equal(result.correct, true);
    const after = f.view(),
      snapshot = {
        epoch: after.projectionEpoch,
        step: step + 1,
        name: m.homeName,
        evidence: m.evidence,
        choiceLabel: m.options[answer].label,
      };
    const painted = capture(after, { completedHome: snapshot });
    assert(painted.model.homeRestored);
    assert.equal(painted.model.homeName, m.homeName);
    assert(painted.marks.some((x) => x.text === "AIRFLOW RESTORED"));
    assert.equal(
      after.me.inventory.filters + after.me.progress[1].reserve.filters,
      items - 1,
    );
    assert.equal(painted.model.sharedRecovery.completed, step === 5 ? 1 : 0);
    for (const stale of [
      { ...snapshot, epoch: "old-process" },
      { ...snapshot, step: step },
    ])
      assert.notEqual(
        filterSceneModel(after, { completedHome: stale }).stage,
        "installed",
      );
    const restored = new Engine({
      state: JSON.parse(JSON.stringify(f.engine.state)),
      now: f.now,
    });
    const reloaded = {
      ...restored.view("self"),
      projectionEpoch: "restarted-process",
    };
    const rm = filterSceneModel(reloaded, { completedHome: snapshot });
    assert.equal(rm.completedHomes.filter(Boolean).length, step + 1);
    assert.equal(rm.stage, step === 5 ? "complete" : "inspect");
    assert.equal(rm.homeRestored, step === 5);
  }
  assert.equal(f.view().me.progress[1].score, 35);
  assert.equal(f.view().me.progress[1].complete, true);
});

test("semantic card selection exposes authored IDs; pause, pending and other phases have no active hotspots", () => {
  const f = fixture();
  f.act(0);
  const v = f.view(),
    m = filterSceneModel(v);
  for (let i = 0; i < 3; i++) {
    const r = G.cards[i],
      hit = hitFilterHotspot(m, r.x + r.width / 2, r.y + r.height / 2);
    assert.equal(hit.action, "choice");
    assert.equal(hit.choice, i);
  }
  assert.equal(hitFilterHotspot(m, -1, -1), null);
  for (const [phase, pausedPhase] of [
    ["paused", "chapter"],
    ["paused", "brag"],
    ["brag", null],
    ["finale", null],
    ["awards", null],
    ["closed", null],
  ]) {
    const model = filterSceneModel({
      ...v,
      event: { ...v.event, phase, pausedPhase },
    });
    assert.equal(model.hotspots.length, 0);
    assert.equal(model.active, phase === "paused" && pausedPhase === "chapter");
  }
  assert.equal(filterSceneModel(v, { pending: true }).hotspots.length, 0);
  assert.equal(
    filterSceneModel({ ...v, event: { ...v.event, chapter: 2 } }).active,
    false,
  );
});

test("solo and100person distributions retain stable at-most-three safe companion anchors and no automatic names", () => {
  const f = fixture();
  f.act(0);
  const v = f.view(),
    point = { ...v.me.position };
  assert.equal(capture({ ...v, players: [v.me] }).model.teammates.length, 0);
  for (const pattern of ["stack", "near", "far"]) {
    const players = Array.from({ length: 99 }, (_, i) => ({
      id: "peer-" + String(i).padStart(3, "0"),
      name: "PRIVATE LONG NAME " + i,
      connected: true,
      setup: true,
      position:
        pattern === "far"
          ? { x: point.x + 500, y: point.y }
          : pattern === "near"
            ? { x: point.x + i, y: point.y + 10 }
            : { ...point },
      emote: { text: "DO NOT PAINT" },
    }));
    const a = capture({ ...v, players }),
      b = capture(
        { ...v, players: players.slice().reverse() },
        { focusedPeerId: "peer-001" },
      );
    assert.equal(a.model.teammateCount, 99);
    assert.equal(a.model.teammates.length, pattern === "far" ? 0 : 3);
    assert.deepEqual(
      a.model.teammates.map((x) => x.id),
      b.model.teammates.map((x) => x.id),
    );
    for (const peer of a.model.teammates) {
      const bounds = { x: peer.x - 24, y: peer.y - 48, width: 48, height: 88 };
      for (const forbidden of [G.home, G.unit, ...G.cards])
        assert(!intersects(bounds, forbidden));
    }
    for (const { marks } of [a, b])
      assert(
        !marks.some((x) => /PRIVATE LONG NAME|DO NOT PAINT/.test(x.text || "")),
      );
  }
});

test("scene rendering is deterministic, read-only and keeps all authored option text available in its model", () => {
  const f = fixture();
  for (let i = 0; i < 6; i++) {
    f.act(0);
    const v = f.view(),
      before = structuredClone(v),
      a = capture(v),
      b = capture(v);
    assert.deepEqual(a, b);
    assert.deepEqual(v, before);
    assert.deepEqual(
      a.model.options.map((x) => x.label),
      CHAPTERS[1].tasks[i].options,
    );
    for (const mark of a.marks.filter((x) => x.type === "rect"))
      assert(
        mark.x >= 0 &&
          mark.y >= 0 &&
          mark.x + mark.width <= 1200 &&
          mark.y + mark.height <= 800,
      );
    f.act(CHAPTERS[1].tasks[i].answer);
  }
});

test("Cedar direction cue appears only after public inspection and points into the cabinet", () => {
  const f = fixture();
  f.act(0);
  f.act(CHAPTERS[1].tasks[0].answer);
  const before = capture(f.view());
  assert(
    !before.marks.some((x) => x.text === "TO UNIT" || x.text === "AIRFLOW"),
  );
  f.act(0);
  const inspected = f.view();
  assert.equal(inspected.chapter.task.target.name, "Cedar home");
  const shown = capture(inspected);
  assert(shown.marks.some((x) => x.text === "TO UNIT"));
  assert(shown.marks.some((x) => x.text === "AIRFLOW"));
  const arrow = shown.marks.filter(
    (x) =>
      x.type === "rect" &&
      x.color === "#f3e9ca" &&
      x.x >= 564 &&
      x.x < 632 &&
      x.y >= 440 &&
      x.y < 464,
  );
  assert.equal(arrow.length, 4);
  assert(arrow.some((r) => r.x === 564 && r.width === 44));
  assert(arrow.some((r) => r.x === 620 && r.width === 8));
  assert(Math.max(...arrow.map((r) => r.x + r.width)) <= G.unit.x);
  for (const evidence of [
    "",
    "An arrow is visible.",
    "The arrow points away from the equipment.",
  ]) {
    const state = structuredClone(inspected);
    state.chapter.task.evidence = evidence;
    assert(!capture(state).marks.some((x) => x.text === "TO UNIT"));
  }
});

test("distant windows reflect bounded shared completions without repairing the current personal home", () => {
  const f = fixture(),
    v = f.view(),
    windows = [
      [112, 184],
      [276, 208],
      [448, 176],
      [1160, 196],
    ];
  for (const completed of [0, 3, 100]) {
    const state = structuredClone(v);
    state.event.contributions[1] = completed;
    state.event.restoration.perDistrict = 100;
    const { model, marks } = capture(state);
    assert.deepEqual(model.sharedRecovery, { completed, total: 100 });
    assert.equal(model.homeRestored, false);
    assert.equal(model.completedHomes.filter(Boolean).length, 0);
    const colors = windows.map(
      ([x, y]) =>
        marks.findLast(
          (r) =>
            r.type === "rect" &&
            r.x === x &&
            r.y === y &&
            r.width === 12 &&
            r.height === 16,
        )?.color,
    );
    assert.equal(
      colors.filter((c) => c === "#d29a55").length,
      Math.min(4, completed),
    );
    assert(colors.every((c) => c === "#d29a55" || c === "#465c57"));
    assert.equal(
      marks.find(
        (r) =>
          r.type === "rect" &&
          r.x === 612 &&
          r.y === 224 &&
          r.width === 480 &&
          r.height === 248,
      ).color,
      "#657773",
    );
    assert(!marks.some((x) => x.text === "AIRFLOW RESTORED"));
  }
});
