import test from "node:test";
import assert from "node:assert/strict";
import {
  DOORS,
  OBSTACLES,
  isWalkable,
  clipMove,
  findPath,
} from "../public/world.mjs";
import { CHAPTERS, ACTIVITY_STOPS } from "../content.mjs";
const square = { x: 600, y: 380 };
function assertRoute(from, to) {
  const path = findPath(from, to);
  assert.ok(
    path?.length,
    `No route from ${JSON.stringify(from)} to ${JSON.stringify(to)}`,
  );
  let previous = from;
  for (const point of path) {
    assert.ok(isWalkable(point));
    const clipped = clipMove(previous, point);
    assert.ok(
      Math.hypot(clipped.x - point.x, clipped.y - point.y) < 0.001,
      "Path segment crosses a wall",
    );
    previous = point;
  }
  assert.deepEqual(previous, to);
}
test("world doors remain aligned with all16 authored activity locations", () => {
  assert.deepEqual(
    DOORS,
    CHAPTERS.flatMap((c) => c.locations.map((l) => [l.x, l.y])),
  );
});
test("every district door, route checkpoint and spatial site is reachable from square", () => {
  for (const [x, y] of [...DOORS, [230, 60], [230, 160]])
    assertRoute(square, { x, y });
  for (const stop of ACTIVITY_STOPS)
    assertRoute(square, { x: stop.x, y: stop.y });
});
test("delivery route and consecutive spatial sites remain reachable", () => {
  for (const checkpoint of [
    { x: 230, y: 60 },
    { x: 230, y: 160 },
  ]) {
    assertRoute({ x: 160, y: 160 }, checkpoint);
    assertRoute(checkpoint, { x: 300, y: 160 });
    assertRoute({ x: 300, y: 160 }, { x: 160, y: 160 });
  }
  for (let i = 0; i < ACTIVITY_STOPS.length; i++) {
    const a = ACTIVITY_STOPS[i],
      b = ACTIVITY_STOPS[(i + 1) % ACTIVITY_STOPS.length];
    assertRoute({ x: a.x, y: a.y }, { x: b.x, y: b.y });
  }
});
test("all16 building interiors block paths and movement cannot tunnel through walls", () => {
  for (const r of OBSTACLES) {
    const inside = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    assert.equal(isWalkable(inside), false);
    assert.equal(findPath(square, inside), null);
    const from = { x: r.x - 10, y: r.y + r.height / 2 },
      to = { x: r.x + r.width + 10, y: from.y };
    const clipped = clipMove(from, to);
    assert.ok(clipped.x <= r.x - 8);
    assert.ok(isWalkable(clipped));
  }
});
test("bounds and non-finite coordinates never produce a playable route", () => {
  for (const p of [
    { x: NaN, y: 100 },
    { x: 100, y: Infinity },
    { x: -1, y: 100 },
    { x: 1201, y: 100 },
    { x: 600, y: 801 },
  ]) {
    assert.equal(isWalkable(p), false);
    assert.equal(findPath(square, p), null);
  }
  assert.equal(findPath({ x: 160, y: 100 }, square), null);
});
test("path planning preserves input positions", () => {
  const from = { ...square },
    to = { x: 160, y: 160 };
  findPath(from, to);
  clipMove(from, to);
  assert.deepEqual(from, square);
  assert.deepEqual(to, { x: 160, y: 160 });
});

test("actual client traversal reaches every spatial route without cutting wall corners", async () => {
  const { waypointReached, stepToward } = await import("../public/world.mjs");
  const destinations = ACTIVITY_STOPS.map((s) => ({ x: s.x, y: s.y }));
  const pairs = destinations.map((from, i) => [
    from,
    destinations[(i + 1) % destinations.length],
  ]);
  pairs.push(
    [
      { x: 861.83, y: 356.19 },
      { x: 920, y: 370 },
    ],
    [
      { x: 978.17, y: 356.19 },
      { x: 920, y: 370 },
    ],
  );
  for (const [from, to] of pairs) {
    let position = { ...from },
      path = findPath(position, to),
      steps = 0;
    assert.ok(path?.length);
    while (path.length && steps++ < 2000) {
      if (waypointReached(position, path[0])) path.shift();
      else {
        const candidate = stepToward(position, path[0], 190, 0.1),
          next = clipMove(position, candidate);
        assert.ok(
          Math.hypot(next.x - position.x, next.y - position.y) > 0.00001,
          `Stalled at ${JSON.stringify(position)} aiming at ${JSON.stringify(path[0])}`,
        );
        position = next;
      }
    }
    assert.equal(path.length, 0);
    assert.ok(Math.hypot(position.x - to.x, position.y - to.y) < 0.5);
  }
});

test("exact collision rejects the subpixel Night market crossing accepted by sampled visibility", () => {
  const from = { x: 896, y: 364 },
    unsafe = { x: 610, y: 550 };
  const clipped = clipMove(from, unsafe);
  assert.equal(clipped.y, 542);
  assert.ok(clipped.x > 622 && clipped.x < 623);
  assert.ok(isWalkable(clipped));
  assert.notDeepEqual(clipped, unsafe);
  const path = findPath(from, { x: 530, y: 650 });
  assert.notDeepEqual(
    path[0],
    unsafe,
    "Smoothing must reject the0.359-pixel interior crossing",
  );
  assertRoute(from, { x: 530, y: 650 });
});
test("exact collision preserves legal edges, corner tangency and the maximum safe boundary point", () => {
  for (const [from, to] of [
    [
      { x: 610, y: 542 },
      { x: 750, y: 542 },
    ],
    [
      { x: 622, y: 550 },
      { x: 622, y: 650 },
    ],
    [
      { x: 610, y: 554 },
      { x: 634, y: 530 },
    ],
  ]) {
    assert.ok(isWalkable(from));
    assert.ok(isWalkable(to));
    assert.deepEqual(clipMove(from, to), to);
  }
  assert.deepEqual(clipMove({ x: 610, y: 530 }, { x: 634, y: 554 }), {
    x: 622,
    y: 542,
  });
  assert.deepEqual(clipMove({ x: 622, y: 542 }, { x: 634, y: 554 }), {
    x: 622,
    y: 542,
  });
  assert.deepEqual(clipMove({ x: 600, y: 500 }, { x: 2000, y: 500 }), {
    x: 1170,
    y: 500,
  });
  assert.deepEqual(clipMove({ x: 600, y: 500 }, { x: 600, y: 1000 }), {
    x: 600,
    y: 770,
  });
  assert.deepEqual(clipMove({ x: 600, y: 500 }, { x: NaN, y: 500 }), {
    x: 600,
    y: 500,
  });
});
test("fractional valid starts around every door traverse every spatial site with varied step lengths", async () => {
  const { waypointReached, stepToward } = await import("../public/world.mjs");
  const { RULES } = await import("../content.mjs");
  const starts = [
    { x: 896, y: 364 },
    { x: 623.8876060459797, y: 541.6250894086784 },
    { x: 624.0018467737199, y: 541.5629034375679 },
  ];
  for (const [x, y] of DOORS)
    for (let k = 0; k < 16; k++) {
      const angle = (k * Math.PI) / 8,
        r = [0.37, 24.71, 49.83, 64.19][k % 4];
      const point = { x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r };
      if (isWalkable(point)) starts.push(point);
    }
  let checked = 0;
  for (const from of starts)
    for (const to of ACTIVITY_STOPS) {
      let position = { ...from };
      const path = findPath(from, to);
      assert.ok(path?.length, `Missing route from${JSON.stringify(from)}`);
      let frame = 0;
      while (path.length && frame++ < 2000) {
        if (waypointReached(position, path[0])) {
          path.shift();
          continue;
        }
        const accepted = clipMove(
          position,
          stepToward(
            position,
            path[0],
            RULES.moveSpeed,
            [0.0031, 0.037, 0.11, 0.201, 0.999, 1.4][frame % 6],
          ),
        );
        assert.ok(isWalkable(accepted));
        assert.ok(
          Math.hypot(accepted.x - position.x, accepted.y - position.y) > 1e-8,
          `Stall from${JSON.stringify(from)} at${JSON.stringify(position)} toward${JSON.stringify(path[0])}`,
        );
        position = accepted;
      }
      assert.equal(path.length, 0);
      assert.ok(Math.hypot(position.x - to.x, position.y - to.y) < 0.5);
      checked++;
    }
  assert.equal(checked, 1170);
});
