import test from "node:test";
import assert from "node:assert/strict";
import { routeSummary } from "../public/helpers.mjs";
const task = {
  edges: [
    ["exchange", "relay"],
    ["relay", "home"],
    ["exchange", "home"],
  ],
  blockedEdges: [["exchange", "home"]],
  requiredNodes: ["relay"],
  edgeCosts: [
    { from: "exchange", to: "relay", cost: 3 },
    { from: "relay", to: "home", cost: 4 },
    { from: "exchange", to: "home", cost: 1 },
  ],
};
test("route preview totals undirected costs and exposes required relays and broken links", () => {
  assert.deepEqual(routeSummary(task, ["exchange", "relay", "home"]), {
    cost: 7,
    invalid: false,
    missing: [],
  });
  assert.deepEqual(routeSummary(task, ["home", "relay", "exchange"]), {
    cost: 7,
    invalid: false,
    missing: [],
  });
  assert.deepEqual(routeSummary(task, ["exchange", "home"]), {
    cost: 1,
    invalid: true,
    missing: ["relay"],
  });
  assert.equal(routeSummary(task, ["exchange", "unknown"]).invalid, true);
  assert.equal(routeSummary(task, ["exchange", "exchange"]).invalid, true);
});
