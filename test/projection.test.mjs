import test from "node:test";
import assert from "node:assert/strict";
import { createProjection, reduceProjection } from "../public/projection.mjs";
const point = (x, y = 360) => ({ x, y });
const full = (
  version,
  {
    epoch = "run-a",
    position = point(850, 350),
    step = 0,
    peerX = 50,
    serverTime = 1000,
  } = {},
) => ({
  projectionEpoch: epoch,
  projectionVersion: version,
  serverTime,
  event: { chapter: 1, phase: "chapter" },
  me: { id: "self", position, progress: [{ step }], inventory: { parts: 3 } },
  chapter: { task: { step } },
  trades: [],
  players: [
    { id: "self", position },
    { id: "peer", position: point(peerX) },
  ],
  world: ["shared-world"],
  rules: { moveSpeed: 190 },
  standings: [],
});
const patch = (version, options) => {
  const { players, world, rules, standings, ...value } = full(version, options);
  return value;
};
const move = (version, position, epoch = "run-a") => ({
  projectionEpoch: epoch,
  projectionVersion: version,
  position,
});
const bootstrap = () =>
  reduceProjection(createProjection(), full(1), { allowEpoch: true });

test("delayed SSE cannot rewind a corner already reached and removed from a path", () => {
  let p = bootstrap();
  const path = [point(860), point(920, 370)];
  p = reduceProjection(p, move(3, point(860)), { kind: "move" });
  if (
    Math.hypot(
      p.state.me.position.x - path[0].x,
      p.state.me.position.y - path[0].y,
    ) < 0.5
  )
    path.shift();
  p = reduceProjection(p, full(2, { peerX: 60 }));
  assert.deepEqual(p.state.me.position, point(860));
  assert.deepEqual(p.state.players[0].position, point(860));
  assert.deepEqual(path, [point(920, 370)]);
  assert.equal(p.state.players[1].position.x, 60);
});

test("equal wall times do not roll back committed progress and a patch retains shared fields", () => {
  let p = bootstrap();
  p = reduceProjection(p, patch(3, { step: 1 }), { kind: "patch" });
  p = reduceProjection(p, full(2, { step: 0, peerX: 70 }));
  assert.equal(p.state.me.progress[0].step, 1);
  assert.equal(p.state.chapter.task.step, 1);
  assert.equal(p.state.players[1].position.x, 70);
  assert.deepEqual(p.state.world, ["shared-world"]);
  assert.equal(p.coreVersion, 3);
  assert.equal(p.fullVersion, 2);
});

test("reversed movement acknowledgments cannot rewind position", () => {
  let p = reduceProjection(bootstrap(), move(5, point(890)), { kind: "move" });
  const newer = p;
  p = reduceProjection(p, move(4, point(870)), { kind: "move" });
  assert.equal(p, newer);
  assert.deepEqual(p.state.me.position, point(890));
});

test("frequent movement cannot starve full-view peer and phase refreshes", () => {
  let p = bootstrap();
  for (let n = 2; n < 10; n += 2) {
    p = reduceProjection(p, move(n + 1, point(850 + n)), { kind: "move" });
    p = reduceProjection(
      p,
      full(n, { peerX: n, step: n, serverTime: 1000 - n }),
    );
    assert.equal(p.state.players[1].position.x, n);
    assert.equal(p.state.me.position.x, 850 + n);
    assert.equal(p.state.me.progress[0].step, n);
  }
});

test("epoch changes require an authorized full bootstrap and reject late old HTTP", () => {
  const before = bootstrap();
  assert.equal(
    reduceProjection(before, move(50, point(100), "run-b"), {
      kind: "move",
      allowEpoch: true,
    }),
    before,
  );
  assert.equal(reduceProjection(before, full(1, { epoch: "run-b" })), before);
  let p = reduceProjection(
    before,
    full(1, { epoch: "run-b", position: point(500) }),
    { allowEpoch: true },
  );
  const restarted = p;
  p = reduceProjection(p, patch(900, { epoch: "run-a", step: 99 }), {
    kind: "patch",
  });
  p = reduceProjection(p, move(901, point(100), "run-a"), { kind: "move" });
  assert.equal(p, restarted);
  assert.equal(p.epoch, "run-b");
  assert.deepEqual(p.state.me.position, point(500));
});

test("unversioned input and duplicates are rejected without mutation", () => {
  const original = bootstrap();
  const copy = structuredClone(original);
  assert.equal(
    reduceProjection(original, { position: point(1) }, { kind: "move" }),
    original,
  );
  assert.equal(reduceProjection(original, full(1)), original);
  const newer = reduceProjection(original, full(2, { position: point(900) }));
  assert.notEqual(newer, original);
  assert.deepEqual(original, copy);
});
