import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./client-simulation-fixture.mjs";
function recorder(f) {
  const create = f.document.createElement,
    paint = [];
  f.document.createElement = (tag) => {
    const node = create(tag);
    if (tag === "canvas") {
      const records = [];
      paint.push(records);
      node.getContext = () => ({
        fillRect(x, y, w, h) {
          records.push({ x, y, w, h, color: this.fillStyle });
        },
        fillText(text, x, y) {
          records.push({ text, x, y });
        },
      });
    }
    return node;
  };
  return paint;
}

test("actual target canvases use replacement robots for every round without changing target IDs, warning cues or selection", () => {
  const f = fixture(4),
    paint = recorder(f);
  for (let round = 0; round < 6; round++) {
    if (round) f.time(f.context.state.chapter.task.nextRoundAt);
    const task = f.context.state.chapter.task;
    f.context.showActivity("activity");
    f.context.safe = true;
    paint.length = 0;
    f.context.drawTargets(task);
    const safePaint = structuredClone(paint),
      safeButtons = f.ids
        .get("#targets")
        .children.map((b) => ({
          id: b.dataset.targetId,
          label: b.attributes["aria-label"],
        }));
    assert.equal(safePaint.length, 3);
    assert(
      safePaint.every((shapes) =>
        shapes.some(
          (r) => r.x === 25 && r.y === 21 && r.w === 40 && r.h === 19,
        ),
      ),
      "Every replacement has the robot head",
    );
    assert(
      safePaint.every((shapes) => shapes.every((r) => r.color !== "#516348")),
      "No insect body/leg paint in replacement mode",
    );
    assert.equal(safePaint.flat().filter((r) => r.text === "!").length, 1);
    f.context.safe = false;
    paint.length = 0;
    f.context.drawTargets(task);
    assert.deepEqual(
      f.ids
        .get("#targets")
        .children.map((b) => ({
          id: b.dataset.targetId,
          label: b.attributes["aria-label"],
        })),
      safeButtons,
    );
    assert.equal(
      paint.filter((shapes) => shapes.some((r) => r.color === "#516348"))
        .length,
      1,
      "Explicit enabled mode changes only marked target art",
    );
    assert.equal(paint.flat().filter((r) => r.text === "!").length, 1);
    const selected = f.ids.get("#targets").children[1];
    selected.onclick();
    assert.equal(String(f.context.selection), safeButtons[1].id);
    assert.equal(f.document.activeElement.dataset.targetId, safeButtons[1].id);
    assert.equal(
      f.requests.length,
      0,
      "Selecting a silhouette does not submit a hit",
    );
  }
});

test("actual accepted stale insect preference cannot paint insects under local replacement or presentation policy", () => {
  for (const policy of ["local replacement", "presentation"]) {
    const f = fixture(4),
      paint = recorder(f);
    f.engine.get("neighbor").insects = true;
    f.context.forceSafe = policy === "local replacement";
    f.context.isPresentation = policy === "presentation";
    f.context.safe = false;
    f.send();
    assert.equal(f.context.safe, true, policy);
    f.context.showActivity("activity");
    paint.length = 0;
    f.context.drawTargets(f.context.state.chapter.task);
    assert(
      paint.flat().every((r) => r.color !== "#516348"),
      policy,
    );
  }
});
