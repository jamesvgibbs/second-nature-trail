import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { DOORS, isWalkable, clipMove } from "../public/world.mjs";
import {
  districtScenery,
  ROAD_BANDS,
  TREE_FOOTPRINT,
  SQUARE_TREES,
} from "../public/scenery.mjs";
import { SITE_LABELS } from "../public/trail-visuals.mjs";
import { restorationProgress } from "../public/helpers.mjs";
import { overviewCrowd } from "../public/crowd-view.mjs";
import { moveDaySceneModel } from "../public/move-day-scene.mjs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const overlap = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
const inside = (r, x, y) =>
  x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
function capture(restored = 0) {
  const marks = [];
  let role = "scene";
  const ctx = {
    clearRect() {},
    fillText(text, x, y) {
      const size = Number(this.font.match(/(\d+)px/)[1]);
      marks.push({
        role,
        type: "text",
        text,
        x: x - text.length * size * 0.3,
        y: y - size,
        width: text.length * size * 0.6,
        height: size,
      });
    },
    strokeRect(x, y, width, height) {
      marks.push({ role, type: "stroke", x, y, width, height });
    },
  };
  const context = vm.createContext({
    DOORS,
    districtScenery,
    ROAD_BANDS,
    SQUARE_TREES,
    SITE_LABELS,
    restorationProgress,
    overviewCrowd,
    moveDaySceneModel,
    isPresentation: false,
    target: null,
    palette: Array(6).fill("#abcdef"),
    state: {
      event: {
        chapter: 1,
        phase: "chapter",
        contributions: Array(8).fill(restored),
        restoration: { perDistrict: 2 },
        rewardProjects: {},
        finale: { contributors: [] },
      },
      me: { id: "self" },
      players: [],
    },
    drawAvatar() {},
    drawRepairs() {},
    rect(_ctx, x, y, width, height, color) {
      marks.push({ role, type: "rect", x, y, width, height, color });
    },
  });
  vm.runInContext(
    source.slice(
      source.indexOf("const districts ="),
      source.indexOf("let hostProjection ="),
    ),
    context,
  );
  vm.runInContext(
    source.slice(
      source.indexOf("function tree("),
      source.indexOf("async function host()"),
    ),
    context,
  );
  for (const name of [
    "drawFrontWalks",
    "tree",
    "yardProp",
    "building",
    "drawRoads",
  ]) {
    const fn = context[name];
    context[name] = (...args) => {
      const old = role;
      role = name;
      try {
        return fn(...args);
      } finally {
        role = old;
      }
    };
  }
  return { ctx, marks, context };
}

test("all16 front walks connect the fixed collision edge to a continuous street without crossing a sign or house", () => {
  for (let i = 0; i < 8; i++) {
    const a = DOORS[i * 2],
      b = DOORS[i * 2 + 1],
      sc = districtScenery(a, b, i);
    assert.deepEqual(sc, districtScenery(a, b, i));
    for (const path of sc.walkRoutes) {
      assert.equal(path[0].y, a[1] - 12);
      const end = path.at(-1);
      assert(
        ROAD_BANDS.some(
          (r) =>
            end.x >= r.x &&
            end.x <= r.x + r.width &&
            end.y >= r.y &&
            end.y <= r.y + r.height,
        ),
      );
      for (let n = 1; n < path.length; n++) {
        assert(isWalkable(path[n - 1]));
        assert(isWalkable(path[n]));
        assert.deepEqual(
          clipMove(path[n - 1], path[n]),
          path[n],
          `district${i} segment${n}`,
        );
        for (let t = 0; t <= 1; t += 0.05) {
          const x = path[n - 1].x + (path[n].x - path[n - 1].x) * t,
            y = path[n - 1].y + (path[n].y - path[n - 1].y) * t;
          assert(
            sc.walks.some(
              (r) =>
                x >= r.x &&
                x <= r.x + r.width &&
                y >= r.y &&
                y <= r.y + r.height,
            ),
          );
        }
      }
    }
    for (const sign of sc.signs)
      for (const walk of sc.walks)
        assert(!overlap(sign, walk), `district${i} sign blocks walk`);
  }
});

test("all three actual tree variants and16 yard props fit their reserved bounds and avoid roads, signs and walks", () => {
  const f = capture(),
    variants = [];
  for (let kind = 0; kind < 3; kind++) {
    f.marks.length = 0;
    f.context.tree(f.ctx, 0, 0, kind);
    for (const m of f.marks)
      assert(
        m.x >= TREE_FOOTPRINT.x &&
          m.y >= TREE_FOOTPRINT.y &&
          m.x + m.width <= TREE_FOOTPRINT.x + TREE_FOOTPRINT.width &&
          m.y + m.height <= TREE_FOOTPRINT.y + TREE_FOOTPRINT.height,
      );
    variants.push(JSON.stringify(f.marks));
  }
  assert.equal(new Set(variants).size, 3);
  const all = Array.from({ length: 8 }, (_, i) =>
      districtScenery(DOORS[i * 2], DOORS[i * 2 + 1], i),
    ),
    obstacles = [
      ...ROAD_BANDS,
      ...all.flatMap((s) => [...s.signs, ...s.walks, ...s.thresholds]),
    ];
  const kinds = new Set();
  for (const sc of all) {
    for (const [x, y, kind] of sc.trees) {
      f.marks.length = 0;
      f.context.tree(f.ctx, x, y, kind);
      for (const m of f.marks)
        for (const r of obstacles)
          assert(!overlap(m, r), `tree${x},${y} blocks ${JSON.stringify(r)}`);
    }
    for (const p of sc.props) {
      kinds.add(p.kind);
      f.marks.length = 0;
      f.context.yardProp(f.ctx, p);
      for (const m of f.marks) {
        assert(
          m.x >= p.x &&
            m.y >= p.y &&
            m.x + m.width <= p.x + p.width &&
            m.y + m.height <= p.y + p.height,
          p.kind,
        );
        for (const r of obstacles)
          assert(!overlap(m, r), `${p.kind} blocks ${JSON.stringify(r)}`);
      }
    }
  }
  assert.equal(kinds.size, 16);
});

test("actual final paint preserves every front-walk centerline and threshold above foundations for all restoration states", () => {
  const walkColors = new Set([
    "#cbbf9d",
    "#e3d7b8",
    "#8c9987",
    "#b7b49a",
    "#526c67",
    "#d4b777",
    "#4c5c58",
    "#9a9a7e",
  ]);
  for (const restored of [0, 1, 2]) {
    const f = capture(restored);
    f.context.drawMap(f.ctx, false);
    const paint = f.marks.filter((x) => x.type === "rect");
    for (let i = 0; i < 8; i++) {
      const sc = districtScenery(DOORS[i * 2], DOORS[i * 2 + 1], i);
      for (const threshold of sc.thresholds)
        for (
          let y = threshold.y + 0.5;
          y < threshold.y + threshold.height;
          y++
        ) {
          const m = paint.findLast((r) =>
            inside(r, threshold.x + threshold.width / 2, y),
          );
          assert(
            walkColors.has(m?.color),
            `threshold${i} at${y} overwritten by${m?.color}`,
          );
        }
      for (const path of sc.walkRoutes)
        for (let n = 1; n < path.length; n++)
          for (let t = 0.001; t < 0.999; t += 0.01) {
            const x = path[n - 1].x + (path[n].x - path[n - 1].x) * t,
              y = path[n - 1].y + (path[n].y - path[n - 1].y) * t;
            const m = paint.findLast((r) => inside(r, x, y));
            assert(
              walkColors.has(m?.color),
              `walk${i} ${x},${y} overwritten by${m?.color}`,
            );
          }
    }
  }
});

test("saved preexisting facade and road-intersection edits remain byte-for-byte intact", () => {
  const baseline = readFileSync(
    new URL("../test-results/nov18-review/baseline/app.js", import.meta.url),
    "utf8",
  );
  for (const [start, end] of [
    ["function building(", "function drawRoads("],
    ["function drawRoads(", "function drawMap("],
  ]) {
    const slice = (s) =>
      s.slice(s.indexOf(start), s.indexOf(end, s.indexOf(start)));
    assert.equal(slice(source), slice(baseline), start);
  }
});
