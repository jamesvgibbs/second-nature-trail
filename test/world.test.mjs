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
