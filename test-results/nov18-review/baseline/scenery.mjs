// Visual layout only. Door locations and collision geometry stay in world.mjs.
export const TREE_FOOTPRINT = Object.freeze({ x: -18, y: -15, width: 36, height: 44 });
export const ROAD_BANDS = Object.freeze([
  { x: 0, y: 230, width: 1200, height: 28 },
  { x: 0, y: 470, width: 1200, height: 40 },
  { x: 375, y: 0, width: 40, height: 800 },
  { x: 790, y: 0, width: 40, height: 800 },
]);
export const SQUARE_TREES = Object.freeze([
  [454, 326], [738, 326], [454, 432], [738, 432],
]);
export function districtScenery(firstDoor) {
  const [x, y] = firstDoor;
  // Side lawns end where the front-yard destination signs begin.
  const treeX = x === 920 ? 850 : x - 75;
  return { trees: [[treeX, y - 55], [treeX, y - 5]] };
}
