import { DOORS } from "./world.mjs";
import { districtScenery, ROAD_BANDS } from "./scenery.mjs";
// Personal arrival markers read only the server's durable arrival records.
export function destinationVisit(view, coordinate) {
  const [x, y] = coordinate;
  const record = view?.me?.visitedDestinations?.[`${x},${y}`];
  const reached = !!record && record.x === x && record.y === y && Number.isFinite(record.at);
  return { reached, symbol: reached ? "✓" : "?", label: reached ? "Reached" : "Unexplored" };
}
export function destinationBadgeBounds([x, y], label) {
  const signWidth = label.length * 9 + 12;
  const candidates = [
    { x: x - signWidth / 2 - 15, y: y + 25, width: 14, height: 18 },
    { x: x + signWidth / 2 + 1, y: y + 25, width: 14, height: 18 },
  ];
  const index = DOORS.findIndex(door => door[0] === x && door[1] === y);
  if (index < 0) return candidates[0];
  const district = Math.floor(index / 2);
  const obstacles = [...ROAD_BANDS, ...districtScenery(DOORS[district * 2], DOORS[district * 2 + 1], district).walks];
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  return candidates.find(candidate => !obstacles.some(obstacle => overlaps(candidate, obstacle))) || candidates[0];
}
