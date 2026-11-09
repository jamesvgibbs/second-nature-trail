// Solve only the public graph: no answer key is needed for routing.
export function solveRoute(task) {
  const queue = [{ path: [task.source], cost: 0 }];
  while (queue.length) {
    const { path, cost } = queue.shift();
    const last = path.at(-1);
    if (last === task.destination) {
      if ((task.requiredNodes || []).every((node) => path.includes(node)))
        return path;
      continue;
    }
    for (const edge of task.edgeCosts) {
      const next =
        edge.from === last ? edge.to : edge.to === last ? edge.from : null;
      if (
        !next ||
        path.includes(next) ||
        cost + edge.cost > task.budget ||
        task.blockedEdges.some(
          (blocked) => blocked.includes(last) && blocked.includes(next),
        )
      )
        continue;
      queue.push({ path: [...path, next], cost: cost + edge.cost });
    }
  }
  return null;
}
