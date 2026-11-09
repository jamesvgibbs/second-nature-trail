import test from "node:test";
import assert from "node:assert/strict";
import { findPath, clipMove, stepToward } from "../public/world.mjs";
import { ACTIVITY_STOPS, RULES } from "../content.mjs";
import { nextWaypoint } from "../scripts/load-navigation.mjs";

function travel(from, to) {
  const path = findPath(from, to);
  assert.ok(path?.length, "A route exists");
  let position = { ...from };
  for (let frame = 0; frame < 2000; frame++) {
    if (Math.hypot(position.x - to.x, position.y - to.y) < 25) return position;
    const waypoint = nextWaypoint(position, path);
    assert.ok(waypoint, "Unreached target retains a waypoint");
    const proposed = stepToward(
      position,
      waypoint,
      RULES.moveSpeed,
      [0.065, 0.1, 0.175][frame % 3],
    );
    const accepted = clipMove(position, proposed);
    assert.ok(
      Math.hypot(accepted.x - position.x, accepted.y - position.y) > 0.001,
      `Navigation stuck at ${JSON.stringify(position)} heading to ${JSON.stringify(waypoint)}`,
    );
    position = accepted;
  }
  assert.fail("Navigation failed to reach target");
}
test("load runner follows all spatial routes using actual speed limits and collision clipping", () => {
  for (const from of ACTIVITY_STOPS)
    for (const to of ACTIVITY_STOPS) if (from !== to) travel(from, to);
});
test("load runner preserves corner waypoint until reached and recovers the recorded Willow stall", () => {
  const point = { x: 861.8301622049416, y: 356.1943584966395 },
    corner = { x: 860, y: 360 },
    home = { x: 920, y: 370 };
  const path = [corner, home];
  assert.equal(nextWaypoint(point, path), corner);
  assert.equal(path.length, 2);
  assert.equal(nextWaypoint({ x: 860, y: 359.8 }, path), home);
  travel(point, home);
  travel({ x: 930, y: 150 }, home);
  travel({ x: 978.1698377950584, y: 356.1943584966395 }, home);
});
test("routes remain traversable from actual prior-door stopping positions", () => {
  travel({ x: 896, y: 364 }, { x: 530, y: 650 });
  // Navigation ends within25px, so subsequent routes must use that actual
  // endpoint, not reset to an exact door center as isolated pair tests do.
  for (const offset of Object.values(RULES.spatialOffsets)) {
    let position = { x: 600, y: 380 };
    for (let cycle = 0; cycle < 3; cycle++)
      for (let step = 0; step < ACTIVITY_STOPS.length; step++)
        position = travel(
          position,
          ACTIVITY_STOPS[(step + offset) % ACTIVITY_STOPS.length],
        );
  }
});
