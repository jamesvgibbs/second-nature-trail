import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { DOORS } from '../public/world.mjs';
import { districtScenery, TREE_FOOTPRINT, SQUARE_TREES } from '../public/scenery.mjs';
import { restorationProgress } from '../public/helpers.mjs';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const roads = [{ x: 0, y: 245, width: 1200, height: 55 }, { x: 0, y: 505, width: 1200, height: 55 },
  { x: 365, y: 0, width: 55, height: 800 }, { x: 780, y: 0, width: 55, height: 800 }];
const houses = DOORS.map(([x, y]) => ({ x: x - 50, y: y - 97, width: 102, height: 85 }));
const paths = DOORS.map(([x, y]) => ({ x: x - 6, y: y - 20, width: 12, height: 35 }));
function renderer(restored = 0, self = 'p0') {
  const marks = [];
  const ctx = { clearRect() {},
    fillText(text, x, y) {
      const size = Number(this.font.match(/(\d+)px/)[1]);
      marks.push({ type: 'text', text, x: x - text.length * size * .3, y: y - size,
        width: text.length * size * .6, height: size, font: this.font });
    },
    strokeRect(x, y, width, height) { marks.push({ type: 'stroke', x, y, width, height }); },
  };
  const context = vm.createContext({
    DOORS, districtScenery, SQUARE_TREES, restorationProgress, target: null,
    state: { event: { chapter: -1, contributions: Array(8).fill(restored), restoration: { perDistrict: 1 },
      rewardProjects: { garden: 1, welcome: 1, festival: 1 }, finale: { contributors: Array.from({ length: 100 }, (_, i) => 'p' + i) } },
      me: { id: self }, players: [] },
    palette: Array(6).fill('#abcdef'), drawAvatar() {},
    rect(ctx, x, y, width, height, color) { marks.push({ type: 'rect', x, y, width, height, color }); },
  });
  vm.runInContext(source.slice(source.indexOf('const districts ='), source.indexOf('let hostProjection =')), context);
  vm.runInContext(source.slice(source.indexOf('function tree('), source.indexOf('async function host()')), context);
  vm.runInContext(source.slice(source.indexOf('function drawRepairs('), source.indexOf('setInterval(', source.indexOf('function drawRepairs('))), context);
  return { marks, ctx, context };
}

test('actual tree rectangles including canopy/trunk/shadow clear every home, entrance and road in all districts', () => {
  for (let district = 0; district < 8; district++) {
    const scenery = districtScenery(DOORS[district * 2], DOORS[district * 2 + 1]);
    for (const [x, y] of scenery.trees) {
      const f = renderer(); f.context.tree(f.ctx, x, y, district % 2);
      const bound = { ...TREE_FOOTPRINT, x: x + TREE_FOOTPRINT.x, y: y + TREE_FOOTPRINT.y };
      for (const mark of f.marks) {
        assert.ok(mark.x >= bound.x && mark.y >= bound.y && mark.x + mark.width <= bound.x + bound.width && mark.y + mark.height <= bound.y + bound.height);
        for (const avoid of [...houses, ...paths, ...roads]) assert.equal(intersects(mark, avoid), false, `district ${district + 1}`);
      }
    }
  }
});

test('actual beacon art and text fit between entrances and preserve four restoration lamps', () => {
  for (let district = 0; district < 8; district++) for (const restored of [0, .25, .5, .75, 1]) {
    const { beacon } = districtScenery(DOORS[district * 2], DOORS[district * 2 + 1]);
    const f = renderer(); f.context.drawBeacon(f.ctx, beacon.x, beacon.y, restored);
    const text = f.marks.find((m) => m.type === 'text');
    assert.equal(text.text, restored === 1 ? 'RESTORED' : 'AI BEACON');
    assert.equal(text.font, 'bold 18px monospace');
    const plate = f.marks.find((m) => m.color === '#f7f2df');
    assert.ok(text.x > plate.x && text.x + text.width < plate.x + plate.width && text.y >= plate.y && text.y + text.height <= plate.y + plate.height);
    assert.equal(f.marks.filter((m) => m.width === 9 && m.height === 7 && m.color === '#ed996c').length, 4 - restored * 4);
    for (const mark of f.marks) for (const avoid of [...houses, ...paths, ...roads]) assert.equal(intersects(mark, avoid), false);
  }
});

test('complete map paint order leaves all beacon labels unobscured including projects and 100 finale repairs', () => {
  for (const restored of [0, 1]) for (let self = 0; self < 100; self++) {
    const f = renderer(restored, 'p' + self); f.context.drawMap(f.ctx, true);
    const labels = f.marks.filter((m) => m.type === 'text' && ['AI BEACON', 'RESTORED', 'YOUR REPAIR'].includes(m.text));
    assert.equal(labels.length, 9);
    const repairLabel = labels.find((m) => m.text === 'YOUR REPAIR');
    for (const plate of f.marks.filter((m) => m.type === 'rect' && m.width === 122 && m.height === 24))
      assert.equal(intersects(repairLabel, plate), false, 'repair text must not overlap an earlier beacon plaque');
    const allTrees = SQUARE_TREES.concat(...Array.from({ length: 8 }, (_, i) => districtScenery(DOORS[i * 2], DOORS[i * 2 + 1]).trees));
    for (const [x, y] of allTrees) {
      const tree = renderer(); tree.context.tree(tree.ctx, x, y);
      for (const mark of tree.marks) {
        assert.equal(intersects(repairLabel, mark), false, 'repair text must not overlap earlier foliage/shadow');
        for (const outline of f.marks.filter((m) => m.type === 'stroke'))
          assert.equal(intersects(outline, mark), false, 'highlighted repair must not overlap foliage/shadow');
      }
    }
    for (const [x, y] of SQUARE_TREES)
      assert.equal(intersects(repairLabel, { x: x - 21, y: y + 17, width: 42, height: 16 }), false);
    for (const label of labels) {
      for (const later of f.marks.slice(f.marks.indexOf(label) + 1))
        assert.equal(intersects(label, later), false, `${label.text} overlaps later ${later.type}`);
    }
  }
});

test('plaza tree beds clear the fountain, benches, reward projects and neighborhood signs', () => {
  const fixtures = [
    { x: 563, y: 353, width: 70, height: 68 }, { x: 485, y: 438, width: 38, height: 16 }, { x: 677, y: 438, width: 38, height: 8 },
    { x: 470, y: 378, width: 48, height: 30 }, { x: 675, y: 371, width: 52, height: 34 }, { x: 575, y: 418, width: 53, height: 21 },
    { x: 444, y: 481, width: 310, height: 20 }, { x: 518, y: 454, width: 164, height: 16 }, { x: 489, y: 327, width: 222, height: 10 },
  ];
  for (const [x, y] of SQUARE_TREES) {
    const f = renderer(); f.context.tree(f.ctx, x, y);
    const bed = { x: x - 21, y: y + 17, width: 42, height: 16 };
    for (const mark of [...f.marks, bed]) for (const avoid of fixtures) assert.equal(intersects(mark, avoid), false);
  }
});
