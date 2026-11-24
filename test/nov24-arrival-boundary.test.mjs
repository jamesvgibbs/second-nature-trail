import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../engine.mjs";

test("accepted65-unit arrival endpoints cannot mark both neighboring doors, and remain private to the actual arriving player", () => {
  let now = 100000;
  const e = new Engine({ now: () => now });
  for (const id of ["a", "b"]) {
    e.addPlayer(id, id);
    e.dispatch(id, {
      type: "setup",
      requestId: "setup-" + id,
      character: 0,
      palette: 0,
      insects: false,
    });
  }
  // Explicit boundary setup, not a navigation claim: midpoint is70 from bothdoors.
  const p = e.get("a");
  p.position = { x: 230, y: 160 };
  p.lastMoveAt = now;
  now += 1000;
  e.dispatch("a", { type: "move", requestId: "middle", x: 230, y: 161 });
  assert.deepEqual(p.visitedDestinations, {});
  now += 1000;
  e.dispatch("a", { type: "move", requestId: "left-edge", x: 225, y: 160 });
  assert.deepEqual(Object.keys(p.visitedDestinations), ["160,160"]);
  assert.equal(p.visitedDestinations["160,160"].at, now);
  assert.deepEqual(e.get("b").visitedDestinations, {});
  const first = structuredClone(p.visitedDestinations["160,160"]);
  now += 1000;
  e.dispatch("a", { type: "move", requestId: "right-edge", x: 235, y: 160 });
  assert.deepEqual(Object.keys(p.visitedDestinations).sort(), [
    "160,160",
    "300,160",
  ]);
  assert.deepEqual(p.visitedDestinations["160,160"], first);
  assert.equal(
    e.state.actions.filter((a) => a.type === "destinationVisited").length,
    2,
  );
  const b = e.view("b");
  assert.deepEqual(b.me.visitedDestinations, {});
  assert(
    !b.players.some((peer) => "visitedDestinations" in peer),
    "Peer roster does not publish another player’s personal arrival history",
  );
});
