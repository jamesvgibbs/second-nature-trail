// Visual layout only. Door locations and collision geometry stay in world.mjs.
import { DOORS } from './world.mjs';
import { SITE_LABELS } from './trail-visuals.mjs';

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
export function siteSignBounds([x, y], label) {
  const width = label.length * 9 + 12;
  return { x: x - width / 2, y: y + 24, width, height: 21 };
}
const YARD_KINDS = [
  ['parcels', 'handcart'], ['herb-bed', 'air-unit'],
  ['noticeboard', 'bench'], ['rain-barrels', 'flower-bed'],
  ['planters', 'laundry'], ['barrels', 'bicycle'],
  ['produce', 'picnic-table'], ['cable-spools', 'solar-panel'],
];
export function districtScenery(firstDoor, secondDoor, district) {
  district ??= Math.floor(DOORS.findIndex(([x, y]) => x === firstDoor[0] && y === firstDoor[1]) / 2);
  secondDoor ??= DOORS[district * 2 + 1];
  const [x, y] = firstDoor, [otherX] = secondDoor;
  const signs = [firstDoor, secondDoor].map((door, site) => siteSignBounds(door, SITE_LABELS[district][site]));
  const frontY = y + (district === 0 ? 0 : 8), north = y > 510, curbY = north ? 510 : y < 230 ? 230 : 470;
  // Southbound branches pass through the actual gap between both nameplates.
  // Southern lots turn north between the buildings to the existing street.
  const junctionX = district === 0 ? 230 : north ? (x + otherX) / 2 : Math.round((signs[0].x + signs[0].width + signs[1].x) / 2);
  const walks = [
    { x: x - 6, y: frontY - 6, width: otherX - x + 12, height: 12 },
    { x: junctionX - 6, y: Math.min(frontY - 6, curbY), width: 12, height: north ? frontY + 6 - curbY : curbY - frontY + 6 },
    ...[firstDoor, secondDoor].map(([dx, dy]) => ({ x: dx - 6, y: dy - 12, width: 12, height: frontY - dy + 18 })),
  ];
  // The eight-pixel threshold joins the painted facade. It is decoration inside
  // the existing collision apron; navigable centerlines start at its lower edge.
  const thresholds = [firstDoor, secondDoor].map(([dx, dy]) => ({ x: dx - 6, y: dy - 20, width: 12, height: 8 }));
  const walkRoutes = [firstDoor, secondDoor].map(([dx, dy]) => [
    { x: dx, y: dy - 12 }, { x: dx, y: frontY },
    { x: junctionX, y: frontY }, { x: junctionX, y: curbY },
  ]);
  const treeX = x === 920 ? 850 : x - 75;
  return {
    signs, walks, thresholds, walkRoutes,
    trees: [[treeX, y - 55, district % 3], [treeX, y - 5, (district + 1) % 3]],
    props: [
      { kind: YARD_KINDS[district][0], x: x === 920 ? 834 : x - 92, y: y + 54, width: 42, height: 14 },
      { kind: YARD_KINDS[district][1], x: otherX + 12, y: y + 52, width: 38, height: 14 },
    ],
  };
}
