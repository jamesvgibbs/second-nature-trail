import test from "node:test";
import assert from "node:assert/strict";
import { FrameRecorder } from "../public/performance.mjs";

test("frame measurement counts long visible stalls and excludes hidden/paused partial windows", () => {
  const r = new FrameRecorder();
  for (let i = 0; i < 60; i++) r.frame((i * 1000) / 60, "chapter");
  r.frame(1000, "chapter");
  assert.equal(r.report().percentAtLeast30FPS, 100);
  r.frame(4100, "chapter");
  assert.deepEqual(
    r.report().windows.map((w) => w.frames),
    [60, 1, 0, 0],
  );
  assert.equal(r.report().percentAtLeast30FPS, 25);
  r.frame(4200, "chapter", false);
  r.frame(9000, "chapter");
  r.frame(9500, "paused");
  r.frame(20000, "finale");
  assert.equal(r.report().measuredSeconds, 4);
  for (let i = 1; i <= 30; i++) r.frame(20000 + (i * 1000) / 30, "finale");
  assert.equal(r.report().measuredSeconds, 5);
  assert.equal(r.report().secondsAtLeast30FPS, 2);
  assert.equal(r.report().meetsMeasuredThreshold, false);
});
