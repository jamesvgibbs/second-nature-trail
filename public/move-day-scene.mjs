// An illustrated view of the existing Move Day task, never a second game world.
const GRID = 4;
const clamp = (value) => Math.max(0, Math.min(1, value));
const point = (x, y) => ({ x, y });
const paved = [
  [352, 592],
  [424, 492],
  [432, 368],
  [512, 288],
  [640, 248],
  [776, 256],
  [872, 312],
  [896, 408],
  [904, 480],
  [936, 528],
  [984, 552],
];
const rough = [
  [352, 592],
  [448, 596],
  [528, 584],
  [612, 600],
  [684, 584],
  [760, 600],
  [848, 576],
  [928, 568],
  [984, 552],
];
const departure = [
  [172, 520],
  [224, 568],
  [292, 592],
  [352, 592],
];
const companionAnchors = [
  [424, 716],
  [488, 736],
  [552, 716],
];
const palette = {
  ink: "#203536",
  sky: "#bcc9b1",
  distance: "#81958c",
  ground: "#789170",
  shade: "#647f65",
  grass: "#8fa37a",
  verge: "#c0b991",
  road: "#64716d",
  roadEdge: "#465c57",
  line: "#e5d5a1",
  earth: "#9d7c59",
  rut: "#665748",
  timber: "#80654b",
  paper: "#f3e9ca",
  amber: "#d29a55",
  mint: "#b6d18f",
  wall: "#657773",
  roof: "#304e50",
};
function freeze(value) {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
export const MOVE_DAY_GEOMETRY = freeze({
  width: 1200,
  height: 800,
  grid: GRID,
  depot: { x: 64, y: 340, width: 224, height: 160 },
  home: { x: 960, y: 296, width: 184, height: 152 },
  depotDoor: { x: 152, y: 432, width: 40, height: 68 },
  homeDoor: { x: 1036, y: 388, width: 32, height: 60 },
  fork: point(352, 592),
  rejoin: point(984, 552),
  routes: {
    scenic: {
      points: paved,
      width: 56,
      shoulder: 72,
      checkpoint: point(640, 248),
    },
    shortcut: {
      points: rough,
      width: 36,
      shoulder: 48,
      checkpoint: point(612, 600),
    },
  },
  departure,
  companionAnchors: companionAnchors.map(([x, y]) => point(x, y)),
  layby: { x: 384, y: 676, width: 216, height: 108 },
  hotspots: [
    {
      id: "depot",
      action: "objective",
      x: 48,
      y: 300,
      width: 256,
      height: 216,
    },
    {
      id: "paved",
      action: "objective",
      route: "scenic",
      x: 488,
      y: 344,
      width: 304,
      height: 60,
    },
    {
      id: "shortcut",
      action: "objective",
      route: "shortcut",
      x: 728,
      y: 644,
      width: 336,
      height: 60,
    },
    {
      id: "home",
      action: "objective",
      x: 936,
      y: 256,
      width: 232,
      height: 212,
    },
  ],
});
const distanceToSegment = (x, y, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    d = dx * dx + dy * dy;
  const t = d ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / d) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
};
// Precomputed scanline runs keep every road edge on the same four-pixel grid.
function rasterStroke(points, width) {
  const runs = [];
  for (let y = 0; y < 800; y += GRID) {
    let start = -1;
    for (let x = 0; x <= 1200; x += GRID) {
      const inside =
        x < 1200 &&
        points
          .slice(1)
          .some(
            (b, i) =>
              distanceToSegment(x + 2, y + 2, points[i], b) <= width / 2,
          );
      if (inside && start < 0) start = x;
      if (!inside && start >= 0) {
        runs.push([start, y, x - start, GRID]);
        start = -1;
      }
    }
  }
  return runs;
}
const roadPaint = freeze({
  pavedVerge: rasterStroke(paved, 72),
  paved: rasterStroke(paved, 56),
  roughVerge: rasterStroke(rough, 48),
  rough: rasterStroke(rough, 36),
  departureVerge: rasterStroke(departure, 68),
  departure: rasterStroke(departure, 52),
});
export const MOVE_DAY_ROAD_PAINT = roadPaint;
function along(points, fraction) {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let remaining = clamp(fraction) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] ? remaining / lengths[i] : 0;
      return point(
        points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        points[i][1] + (points[i + 1][1] - points[i][1]) * t,
      );
    }
    remaining -= lengths[i];
  }
  return point(...points[0]);
}
function fractionBetween(position, from, to) {
  if (!position || !from || !to) return 0;
  const dx = to.x - from.x,
    dy = to.y - from.y,
    d = dx * dx + dy * dy;
  return d
    ? clamp(((position.x - from.x) * dx + (position.y - from.y) * dy) / d)
    : 0;
}
export function moveDaySceneModel(state, options = {}) {
  const event = state?.event || {},
    me = state?.me || {},
    progress = me.progress?.[0] || {},
    delivery = progress.delivery || {};
  const phase = event.phase,
    paused = phase === "paused" || event.paused === true;
  const available =
    event.chapter === 0 &&
    (phase === "chapter" ||
      (phase === "paused" && event.pausedPhase === "chapter"));
  const stage = ["load", "route", "travel", "deliver"].includes(delivery.stage)
    ? delivery.stage
    : "load";
  const selectedRoute = ["scenic", "shortcut"].includes(delivery.route)
    ? delivery.route
    : null;
  const completedDeliveries = Math.max(
    0,
    Number.isSafeInteger(progress.step) ? progress.step : 0,
  );
  const totalDeliveries = Number.isSafeInteger(state?.chapter?.taskCount)
    ? state.chapter.taskCount
    : 3;
  const complete = progress.complete === true;
  const peers = [
    ...new Map(
      (state?.players || [])
        .filter(
          (p) =>
            p.id &&
            p.id !== me.id &&
            p.connected !== false &&
            p.setup !== false,
        )
        .map((p) => [String(p.id), p]),
    ).values(),
  ].sort((a, b) =>
    String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0,
  );
  const nearby = peers.filter(
    (p) =>
      Number.isFinite(p.position?.x) &&
      Number.isFinite(p.position?.y) &&
      Number.isFinite(me.position?.x) &&
      Number.isFinite(me.position?.y) &&
      Math.hypot(p.position.x - me.position.x, p.position.y - me.position.y) <=
        220,
  );
  const teammates = nearby
    .slice(0, 3)
    .map((p, i) => ({
      id: p.id,
      character: p.character,
      palette: p.palette,
      ...MOVE_DAY_GEOMETRY.companionAnchors[i],
      selected: options.focusedPeerId === p.id,
      name:
        options.focusedPeerId === p.id ? String(p.name || "Neighbor") : null,
    }));
  const denominator = Math.max(1, Number(event.restoration?.perDistrict) || 1),
    contributions = Math.max(0, Number(event.contributions?.[0]) || 0);
  const sharedRecovery = {
    completed: contributions,
    total: denominator,
    ratio: clamp(contributions / denominator),
  };
  const route = selectedRoute || "scenic",
    routePoints = MOVE_DAY_GEOMETRY.routes[route].points;
  const checkpointIndex = route === "scenic" ? 4 : 3;
  const depot = state?.chapter?.locations?.[0],
    home = state?.chapter?.locations?.[1],
    crossing = state?.rules?.deliveryCheckpoints?.[route];
  let cartPose = point(256, 584),
    travelFraction = 0;
  if (stage === "route") cartPose = point(352, 592);
  if (stage === "travel") {
    travelFraction = fractionBetween(me.position, depot, crossing);
    cartPose = along(routePoints.slice(0, checkpointIndex + 1), travelFraction);
  } else if (stage === "deliver") {
    travelFraction = fractionBetween(me.position, crossing, home);
    cartPose = along(
      [...routePoints.slice(checkpointIndex), [1048, 552], [1048, 484]],
      travelFraction,
    );
  } else if (stage === "load" && completedDeliveries > 0) {
    travelFraction = fractionBetween(me.position, home, depot);
    cartPose = along(
      [[1048, 484], [1048, 552], ...rough.slice().reverse(), [256, 584]],
      travelFraction,
    );
  }
  if (complete) cartPose = point(1048, 492);
  cartPose = {
    x: Math.round(cartPose.x / GRID) * GRID,
    y: Math.round(cartPose.y / GRID) * GRID,
  };
  const nextStop =
    available && !complete && (stage === "travel" || stage === "deliver")
      ? {
          ...(stage === "travel"
            ? MOVE_DAY_GEOMETRY.routes[route].checkpoint
            : point(1048, 484)),
          kind: stage === "travel" ? "crossing" : "delivery",
        }
      : null;
  const active = available && !paused && !complete;
  const hotspots = MOVE_DAY_GEOMETRY.hotspots.map((h) => ({
    ...h,
    enabled: active && (!h.route || stage === "route"),
  }));
  if (nextStop)
    hotspots.push({
      id: "next-stop",
      action: "objective",
      x: nextStop.x + 48,
      y: nextStop.y - 64,
      width: 104,
      height: 88,
      enabled: active,
    });
  hotspots.push({
    id: "cart",
    action: "objective",
    x: cartPose.x - 60,
    y: cartPose.y - 72,
    width: 136,
    height: 104,
    enabled: active,
  });
  return {
    available,
    phase,
    paused,
    stage,
    complete,
    completedDeliveries,
    totalDeliveries,
    selectedRoute,
    loadedCargo: delivery.loaded ? { ...delivery.loaded } : null,
    homeRestored: completedDeliveries > 0,
    sharedRecovery,
    teammates,
    teammateCount: peers.length,
    nearbyCount: nearby.length,
    nextStop,
    cartPose,
    travelFraction,
    hotspots,
  };
}
export function hitMoveDayHotspot(model, x, y) {
  return (
    [...(model?.hotspots || [])]
      .reverse()
      .find(
        (h) =>
          h.enabled &&
          x >= h.x &&
          x <= h.x + h.width &&
          y >= h.y &&
          y <= h.y + h.height,
      ) || null
  );
}
export function drawMoveDayScene(ctx, state, options = {}) {
  const model = moveDaySceneModel(state, options),
    p = palette;
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const runs = (items, color) => items.forEach((r) => rect(...r, color));
  const label = (text, x, y, size = 24, color = p.ink) => {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  };
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  rect(0, 0, 1200, 800, p.ground);
  rect(0, 0, 1200, 160, p.sky);
  // Low distant ridge and a silent, disconnected control tower.
  [
    [0, 144, 176, 32],
    [176, 128, 144, 48],
    [320, 148, 216, 28],
    [536, 136, 160, 40],
    [696, 152, 192, 24],
    [888, 136, 312, 40],
  ].forEach((r) => rect(...r, p.distance));
  rect(1060, 84, 16, 68, p.distance);
  rect(1036, 72, 64, 16, p.distance);
  rect(1048, 52, 40, 20, p.distance);
  rect(1064, 28, 8, 24, p.distance);
  rect(0, 176, 1200, 8, p.shade);
  // Broad ground tones, not a tiled board. All edges use the same pixel grid.
  rect(0, 684, 1200, 116, p.shade);
  rect(0, 676, 272, 8, p.shade);
  rect(1088, 628, 112, 48, p.shade);
  rect(440, 432, 388, 96, p.grass);
  rect(472, 416, 324, 16, p.grass);
  rect(496, 528, 272, 12, p.grass);
  runs(roadPaint.departureVerge, p.verge);
  runs(roadPaint.pavedVerge, p.verge);
  runs(roadPaint.roughVerge, p.verge);
  runs(roadPaint.departure, p.road);
  runs(roadPaint.paved, p.road);
  runs(roadPaint.rough, p.earth);
  // Entrances visibly meet their approach, without a road painted under a wall.
  rect(144, 500, 56, 24, p.road);
  rect(984, 536, 80, 32, p.road);
  rect(1032, 448, 32, 116, p.road);
  for (const fraction of [
    0.13, 0.22, 0.31, 0.4, 0.49, 0.58, 0.67, 0.76, 0.85,
  ]) {
    const at = along(paved, fraction);
    rect(Math.round(at.x / 4) * 4 - 8, Math.round(at.y / 4) * 4, 16, 4, p.line);
  }
  // The shortcut has exposed earth, uneven edges and three broken crossings.
  [
    [484, 588, 28, 4],
    [548, 596, 36, 4],
    [716, 592, 32, 4],
    [820, 576, 28, 4],
    [896, 572, 20, 4],
  ].forEach((r) => rect(...r, p.rut));
  for (const [x, y] of [
    [580, 592],
    [656, 584],
    [792, 584],
  ]) {
    rect(x, y - 12, 8, 12, p.rut);
    rect(x + 8, y, 12, 8, p.rut);
    rect(x + 20, y + 8, 8, 8, p.rut);
  }
  // Sparse trees, individually placed clear of roads, entrances and the fork.
  function tree(x, y, small = false) {
    const s = small ? 0.75 : 1;
    const trunkRect = rect;
    const aligned = (x, y, w, h, c) =>
      trunkRect(
        Math.round(x / 4) * 4,
        Math.round(y / 4) * 4,
        Math.round(w / 4) * 4,
        Math.round(h / 4) * 4,
        c,
      );
    aligned(x - 28 * s, y + 12 * s, 64 * s, 16 * s, p.shade);
    aligned(x - 4 * s, y - 20 * s, 12 * s, 40 * s, p.timber);
    aligned(x - 32 * s, y - 64 * s, 64 * s, 28 * s, p.roof);
    aligned(x - 44 * s, y - 40 * s, 88 * s, 28 * s, p.roof);
    aligned(x - 24 * s, y - 60 * s, 44 * s, 16 * s, p.shade);
  }
  tree(56, 236, true);
  tree(340, 236);
  tree(824, 188, true);
  tree(1160, 596, true);
  // Depot: deep loading doorway, slatted timber and a single hand-painted sign.
  rect(56, 496, 248, 16, p.shade);
  rect(64, 340, 224, 160, p.timber);
  rect(64, 340, 224, 12, p.paper);
  for (let y = 364; y < 488; y += 24) rect(68, y, 216, 4, "#6b5945");
  rect(48, 324, 256, 20, p.roof);
  rect(72, 304, 208, 20, p.roof);
  rect(100, 292, 152, 12, p.roof);
  rect(148, 424, 48, 76, p.ink);
  rect(148, 424, 8, 76, p.line);
  rect(188, 424, 8, 76, p.line);
  rect(156, 496, 32, 20, p.road);
  rect(96, 356, 160, 40, p.paper);
  label("DEPOT", 176, 376, 28);
  rect(80, 448, 40, 44, p.line);
  rect(84, 452, 32, 4, p.timber);
  rect(96, 448, 4, 44, p.timber);
  rect(224, 456, 40, 36, p.amber);
  rect(228, 460, 32, 4, p.timber);
  rect(240, 456, 4, 36, p.timber);
  // One home. Personal delivery warms the window; group work fixes the fence.
  rect(948, 448, 208, 16, p.shade);
  rect(960, 296, 184, 152, model.homeRestored ? "#a9bb8c" : p.wall);
  rect(960, 296, 184, 12, model.homeRestored ? p.mint : "#85938b");
  rect(936, 280, 232, 32, p.roof);
  rect(960, 260, 184, 20, p.roof);
  rect(984, 244, 136, 16, p.roof);
  rect(1104, 236, 16, 40, p.ink);
  rect(1032, 384, 40, 64, p.ink);
  rect(1036, 388, 32, 60, model.homeRestored ? p.timber : p.roof);
  rect(1060, 416, 4, 8, p.line);
  rect(1036, 448, 28, 20, p.road);
  for (const x of [980, 1092]) {
    rect(x, 336, 32, 36, p.ink);
    rect(x + 4, 340, 24, 28, model.homeRestored ? "#f3d48b" : "#435c5b");
    rect(x + 12, 340, 4, 28, p.ink);
    rect(x + 4, 352, 24, 4, p.ink);
  }
  if (model.homeRestored) {
    rect(988, 404, 24, 12, p.mint);
    rect(992, 396, 4, 8, p.mint);
    rect(1004, 392, 4, 12, p.mint);
  } else {
    rect(976, 396, 36, 8, p.timber);
    rect(988, 392, 8, 20, p.timber);
  }
  // A resident waits on the raised porch. Only a saved personal delivery fills
  // the supply crate and changes their greeting; shared fence progress is separate.
  rect(1080, 420, 76, 12, p.timber);
  rect(1088, 432, 8, 16, p.timber);
  rect(1140, 432, 8, 16, p.timber);
  rect(1080, 400, 28, 20, p.timber);
  rect(1084, 404, 20, 12, model.homeRestored ? p.paper : p.roof);
  if (model.homeRestored) rect(1092, 400, 4, 20, p.amber);
  person(1132, 404, model.homeRestored ? p.mint : p.amber);
  rect(1148, model.homeRestored ? 380 : 396, 8, model.homeRestored ? 20 : 12, "#d8b88b");
  // Six fence spans are an illustration of the ratio, never additional awards.
  for (let i = 0; i < 6; i++) {
    const x = 908 + i * 44,
      restored = model.sharedRecovery.ratio >= (i + 1) / 6;
    rect(x, 208, 8, 24, restored ? p.mint : p.timber);
    rect(x + 8, restored ? 212 : 220, 32, 8, restored ? p.mint : p.timber);
  }
  // A proportional new cable is visible even for one completion out of 100.
  rect(908, 196, 264, 4, p.ink);
  if (model.sharedRecovery.ratio > 0)
    rect(
      908,
      196,
      Math.max(4, Math.round((264 * model.sharedRecovery.ratio) / 4) * 4),
      4,
      p.mint,
    );
  // Failed utility line beside the shortcut; no decorative rubble or false pickup.
  rect(680, 668, 8, 72, p.timber);
  rect(660, 680, 48, 8, p.timber);
  rect(704, 704, 32, 8, p.ink);
  rect(732, 712, 32, 8, p.ink);
  rect(764, 720, 28, 8, p.ink);
  // Signs sit in grass. Route decisions remain accessible in the DOM sidebar.
  label("PAVED DETOUR", 640, 376, 28);
  label("RUBBLE SHORTCUT", 896, 676, 28);
  function person(x, y, shirt, selected = false) {
    rect(x - 12, y + 4, 32, 8, p.shade);
    rect(x - 8, y - 40, 20, 20, "#d8b88b");
    rect(x - 12, y - 44, 28, 8, p.ink);
    rect(x - 12, y - 20, 28, 24, shirt);
    rect(x - 8, y + 4, 8, 12, p.ink);
    rect(x + 8, y + 4, 8, 12, p.ink);
    if (selected) {
      rect(x - 16, y + 20, 36, 4, p.paper);
    }
  }
  const shirts = ["#b6d18f", "#d29a55", "#91b8bc", "#d4b7a0"];
  for (const peer of model.teammates)
    person(
      peer.x,
      peer.y,
      shirts[(Number(peer.palette) || 0) % shirts.length],
      peer.selected,
    );
  // The player's cart is the focal sprite, not one among a hundred avatars.
  const { x, y } = model.cartPose;
  rect(x - 48, y + 16, 108, 12, p.shade);
  rect(x - 40, y - 20, 80, 44, p.timber);
  rect(x - 44, y - 24, 88, 8, p.line);
  rect(x - 40, y - 4, 80, 4, "#574b3e");
  rect(x - 36, y + 20, 20, 20, p.ink);
  rect(x + 20, y + 20, 20, 20, p.ink);
  rect(x - 32, y + 24, 12, 12, p.road);
  rect(x + 24, y + 24, 12, 12, p.road);
  rect(x + 40, y - 8, 32, 8, p.timber);
  rect(x + 64, y - 16, 8, 16, p.timber);
  if (model.loadedCargo) {
    const boxes = Object.entries(model.loadedCargo)
      .flatMap(([kind, n]) =>
        Array.from({ length: Math.min(4, n) }, () => kind),
      )
      .slice(0, 4);
    boxes.forEach((kind, i) => {
      const bx = x - 32 + (i % 2) * 36,
        by = y - 48 - Math.floor(i / 2) * 20;
      rect(
        bx,
        by,
        32,
        28,
        kind === "cable" ? p.amber : kind === "food" ? p.mint : p.paper,
      );
      rect(bx + 12, by, 4, 28, p.timber);
    });
  }
  person(
    x + 64,
    y + 4,
    shirts[(Number(state?.me?.palette) || 0) % shirts.length],
  );
  rect(x - 60, y - 92, 4, 96, p.ink);
  rect(x - 56, y - 92, 60, 24, p.amber);
  label("YOU", x - 28, y - 80, 20);
  if (model.nextStop) {
    const n = model.nextStop;
    rect(n.x + 80, n.y - 32, 4, 40, p.ink);
    rect(n.x + 76, n.y - 64, 76, 32, p.paper);
    label("NEXT", n.x + 112, n.y - 48, 24);
    rect(n.x + 56, n.y - 4, 28, 8, p.paper);
    rect(n.x + 52, n.y - 8, 8, 16, p.paper);
    rect(n.x + 48, n.y - 4, 4, 8, p.paper);
  }
  ctx.restore();
  return model;
}
