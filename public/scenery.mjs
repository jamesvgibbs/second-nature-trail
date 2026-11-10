// Visual layout only. Door locations, movement and collision geometry stay in world.mjs.
// Bounds include the entire canopy, trunk and ground shadow.
export const TREE_FOOTPRINT = Object.freeze({ x: -18, y: -15, width: 36, height: 44 });
export const SQUARE_TREES = Object.freeze([
  [454, 326], [738, 326], [454, 440], [738, 440],
]);
export function districtScenery(firstDoor, secondDoor) {
  const [x, y] = firstDoor;
  return {
    // A planted lawn strip west of each pair of homes; no tree stands at a door.
    trees: x === 920 && y === 370
      // This block has a narrower western verge: use its two front lawns.
      ? [[854, 360], [1150, 420]]
      : [[x - 75, y - 55], [x - 75, y + 40]],
    beacon: { x: (x + secondDoor[0]) / 2, y: Math.max(y, secondDoor[1]) + 23 },
  };
}
