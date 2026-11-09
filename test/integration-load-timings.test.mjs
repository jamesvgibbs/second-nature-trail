import test from "node:test";
import assert from "node:assert/strict";
import { createTimingRecorder, quantile } from "../scripts/load-timings.mjs";

test("timing artifact recomputes the exact historical percentile convention", () => {
  const recorder = createTimingRecorder();
  for (let i = 100; i >= 1; i--)
    recorder.record({
      requestId: `test-${i}`,
      type: i % 2 ? "move" : "task",
      durationMs: i,
      result: { correct: true },
    });
  const artifact = recorder.export({ syntheticPriorActions: 10000 });
  const all = artifact.records.map((r) => r.durationMs).sort((a, b) => a - b);
  const scoring = artifact.records
    .filter((r) => r.scoringInventory)
    .map((r) => r.durationMs)
    .sort((a, b) => a - b);
  assert.equal(quantile(all, 0.5), 51);
  assert.equal(quantile(all, 0.95), 96);
  assert.equal(quantile(scoring, 0.95), 96);
  assert.equal(scoring.length, 50);
  assert.equal(artifact.recordCount, 100); // Synthetic prefill is metadata, never a measured sample.
  assert.equal(quantile([], 0.95), null);
  assert.equal(quantile([7], 1), 7);
});
test("bounded raw timing coverage is explicit and secrets are excluded", () => {
  const recorder = createTimingRecorder(2);
  const input = {
    requestId: "sample",
    type: "quiz",
    durationMs: 12,
    httpStatus: 200,
    cookie: "private",
    token: "private",
    answer: "private",
    result: { correct: false, message: "private", token: "private" },
  };
  recorder.record(input);
  recorder.record(input);
  recorder.record(input);
  const artifact = recorder.export({ sourceHashes: { example: "hash" } });
  assert.equal(artifact.complete, false);
  assert.equal(artifact.dropped, 1);
  assert.equal(artifact.recordCount, 2);
  assert.equal(JSON.stringify(artifact).includes("private"), false);
  assert.deepEqual(artifact.records[0].outcome, {
    accepted: true,
    correct: false,
    complete: null,
    tradeStatus: null,
  });
  assert.throws(() => createTimingRecorder(0));
  assert.throws(() => recorder.record({ ...input, durationMs: NaN }));
});
