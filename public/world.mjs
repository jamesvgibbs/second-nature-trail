export const WIDTH = 1200,
  HEIGHT = 800,
  CELL = 10,
  RADIUS = 8;
// Door coordinates match authored districts. Buildings sit north of the doors.
export const DOORS = [
  [160, 160],
  [300, 160],
  [530, 140],
  [680, 140],
  [930, 150],
  [1080, 150],
  [170, 370],
  [310, 370],
  [920, 370],
  [1070, 370],
  [160, 630],
  [310, 630],
  [530, 650],
  [680, 650],
  [930, 630],
  [1080, 630],
];
export const OBSTACLES = DOORS.map(([x, y]) => ({
  x: x - 50,
  y: y - 100,
  width: 100,
  height: 80,
}));
export function isWalkable({ x, y }) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 30 &&
    x <= 1170 &&
    y >= 30 &&
    y <= 770 &&
    !OBSTACLES.some(
      (r) =>
        x > r.x - RADIUS &&
        x < r.x + r.width + RADIUS &&
        y > r.y - RADIUS &&
        y < r.y + r.height + RADIUS,
    )
  );
}
export function clipMove(from, to) {
  if (!isWalkable(from)) return { ...from };
  const distance = Math.hypot(to.x - from.x, to.y - from.y),
    steps = Math.max(1, Math.ceil(distance / 2));
  let result = { ...from };
  for (let i = 1; i <= steps; i++) {
    const next = {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    };
    if (!isWalkable(next)) break;
    result = next;
  }
  return result;
}
function visible(a, b) {
  const c = clipMove(a, b);
  return Math.hypot(c.x - b.x, c.y - b.y) < 0.01;
}
export function findPath(from, to) {
  if (!isWalkable(from) || !isWalkable(to)) return null;
  if (visible(from, to)) return [{ ...to }];
  const key = (x, y) => x + "," + y,
    start = { x: Math.round(from.x / CELL), y: Math.round(from.y / CELL) },
    goal = { x: Math.round(to.x / CELL), y: Math.round(to.y / CELL) };
  const point = (n) => ({ x: n.x * CELL, y: n.y * CELL });
  if (!isWalkable(point(start)) || !isWalkable(point(goal))) return null;
  const startKey = key(start.x, start.y),
    goalKey = key(goal.x, goal.y),
    open = new Set([startKey]),
    nodes = new Map([[startKey, { ...start, g: 0, f: 0 }]]),
    closed = new Set();
  let found = null;
  while (open.size) {
    let currentKey = null,
      current = null;
    for (const k of open) {
      const n = nodes.get(k);
      if (!current || n.f < current.f) {
        current = n;
        currentKey = k;
      }
    }
    open.delete(currentKey);
    if (currentKey === goalKey) {
      found = current;
      break;
    }
    closed.add(currentKey);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ]) {
      const n = { x: current.x + dx, y: current.y + dy },
        k = key(n.x, n.y);
      if (
        closed.has(k) ||
        !isWalkable(point(n)) ||
        !visible(point(current), point(n))
      )
        continue;
      const g = current.g + Math.hypot(dx, dy),
        old = nodes.get(k);
      if (!old || g < old.g) {
        nodes.set(k, {
          ...n,
          g,
          f: g + Math.hypot(n.x - goal.x, n.y - goal.y),
          parent: currentKey,
        });
        open.add(k);
      }
    }
  }
  if (!found) return null;
  const raw = [{ ...to }];
  let at = goalKey;
  while (at && at !== startKey) {
    const n = nodes.get(at);
    raw.push(point(n));
    at = n.parent;
  }
  raw.reverse();
  const result = [];
  let previous = from;
  for (let i = 0; i < raw.length; ) {
    let far = i;
    while (far + 1 < raw.length && visible(previous, raw[far + 1])) far++;
    result.push(raw[far]);
    previous = raw[far];
    i = far + 1;
  }
  return result;
}
