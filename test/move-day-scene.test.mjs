import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../engine.mjs";
import {
  moveDaySceneModel,
  drawMoveDayScene,
  hitMoveDayHotspot,
  MOVE_DAY_GEOMETRY as G,
  MOVE_DAY_ROAD_PAINT as roads,
} from "../public/move-day-scene.mjs";

function fixture(count = 100) {
  let now = 100000,
    seq = 0;
  const engine = new Engine({ now: () => now });
  for (let i = 0; i < count; i++) {
    const id = `neighbor-${String(i).padStart(3, "0")}`;
    engine.addPlayer(id, `Neighbor ${i}`);
    engine.get(id).setup = true;
  }
  engine.host("operator", {
    type: "lobby",
    reason: "Isolated scene fixture",
    requestId: "lobby",
  });
  engine.host("operator", {
    type: "start",
    reason: "Isolated scene fixture",
    requestId: "start",
  });
  now = engine.state.deadline;
  engine.tick();
  const view = () => engine.view("neighbor-000");
  const action = (choice) => {
    const before = view(),
      target = before.chapter.task.target;
    engine.get("neighbor-000").position = { x: target.x, y: target.y };
    now += 3100;
    return engine.dispatch("neighbor-000", {
      type: "task",
      choice,
      expectedChapter: 0,
      expectedStage: before.chapter.task.stage,
      expectedStep: before.me.progress[0].step,
      requestId: `scene-${++seq}`,
    });
  };
  return { engine, view, action };
}
const inside = (p, r) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const roadAt = (x, y, runs) =>
  runs.some(([rx, ry, w, h]) => x >= rx && x < rx + w && y >= ry && y < ry + h);
const distance = (p, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy),
      ),
    );
  return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy);
};
function capture(state, options = {}) {
  const marks = [];
  const ctx = {
    save() {},
    restore() {},
    fillRect(x, y, width, height) {
      marks.push({ type: "rect", x, y, width, height, color: this.fillStyle });
    },
    fillText(text, x, y) {
      marks.push({
        type: "text",
        text,
        x,
        y,
        font: this.font,
        color: this.fillStyle,
      });
    },
  };
  return { model: drawMoveDayScene(ctx, state, options), marks };
}

test("100 peers at square, depot, or spread remain bounded to nearby stable safe companions; names require deliberate selection", () => {
  const f = fixture(),
    base = f.view(),
    original = structuredClone(base);
  let first;
  for (const distribution of ["square", "depot", "spread"]) {
    const state = structuredClone(base);
    state.me.position = { x: 160, y: 160 };
    state.players.forEach((p, i) => {
      p.position =
        distribution === "square"
          ? { x: 600, y: 380 }
          : distribution === "depot"
            ? { x: 160, y: 160 }
            : { x: 160 + i * 1.4, y: i % 2 ? 60 : 160 };
      p.emote = { text: "IGNORED NAMEPLATE" };
    });
    for (const players of [
      state.players,
      state.players.slice().reverse(),
      [...state.players.slice(40), ...state.players.slice(0, 40)],
    ]) {
      const model = moveDaySceneModel({ ...state, players });
      assert.equal(model.teammateCount, 99);
      assert.equal(model.teammates.length, distribution === "square" ? 0 : 3);
      assert.equal(model.nearbyCount, distribution === "square" ? 0 : 99);
      assert(model.teammates.every((p) => p.name === null));
      const identities = model.teammates.map(({ id, x, y }) => ({ id, x, y }));
      if (distribution !== "square") {
        if (!first) first = identities;
        else assert.deepEqual(identities, first);
      }
      for (const p of model.teammates) {
        assert(inside(p, G.layby));
        assert(!inside(p, G.homeDoor));
        assert(!inside(p, G.depotDoor));
        for (const route of Object.values(G.routes))
          for (let i = 1; i < route.points.length; i++)
            assert(
              distance(p, route.points[i - 1], route.points[i]) >
                route.shoulder / 2 + 52,
            );
      }
      const painted = capture({ ...state, players });
      assert.equal(
        painted.marks.filter((m) => m.type === "rect" && m.color === "#d8b88b" && m.width === 20 && m.height === 20 && !(m.x === 1124 && m.y === 364))
          .length,
        model.teammates.length + 1,
        "Exactly own avatar plus bounded companions are painted, apart from the fixed porch resident",
      );
      assert(
        !painted.marks.some(
          (m) => m.type === "text" && /Neighbor|IGNORED/.test(m.text),
        ),
      );
    }
  }
  const selected = moveDaySceneModel(base, { focusedPeerId: first[1].id });
  assert.equal(selected.teammates.filter((p) => p.name !== null).length, 1);
  assert.equal(selected.teammates[1].name, "Neighbor 2");
  assert(
    !capture(base, { focusedPeerId: first[1].id }).marks.some(
      (m) => m.type === "text" && m.text.includes("Neighbor"),
    ),
    "Names stay in accessible DOM, clear of the journey",
  );
  assert.deepEqual(
    base,
    original,
    "Neither model nor renderer mutates projection",
  );
});

test("personal saved delivery warms one home before shared contribution; three trips contribute exactly one of100", () => {
  const f = fixture();
  let model = moveDaySceneModel(f.view());
  assert.equal(model.homeRestored, false);
  assert.deepEqual(model.sharedRecovery, {
    completed: 0,
    total: 100,
    ratio: 0,
  });
  f.action(0);
  f.action(0);
  f.action(0);
  assert.equal(
    moveDaySceneModel(f.view()).homeRestored,
    false,
    "Packed or inspected cargo does not claim delivery",
  );
  f.action(0);
  model = moveDaySceneModel(f.view());
  assert.equal(model.completedDeliveries, 1);
  assert.equal(model.homeRestored, true);
  assert.equal(model.sharedRecovery.completed, 0);
  for (let i = 0; i < 2; i++)
    for (const choice of [0, 0, 0, 0]) f.action(choice);
  model = moveDaySceneModel(f.view());
  assert.equal(model.completedDeliveries, 3);
  assert.equal(model.complete, true);
  assert.deepEqual(model.sharedRecovery, {
    completed: 1,
    total: 100,
    ratio: 0.01,
  });
  assert.equal(
    model.hotspots.some((h) => h.enabled),
    false,
  );
  const occupied = capture({
    ...f.view(),
    me: { ...f.view().me, progress: [{ ...f.view().me.progress[0], step: 0 }] },
  }).marks;
  const restored = capture(f.view()).marks;
  assert(
    occupied.some((m) => m.x === 984 && m.y === 340 && m.color === "#435c5b"),
  );
  assert(
    restored.some((m) => m.x === 984 && m.y === 340 && m.color === "#f3d48b"),
  );
  assert(
    restored.some(
      (m) =>
        m.x === 908 && m.y === 196 && m.color === "#b6d18f" && m.width === 4,
    ),
    "Even1/100 produces a small visible shared cable repair",
  );
});

test("retained paused stage is visible but no scoring hotspot is available, and other chapters/lobby are unavailable", () => {
  const f = fixture(1);
  f.action(1);
  f.action(1);
  const state = f.view();
  const active = moveDaySceneModel(state);
  assert.equal(active.stage, "travel");
  assert.equal(active.selectedRoute, "shortcut");
  const paused = moveDaySceneModel({
    ...state,
    event: {
      ...state.event,
      phase: "paused",
      paused: true,
      pausedPhase: "chapter",
    },
  });
  assert.equal(paused.available, true);
  assert.equal(paused.stage, "travel");
  assert.deepEqual(paused.cartPose, active.cartPose);
  assert(paused.hotspots.every((h) => !h.enabled));
  assert.equal(
    hitMoveDayHotspot(paused, paused.cartPose.x, paused.cartPose.y),
    null,
  );
  for (const phase of [
    "draft",
    "lobby",
    "countdown",
    "brag",
    "finale",
    "awards",
    "closed",
  ])
    assert.equal(
      moveDaySceneModel({ ...state, event: { ...state.event, phase } })
        .available,
      false,
    );
  assert.equal(
    moveDaySceneModel({ ...state, event: { ...state.event, chapter: 1 } })
      .available,
    false,
  );
  assert.equal(
    moveDaySceneModel({
      ...state,
      event: { ...state.event, phase: "paused", pausedPhase: "brag" },
    }).available,
    false,
  );
});

test("cart movement uses supplied public positions/checkpoints, not clock or peer motion, and stays on its chosen scene route", () => {
  for (const choice of [0, 1]) {
    const f = fixture(1);
    f.action(0);
    f.action(choice);
    const state = f.view(),
      route = choice ? "shortcut" : "scenic",
      from = state.chapter.locations[0],
      to = state.rules.deliveryCheckpoints[route];
    let prior = -1;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const position = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      };
      const model = moveDaySceneModel({
        ...state,
        me: { ...state.me, position },
      });
      assert(Math.abs(model.travelFraction - t) < 1e-10);
      assert(model.travelFraction >= prior);
      prior = model.travelFraction;
      assert(
        roadAt(
          model.cartPose.x,
          model.cartPose.y,
          route === "scenic" ? roads.paved : roads.rough,
        ),
      );
      assert.deepEqual(
        moveDaySceneModel({
          ...state,
          serverTime: 999999999,
          me: { ...state.me, position },
        }).cartPose,
        model.cartPose,
      );
    }
    f.action(0);
    const delivery = f.view(),
      home = delivery.chapter.locations[1];
    assert.equal(
      moveDaySceneModel({ ...delivery, me: { ...delivery.me, position: home } })
        .travelFraction,
      1,
    );
    const at = moveDaySceneModel({
      ...delivery,
      me: { ...delivery.me, position: home },
    }).cartPose;
    assert.deepEqual(at, { x: 1048, y: 484 });
  }
});

test("roads form two connected, visibly different silhouettes on one pixel grid and meet both entrances", () => {
  assert(G.routes.scenic.width > G.routes.shortcut.width);
  assert(Math.min(...G.routes.scenic.points.map((p) => p[1])) < 300);
  assert(Math.min(...G.routes.shortcut.points.map((p) => p[1])) > 540);
  assert.deepEqual(G.routes.scenic.points[0], G.routes.shortcut.points[0]);
  assert.deepEqual(
    G.routes.scenic.points.at(-1),
    G.routes.shortcut.points.at(-1),
  );
  for (const [name, runs] of Object.entries(roads))
    for (const [x, y, w, h] of runs) {
      assert(
        [x, y, w, h].every((v) => v % G.grid === 0),
        name,
      );
      assert(x >= 0 && y >= 0 && x + w <= 1200 && y + h <= 800);
    }
  for (const [name, route] of Object.entries(G.routes))
    for (let i = 1; i < route.points.length; i++)
      for (let t = 0; t <= 1; t += 0.01) {
        const a = route.points[i - 1],
          b = route.points[i],
          x = a[0] + (b[0] - a[0]) * t,
          y = a[1] + (b[1] - a[1]) * t;
        assert(
          roadAt(x, y, name === "scenic" ? roads.paved : roads.rough),
          `${name} continuous at ${x},${y}`,
        );
      }
  const f = fixture(1),
    { marks } = capture(f.view());
  assert(
    marks.some(
      (m) => m.type === "rect" && m.x === 144 && m.y === 500 && m.height === 24,
    ),
    "Depot apron touches bottom of doorway",
  );
  assert(
    marks.some(
      (m) =>
        m.type === "rect" && m.x === 1032 && m.y === 448 && m.height === 116,
    ),
    "Home approach touches bottom of doorway",
  );
  const lastAt = (x, y) =>
    marks.filter((m) => m.type === "rect" && inside({ x, y }, m)).at(-1);
  assert.equal(lastAt(172, 508).color, "#64716d");
  assert.equal(
    lastAt(1048, 460).color,
    "#64716d",
    "Home threshold remains road after foundation shadow",
  );
  const labels = marks.filter((m) => m.type === "text");
  assert.deepEqual(
    labels.map((m) => m.text),
    ["DEPOT", "PAVED DETOUR", "RUBBLE SHORTCUT", "YOU"],
  );
  assert(
    labels
      .filter((m) => m.text !== "YOU")
      .every((m) => m.font.includes("28px")),
  );
  assert(
    marks.some((m) => m.x === 256 - 44 && m.width === 88),
    "Own cart has an88px focal body",
  );
});

test("scene consumes only public stage/presence/restoration facts and leaves private question fields unread", () => {
  const f = fixture(1),
    state = f.view();
  for (const key of ["questions", "challenge", "secret"])
    Object.defineProperty(state.chapter, key, {
      get() {
        throw new Error("Private/learning data read");
      },
    });
  assert.doesNotThrow(() => capture(state));
  const normal = moveDaySceneModel(state);
  assert.equal(hitMoveDayHotspot(normal, 176, 400)?.action, "objective");
  f.action(0);
  const choosing = moveDaySceneModel(f.view());
  assert.equal(hitMoveDayHotspot(choosing, 640, 376)?.route, "scenic");
  assert.equal(hitMoveDayHotspot(choosing, 896, 676)?.route, "shortcut");
});

test("one stage-specific next marker follows the chosen crossing or delivery while the own cart stays identified", () => {
  const f = fixture(1);
  assert.equal(moveDaySceneModel(f.view()).nextStop, null);
  f.action(0);
  f.action(1);
  let m = moveDaySceneModel(f.view());
  assert.deepEqual(m.nextStop, {
    ...G.routes.shortcut.checkpoint,
    kind: "crossing",
  });
  let painted = capture(f.view());
  assert.equal(
    painted.marks.filter((m) => m.type === "text" && m.text === "NEXT").length,
    1,
  );
  assert.equal(
    painted.marks.filter((m) => m.type === "text" && m.text === "YOU").length,
    1,
  );
  f.action(0);
  m = moveDaySceneModel(f.view());
  assert.deepEqual(m.nextStop, { x: 1048, y: 484, kind: "delivery" });
  assert.equal(hitMoveDayHotspot(m, 1160, 436)?.action, "objective");
  const p = capture(f.view()).marks.filter(
    (m) => m.type === "text" && m.text === "NEXT",
  )[0];
  assert(
    p.x <= 1200 && p.y > 372,
    "Delivery marker stays clear of the windows",
  );
});

test("actual scenery paint leaves both route surfaces continuous with no tree, sign or house overpaint", () => {
  const f = fixture(1),
    { model, marks } = capture(f.view());
  const pixels = Array(300 * 200).fill(null);
  for (const mark of marks.filter((m) => m.type === "rect")) {
    assert(
      [mark.x, mark.y, mark.width, mark.height].every((v) => v % 4 === 0),
      `Off-grid art: ${JSON.stringify(mark)}`,
    );
    for (
      let y = Math.max(0, mark.y / 4);
      y < Math.min(200, (mark.y + mark.height) / 4);
      y++
    )
      pixels.fill(
        mark.color,
        y * 300 + Math.max(0, mark.x / 4),
        y * 300 + Math.min(300, (mark.x + mark.width) / 4),
      );
  }
  const own = {
    x: model.cartPose.x - 64,
    y: model.cartPose.y - 96,
    width: 148,
    height: 144,
  };
  for (const [name, runs, colors] of [
    ["paved", roads.paved, ["#64716d", "#e5d5a1"]],
    ["shortcut", roads.rough, ["#9d7c59", "#665748", "#64716d"]],
  ]) {
    for (const [x, y, w] of runs)
      for (let at = x; at < x + w; at += 4) {
        if (inside({ x: at + 2, y: y + 2 }, own)) continue;
        const crossing =
          roadAt(at + 2, y + 2, roads.paved) &&
          roadAt(at + 2, y + 2, roads.rough);
        assert(
          colors.includes(pixels[(y / 4) * 300 + at / 4]) ||
            (crossing &&
              ["#64716d", "#9d7c59", "#665748", "#e5d5a1"].includes(
                pixels[(y / 4) * 300 + at / 4],
              )),
          `${name} blocked at${at},${y}: ${pixels[(y / 4) * 300 + at / 4]}`,
        );
      }
  }
});
