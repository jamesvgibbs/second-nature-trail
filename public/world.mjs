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
// Intersect the segment with each rectangle's OPEN interior. Walking along an
// edge or touching a single corner is legal, matching isWalkable exactly.
// Sampling is not sufficient: a valid-looking long segment can cross less than
// a pixel of a corner and then become blocked when traversed in shorter pieces.
function firstObstacleEntry(from, to, maxT = 1) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  let first = null;
  for (const r of OBSTACLES) {
    const left = r.x - RADIUS,
      right = r.x + r.width + RADIUS;
    const top = r.y - RADIUS,
      bottom = r.y + r.height + RADIUS;
    if (
      (dx === 0 && (from.x <= left || from.x >= right)) ||
      (dy === 0 && (from.y <= top || from.y >= bottom))
    )
      continue;
    const xEnter =
      dx === 0
        ? -Infinity
        : Math.min((left - from.x) / dx, (right - from.x) / dx);
    const xExit =
      dx === 0
        ? Infinity
        : Math.max((left - from.x) / dx, (right - from.x) / dx);
    const yEnter =
      dy === 0
        ? -Infinity
        : Math.min((top - from.y) / dy, (bottom - from.y) / dy);
    const yExit =
      dy === 0
        ? Infinity
        : Math.max((top - from.y) / dy, (bottom - from.y) / dy);
    const enter = Math.max(0, xEnter, yEnter),
      exit = Math.min(maxT, xExit, yExit);
    if (!(enter < exit) || (first && enter >= first.t)) continue;
    first = { t: enter };
    // Snap the entering coordinate to the exact legal boundary. This avoids
    // rounding the returned point a fraction inside the wall on a later frame.
    if (xEnter === enter) first.x = dx > 0 ? left : right;
    if (yEnter === enter) first.y = dy > 0 ? top : bottom;
  }
  return first;
}
export function clipMove(from, to) {
  if (!isWalkable(from) || !Number.isFinite(to.x) || !Number.isFinite(to.y))
    return { ...from };
  const dx = to.x - from.x,
    dy = to.y - from.y;
  let limit = 1,
    boundary = {};
  for (const [axis, delta, min, max] of [
    ["x", dx, 30, 1170],
    ["y", dy, 30, 770],
  ]) {
    if (!delta) continue;
    const edge = to[axis] < min ? min : to[axis] > max ? max : null;
    if (edge === null) continue;
    const t = (edge - from[axis]) / delta;
    if (t < limit) {
      limit = t;
      boundary = { [axis]: edge };
    } else if (t === limit) boundary[axis] = edge;
  }
  const hit = firstObstacleEntry(from, to, limit);
  if (hit) {
    const result = { x: from.x + dx * hit.t, y: from.y + dy * hit.t };
    if (hit.x !== undefined) result.x = hit.x;
    if (hit.y !== undefined) result.y = hit.y;
    return result;
  }
  return limit === 1
    ? { ...to }
    : { x: from.x + dx * limit, y: from.y + dy * limit, ...boundary };
}
function visible(a, b) {
  return isWalkable(a) && isWalkable(b) && firstObstacleEntry(a, b) === null;
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
  // A fractional player position may not see the first grid neighbor around a
  // corner. Preserve its connector to the rounded start node before smoothing.
  if (!visible(from, point(start))) return null;
  raw.unshift(point(start));
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
// Shared traversal helpers keep browser and test bots from cutting a wall corner.
export function waypointReached(position, waypoint) {
  return Math.hypot(waypoint.x - position.x, waypoint.y - position.y) < 0.5;
}
export function stepToward(position, waypoint, speed, elapsed) {
  const dx = waypoint.x - position.x,
    dy = waypoint.y - position.y,
    d = Math.hypot(dx, dy);
  if (!d) return { ...position };
  const step = Math.min(Math.max(0, speed * elapsed), d);
  return { x: position.x + (dx / d) * step, y: position.y + (dy / d) * step };
}
