import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { DOORS, isWalkable, clipMove } from "../public/world.mjs";
import {
  districtScenery,
  TREE_FOOTPRINT,
  SQUARE_TREES,
  ROAD_BANDS,
} from "../public/scenery.mjs";
import { restorationProgress } from "../public/helpers.mjs";
import { SITE_LABELS } from "../public/trail-visuals.mjs";
import { RULES } from "../content.mjs";

const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const intersects = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
const contains = (a, b) =>
  b.x >= a.x &&
  b.y >= a.y &&
  b.x + b.width <= a.x + a.width &&
  b.y + b.height <= a.y + a.height;
const houses = DOORS.map(([x, y]) => ({
  x: x - 50,
  y: y - 97,
  width: 102,
  height: 85,
}));
const paths = DOORS.map(([x, y]) => ({
  x: x - 6,
  y: y - 20,
  width: 12,
  height: 35,
}));
function renderer(restored = 0, self = "p0", chapter = -1) {
  const marks = [];
  let role = "scene";
  const ctx = {
    clearRect() {},
    fillText(text, x, y) {
      const size = Number(this.font.match(/(\d+)px/)[1]);
      marks.push({
        type: "text",
        role,
        text,
        x: x - text.length * size * 0.3,
        y: y - size,
        width: text.length * size * 0.6,
        height: size,
        font: this.font,
      });
    },
    strokeRect(x, y, width, height) {
      const inset = (this.lineWidth || 1) / 2;
      marks.push({
        type: "stroke",
        role,
        x: x - inset,
        y: y - inset,
        width: width + inset * 2,
        height: height + inset * 2,
      });
    },
  };
  const context = vm.createContext({
    DOORS,
    districtScenery,
    SQUARE_TREES,
    ROAD_BANDS,
    SITE_LABELS,
    restorationProgress,
    target: null,
    state: {
      event: {
        chapter,
        contributions: Array(8).fill(restored),
        restoration: { perDistrict: 1 },
        rewardProjects: { garden: 1, welcome: 1, festival: 1 },
        finale: {
          contributors: Array.from({ length: 100 }, (_, i) => "p" + i),
        },
      },
      me: { id: self },
      players: [],
    },
    palette: Array(6).fill("#abcdef"),
    drawAvatar() {},
    rect(_ctx, x, y, width, height, color) {
      marks.push({ type: "rect", role, x, y, width, height, color });
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
  vm.runInContext(
    source.slice(
      source.indexOf("function drawRepairs("),
      source.indexOf("setInterval(", source.indexOf("function drawRepairs(")),
    ),
    context,
  );
  const roads = context.drawRoads;
  assert.equal(typeof roads, "function");
  context.drawRoads = (...args) => {
    const previous = role;
    role = "road";
    try {
      return roads(...args);
    } finally {
      role = previous;
    }
  };
  return { marks, ctx, context };
}

function assertClearRoadPaint(f) {
  const firstRoad = f.marks.findIndex((mark) => mark.role === "road");
  assert(firstRoad >= 0);
  for (const band of ROAD_BANDS) {
    assert(
      f.marks.some(
        (mark) =>
          mark.role === "road" &&
          ["x", "y", "width", "height"].every((key) => mark[key] === band[key]),
      ),
      "Every full road and shoulder band must be painted",
    );
    for (const later of f.marks
      .slice(firstRoad)
      .filter((mark) => mark.role !== "road"))
      assert.equal(
        intersects(band, later),
        false,
        `Street obscured by ${later.type} at ${later.x},${later.y} (${later.width}x${later.height})`,
      );
  }
  for (const mark of f.marks.filter((mark) => mark.role === "road"))
    assert(
      ROAD_BANDS.some((band) => contains(band, mark)),
      "Road markings and shoulders stay inside the declared street envelope",
    );
  const plots = f.marks
    .slice(0, firstRoad)
    .filter(
      (mark) =>
        mark.width > 100 &&
        mark.height > 100 &&
        !(mark.width === 1200 && mark.height === 800),
    );
  assert.equal(plots.length, 8);
  for (const plot of plots)
    for (const band of ROAD_BANDS)
      assert.equal(
        intersects(plot, band),
        false,
        "Even underpainted district grounds stay outside streets",
      );
}

test("all road and shoulder pixels inside playable world bounds are traversable with unchanged collision geometry", () => {
  for (const band of ROAD_BANDS) {
    if (band.width > band.height) {
      for (let y = band.y; y <= band.y + band.height; y++) {
        const start = { x: 30, y },
          finish = { x: 1170, y };
        assert(isWalkable(start) && isWalkable(finish));
        assert.deepEqual(
          clipMove(start, finish),
          finish,
          `Horizontal street at y${y} intersects a house`,
        );
      }
    } else {
      for (let x = band.x; x <= band.x + band.width; x++) {
        const start = { x, y: 30 },
          finish = { x, y: 770 };
        assert(isWalkable(start) && isWalkable(finish));
        assert.deepEqual(
          clipMove(start, finish),
          finish,
          `Vertical street at x${x} intersects a house`,
        );
      }
    }
  }
});

test("actual plots, roofs, signs, trees, projects and repairs never repaint streets in any active district or recovery state", () => {
  for (let chapter = 0; chapter < 8; chapter++)
    for (const restored of [0, 0.05, 0.5, 1]) {
      const f = renderer(restored, "p0", chapter);
      f.context.drawMap(f.ctx, true);
      assertClearRoadPaint(f);
      assert.equal(
        f.marks.some(
          (mark) =>
            mark.type === "text" && /AI BEACON|AI RELAY/.test(mark.text),
        ),
        false,
      );
    }
});

test("all one hundred individual finale outlines clear roads and destination labels including stroke width", () => {
  const names = new Set(SITE_LABELS.flat());
  for (let self = 0; self < 100; self++) {
    const f = renderer(1, "p" + self, self % 8);
    f.context.drawMap(f.ctx, true);
    const outlines = f.marks.filter((mark) => mark.type === "stroke");
    assert.equal(outlines.length, 1);
    for (const outline of outlines)
      for (const avoid of [
        ...ROAD_BANDS,
        ...f.marks.filter(
          (mark) => mark.type === "text" && names.has(mark.text),
        ),
      ])
        assert.equal(
          intersects(outline, avoid),
          false,
          `Repair ${self} obscures the street or a destination`,
        );
    assertClearRoadPaint(f);
  }
});

test("actual tree canopy, trunk and shadow clear every home, entrance and street", () => {
  for (let district = 0; district < 8; district++) {
    const scenery = districtScenery(
      DOORS[district * 2],
      DOORS[district * 2 + 1],
    );
    for (const [x, y] of scenery.trees) {
      const f = renderer();
      f.context.tree(f.ctx, x, y, district % 2);
      const bound = {
        ...TREE_FOOTPRINT,
        x: x + TREE_FOOTPRINT.x,
        y: y + TREE_FOOTPRINT.y,
      };
      for (const mark of f.marks) {
        assert(contains(bound, mark));
        for (const avoid of [...houses, ...paths, ...ROAD_BANDS])
          assert.equal(
            intersects(mark, avoid),
            false,
            `district ${district + 1}`,
          );
      }
    }
  }
});

test("all sixteen service facades retain their footprint and leave doors unobscured", () => {
  for (let index = 0; index < DOORS.length; index++)
    for (const recovery of [0, 0.05, 0.5, 1]) {
      const [x, y] = DOORS[index],
        f = renderer();
      f.context.building(
        f.ctx,
        x - 45,
        y - 85,
        90,
        65,
        "#dfc799",
        index,
        recovery === 1,
        recovery,
      );
      for (const mark of f.marks)
        assert(
          contains(houses[index], mark),
          `Facade ${index + 1} extends outside its visual footprint`,
        );
      const door = f.marks.find(
        (mark) =>
          mark.x === x - 8 &&
          mark.y === y - 45 &&
          mark.width === 16 &&
          mark.height === 25,
      );
      assert(door);
      for (const later of f.marks.slice(f.marks.indexOf(door) + 1)) {
        if (
          later.width === 2 &&
          later.height === 2 &&
          later.x === x + 4 &&
          later.y === y - 34
        )
          continue;
        assert.equal(
          intersects(door, later),
          false,
          `Facade ${index + 1} paints over its door`,
        );
      }
    }
});

test("destination signs stay readable in every active district and recovery state", () => {
  const names = new Set(SITE_LABELS.flat());
  for (let chapter = 0; chapter < 8; chapter++)
    for (const restored of [0, 0.05, 1]) {
      const f = renderer(restored, "p0", chapter);
      f.context.drawMap(f.ctx, true);
      const signs = f.marks.filter(
        (mark) => mark.type === "text" && names.has(mark.text),
      );
      assert.equal(signs.length, 16);
      for (const sign of signs) {
        assert.equal(sign.font, "bold 15px monospace");
        for (const later of f.marks.slice(f.marks.indexOf(sign) + 1))
          assert.equal(
            intersects(sign, later),
            false,
            `${sign.text} obscured by later ${later.type}`,
          );
      }
    }
});

test("plaza tree beds clear its fountain, benches, reward projects, signs and streets", () => {
  const fixtures = [
    { x: 563, y: 353, width: 70, height: 68 },
    { x: 485, y: 438, width: 38, height: 16 },
    { x: 677, y: 438, width: 38, height: 8 },
    { x: 470, y: 378, width: 48, height: 30 },
    { x: 675, y: 371, width: 52, height: 34 },
    { x: 575, y: 422, width: 53, height: 21 },
    { x: 528, y: 446, width: 144, height: 16 },
    { x: 489, y: 327, width: 222, height: 10 },
    ...ROAD_BANDS,
  ];
  for (const [x, y] of SQUARE_TREES) {
    const f = renderer();
    f.context.tree(f.ctx, x, y);
    const bed = { x: x - 21, y: y + 17, width: 42, height: 16 };
    for (const mark of [...f.marks, bed])
      for (const avoid of fixtures)
        assert.equal(intersects(mark, avoid), false);
  }
});

test("one completed objective cannot paint a twenty-participant district as fully restored", () => {
  for (const [completed, expectedRecovery, expectedLit] of [
    [0, 0, false],
    [1, 0.05, false],
    [10, 0.5, false],
    [20, 1, true],
  ]) {
    const f = renderer(),
      renderedHomes = [],
      original = f.context.building;
    f.context.state.event.restoration.perDistrict = 20;
    f.context.state.event.contributions = [completed, 0, 0, 0, 0, 0, 0, 0];
    f.context.building = (...args) => {
      renderedHomes.push({ lit: args[7], recovery: args[8] });
      return original(...args);
    };
    f.context.drawMap(f.ctx, true);
    assert.equal(renderedHomes.length, 16);
    for (const home of renderedHomes.slice(0, 2)) {
      assert.equal(home.recovery, expectedRecovery);
      assert.equal(home.lit, expectedLit);
    }
    assert(
      renderedHomes
        .slice(2)
        .every((home) => home.lit === false && home.recovery === 0),
    );
  }
});

test("immutable cargo crossings and their between-home corridor remain walkable", () => {
  const { scenic, shortcut } = RULES.deliveryCheckpoints;
  assert.deepEqual({ x: scenic.x, y: scenic.y }, { x: 230, y: 60 });
  assert.deepEqual({ x: shortcut.x, y: shortcut.y }, { x: 230, y: 160 });
  for (let x = 219; x <= 241; x++) {
    const finish = { x, y: 230 };
    assert.deepEqual(clipMove({ x, y: 52 }, finish), finish);
  }
  assert.deepEqual(clipMove({ x: 160, y: 160 }, { x: 300, y: 160 }), {
    x: 300,
    y: 160,
  });
  const f = renderer();
  f.context.drawMap(f.ctx, true);
  const crossingColors = new Set([
    "#8c9987",
    "#b7b49a",
    "#526c67",
    "#d4b777",
    "#4c5c58",
    "#9a9a7e",
  ]);
  const crossingPaint = f.marks.filter(
    (mark) =>
      mark.type === "rect" &&
      crossingColors.has(mark.color) &&
      mark.x >= 213 &&
      mark.x + mark.width <= 247 &&
      mark.y >= 50 &&
      mark.y + mark.height <= 230,
  );
  assert(
    crossingPaint.length >= 8,
    "Exercise actual crossing deck, rails, approach and rubble primitives",
  );
  for (const mark of crossingPaint)
    for (const x of [mark.x, mark.x + mark.width]) {
      const top = { x, y: mark.y },
        bottom = { x, y: mark.y + mark.height };
      assert(
        isWalkable(top) && isWalkable(bottom),
        `A painted crossing cannot occupy a house collision: ${JSON.stringify(mark)}`,
      );
      assert.deepEqual(clipMove(top, bottom), bottom);
    }
});
