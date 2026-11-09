import test from "node:test";
import assert from "node:assert/strict";
import { restorationProgress } from "../public/helpers.mjs";

test("shared restoration follows completed objectives against the fixed server target", () => {
  const event = {
    restoration: { perDistrict: 20 },
    contributions: [5, 10, 15, 20, 0, 0, 0, 0],
  };
  const result = restorationProgress(event);
  assert.deepEqual(result.districts, [0.25, 0.5, 0.75, 1, 0, 0, 0, 0]);
  assert.equal(result.completed, 50);
  assert.equal(result.percent, 31);
  assert.deepEqual(
    restorationProgress({ ...event, connectedPlayers: 1 }),
    result,
  );
  assert.equal(
    restorationProgress({
      restoration: { perDistrict: 20 },
      contributions: Array(8).fill(20),
    }).percent,
    100,
  );
  assert.equal(
    restorationProgress({
      restoration: { perDistrict: 20 },
      contributions: Array(8).fill(21),
    }).percent,
    100,
  );
});
