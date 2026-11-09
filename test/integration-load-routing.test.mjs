import test from "node:test";
import assert from "node:assert/strict";
import { RULES } from "../content.mjs";
import { solveRoute } from "../scripts/load-routing.mjs";

test("capacity routes include required relays, avoid broken links, and meet all three budgets", () => {
  for (let i = 0; i < RULES.routing.destinations.length; i++) {
    const task = {
      source: RULES.routing.source,
      destination: RULES.routing.destinations[i],
      edgeCosts: RULES.routing.edgeCosts,
      requiredNodes: RULES.routing.requiredNodes[i],
      blockedEdges: RULES.routing.blockedVariants[i],
      budget: RULES.routing.budgets[i],
    };
    const path = solveRoute(task);
    assert.ok(path, `Station ${i} has a valid public solution`);
    assert.equal(path[0], task.source);
    assert.equal(path.at(-1), task.destination);
    assert.equal(new Set(path).size, path.length);
    assert.ok(task.requiredNodes.every((n) => path.includes(n)));
    let cost = 0;
    for (let j = 1; j < path.length; j++) {
      const pair = [path[j - 1], path[j]];
      assert.ok(
        !task.blockedEdges.some((e) => e.every((n) => pair.includes(n))),
      );
      const edge = task.edgeCosts.find(
        (e) => pair.includes(e.from) && pair.includes(e.to),
      );
      assert.ok(edge);
      cost += edge.cost;
    }
    assert.ok(cost <= task.budget);
    assert.equal(solveRoute({ ...task, budget: 0 }), null);
  }
});
