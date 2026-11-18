// A chapter-two illustration of server-confirmed work orders. Scene coordinates
// are semantic controls, never navigation coordinates or an alternate simulation.
import { moveDaySceneModel } from "./move-day-scene.mjs";
const C = Object.freeze({
  ink: "#203536",
  sky: "#bcc9b1",
  distance: "#81958c",
  ground: "#789170",
  grass: "#8fa37a",
  shade: "#647f65",
  paper: "#f3e9ca",
  timber: "#80654b",
  wood: "#aa875d",
  roof: "#304e50",
  wall: "#657773",
  amber: "#d29a55",
  mint: "#b6d18f",
  dust: "#a99e81",
  dark: "#465c57",
  white: "#e5ddbd",
});
export const FILTER_GEOMETRY = Object.freeze({
  width: 1200,
  height: 800,
  grid: 4,
  home: { x: 612, y: 200, width: 480, height: 284 },
  unit: { x: 632, y: 368, width: 152, height: 172 },
  cards: [0, 1, 2].map((i) => ({
    x: 456 + i * 232,
    y: 596,
    width: 220,
    height: 164,
  })),
  companions: [
    { x: 92, y: 700 },
    { x: 164, y: 720 },
    { x: 236, y: 700 },
  ],
});
export function filterSceneModel(state, options = {}) {
  const me = state?.me || {},
    event = state?.event || {},
    progress = me.progress?.[1] || {},
    task = state?.chapter?.task;
  const step = Math.max(
    0,
    Math.min(6, Number.isSafeInteger(progress.step) ? progress.step : 0),
  );
  const snapshot = options.completedHome;
  const installed =
    !!snapshot &&
    !!state?.projectionEpoch &&
    snapshot.epoch === state.projectionEpoch &&
    snapshot.step === step &&
    step > 0;
  const active =
    event.chapter === 1 &&
    (event.phase === "chapter" ||
      (event.phase === "paused" && event.pausedPhase === "chapter"));
  const stage = installed
    ? "installed"
    : progress.complete
      ? "complete"
      : task?.stage === "decide"
        ? "decide"
        : "inspect";
  const evidence = installed
    ? String(snapshot.evidence || "")
    : stage === "decide"
      ? String(task?.evidence || "")
      : "";
  const choices =
    stage === "decide" && evidence
      ? (task?.options || []).map((label, id) => {
          const dimensions = String(label).match(/(\d+)\s*[×x]\s*(\d+)/i);
          return {
            id,
            label: String(label),
            dimensions: dimensions
              ? [Number(dimensions[1]), Number(dimensions[2])]
              : null,
          };
        })
      : [];
  const nearby = moveDaySceneModel(state, {
    focusedPeerId: options.focusedPeerId,
  });
  const sharedCompleted = Math.max(0, Number(event.contributions?.[1]) || 0),
    sharedTotal = Math.max(1, Number(event.restoration?.perDistrict) || 1);
  const enabled =
    active && event.phase === "chapter" && !event.paused && !options.pending;
  const hotspots = enabled
    ? [
        {
          id: "unit",
          action: "objective",
          x: 612,
          y: 352,
          width: 188,
          height: 208,
        },
        ...choices.map((choice, i) => ({
          id: "filter-" + i,
          action: "choice",
          choice: i,
          ...FILTER_GEOMETRY.cards[i],
        })),
      ]
    : [];
  return {
    active,
    paused: event.phase !== "chapter" || !!event.paused,
    stage,
    step,
    total: 6,
    complete: !!progress.complete,
    homeName: installed
      ? String(snapshot.name)
      : task?.target?.name || "Your neighborhood",
    evidence,
    prompt:
      stage === "decide"
        ? String(task?.prompt || "Choose an installation.")
        : "Inspect the equipment before choosing a filter.",
    options: choices,
    selectedChoice: choices.some((c) => c.id === options.selectedChoice)
      ? options.selectedChoice
      : null,
    completedHomes: Array.from({ length: 6 }, (_, i) => i < step),
    homeRestored: installed || !!progress.complete,
    installedChoice: installed ? String(snapshot.choiceLabel || "") : null,
    sharedRecovery: { completed: sharedCompleted, total: sharedTotal },
    teammates: nearby.teammates.map((p, i) => ({
      ...p,
      ...FILTER_GEOMETRY.companions[i],
    })),
    nearbyCount: nearby.nearbyCount,
    teammateCount: nearby.teammateCount,
    player: { character: me.character || 0, palette: me.palette || 0 },
    hotspots,
  };
}
export function hitFilterHotspot(model, x, y) {
  return (
    model.hotspots.find(
      (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
    ) || null
  );
}
function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function text(ctx, value, x, y, size = 20, color = C.ink, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function words(ctx, value, x, y, width, size = 18, maxLines = 4) {
  const max = Math.floor(width / (size * 0.62)),
    lines = [];
  let line = "";
  for (const word of String(value).split(/\s+/)) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  lines
    .slice(0, maxLines)
    .forEach((row, i) =>
      text(
        ctx,
        i === maxLines - 1 && lines.length > maxLines
          ? row.slice(0, max - 1) + "…"
          : row,
        x,
        y + i * (size + 6),
        size,
      ),
    );
}
function person(ctx, x, y, color, selected = false) {
  rect(ctx, C.dark, x - 20, y + 24, 44, 8);
  rect(ctx, C.ink, x - 12, y - 48, 24, 12);
  rect(ctx, C.amber, x - 12, y - 36, 24, 24);
  rect(ctx, color, x - 20, y - 12, 40, 28);
  rect(ctx, C.ink, x - 12, y + 16, 8, 12);
  rect(ctx, C.ink, x + 4, y + 16, 8, 12);
  if (selected) rect(ctx, C.paper, x - 24, y + 36, 48, 4);
}
function filter(ctx, x, y, w, h, clean = true) {
  rect(ctx, C.ink, x, y, w, h);
  rect(ctx, clean ? C.paper : C.dust, x + 4, y + 4, w - 8, h - 8);
  for (let px = x + 12; px < x + w - 8; px += 12)
    rect(ctx, clean ? C.wood : C.dark, px, y + 8, 4, h - 16);
  rect(ctx, C.wood, x, y, w, 4);
  rect(ctx, C.wood, x, y + h - 4, w, 4);
}
export function drawFilterScene(ctx, state, options = {}) {
  const m = filterSceneModel(state, options);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  rect(ctx, C.sky, 0, 0, 1200, 800);
  rect(ctx, C.distance, 0, 140, 1200, 100);
  rect(ctx, C.ground, 0, 240, 1200, 560);
  // Restrained distant landscape, with a clear route and work area in front.
  for (const [index, [x, y, w]] of [
    [28, 160, 168],
    [212, 184, 128],
    [360, 152, 180],
    [1120, 172, 80],
  ].entries()) {
    rect(ctx, C.shade, x, y, w, 72);
    rect(ctx, C.distance, x + 20, y - 28, w - 40, 28);
    // Four distant windows acknowledge actual shared completions; the precise
    // district count stays in the HUD, and the current home stays personal.
    rect(ctx, index < Math.min(4, m.sharedRecovery.completed) ? C.amber : C.dark,
      x + Math.floor(w / 8) * 4, y + 24, 12, 16);
  }
  rect(ctx, C.shade, 36, 492, 1096, 56);
  rect(ctx, C.paper, 0, 548, 1200, 28);
  rect(ctx, C.dust, 0, 576, 1200, 224);
  // Timber house and broad porch; the service cabinet remains fully visible.
  rect(ctx, C.dark, 596, 484, 520, 16);
  rect(ctx, m.homeRestored ? C.wood : C.wall, 612, 224, 480, 248);
  for (let y = 240; y < 468; y += 24) rect(ctx, C.timber, 612, y, 480, 4);
  for (let i = 0; i < 8; i++)
    rect(ctx, C.roof, 596 + i * 28, 200 - i * 12, 512 - i * 56, 12);
  rect(ctx, C.ink, 824, 308, 80, 164);
  rect(ctx, C.timber, 832, 316, 64, 156);
  rect(ctx, C.amber, 880, 392, 8, 8);
  for (const x of [648, 952]) {
    rect(ctx, C.ink, x, 272, 96, 76);
    rect(ctx, m.homeRestored ? C.amber : C.dark, x + 8, 280, 80, 60);
    rect(ctx, C.timber, x + 44, 280, 8, 60);
    rect(ctx, C.timber, x + 8, 308, 80, 8);
  }
  rect(ctx, C.timber, 796, 472, 284, 16);
  rect(ctx, C.wood, 812, 488, 252, 16);
  rect(ctx, C.timber, 828, 504, 220, 12);
  // Unit: closed unread label until inspection; installed clean frame only on accepted success.
  rect(ctx, C.ink, 632, 368, 152, 172);
  rect(ctx, C.wall, 640, 376, 136, 156);
  rect(ctx, C.dark, 652, 412, 112, 104);
  if (m.homeRestored) filter(ctx, 656, 416, 104, 96, true);
  else {
    for (let y = 420; y < 508; y += 16) rect(ctx, C.dust, 656, y, 104, 8);
  }
  rect(ctx, C.paper, 644, 380, 128, 24);
  const label = m.evidence.match(/(?:plate:|plate is)\s*(\d+\s*×\s*\d+)/i)?.[1];
  text(
    ctx,
    m.homeRestored
      ? "INSTALLED"
      : label || (m.evidence ? "LABEL CHECKED" : "CHECK LABEL"),
    708,
    398,
    14,
    C.ink,
    "center",
  );
  if (m.homeRestored) {
    for (let y = 424; y < 500; y += 24) {
      rect(ctx, C.mint, 792, y, 36, 4);
      rect(ctx, C.mint, 816, y - 4, 8, 12);
    }
  }
  // The direction cue is revealed by the same inspected public evidence as
  // the work order. No arrow (or answer hint) is shown before inspection.
  if (/\barrow\b.*\btoward\b/i.test(m.evidence)) {
    rect(ctx, C.dark, 548, 432, 84, 40);
    rect(ctx, C.wall, 552, 436, 80, 32);
    rect(ctx, C.paper, 564, 448, 44, 8);
    rect(ctx, C.paper, 604, 440, 8, 24);
    rect(ctx, C.paper, 612, 444, 8, 16);
    rect(ctx, C.paper, 620, 448, 8, 8);
    text(ctx, "AIRFLOW", 590, 420, 16, C.ink, "center");
    text(ctx, "TO UNIT", 590, 492, 16, C.ink, "center");
  }
  // Resident and player, separate from decision cards and all route markers.
  person(ctx, 980, 464, m.homeRestored ? C.mint : C.amber);
  rect(ctx, C.paper, 804, 208, 324, 48);
  text(
    ctx,
    m.homeRestored ? "“That’s a better fit.”" : "“Can you check our filter?”",
    966,
    238,
    18,
    C.ink,
    "center",
  );
  rect(ctx, C.timber, 112, 428, 260, 20);
  rect(ctx, C.wood, 128, 448, 228, 64);
  rect(ctx, C.ink, 148, 512, 32, 24);
  rect(ctx, C.ink, 304, 512, 32, 24);
  filter(ctx, 144, 372, 64, 56);
  filter(ctx, 220, 356, 76, 72);
  rect(ctx, C.paper, 300, 380, 52, 48);
  text(ctx, "FILTER SUPPLIES", 244, 476, 18, C.paper, "center");
  person(
    ctx,
    412,
    512,
    ["#e88960", "#79b8af", "#d5b84e", "#b49bc9", "#7799c5", "#cc899e"][
      m.player.palette % 6
    ],
  );
  text(ctx, "YOU", 412, 454, 24, C.ink, "center");
  // Persistent six-house ledger is authoritative even after a refresh.
  rect(ctx, C.paper, 36, 32, 440, 84);
  text(ctx, "YOUR HOME VISITS", 56, 58, 18);
  m.completedHomes.forEach((done, i) => {
    const x = 60 + i * 64;
    rect(ctx, done ? C.mint : C.wall, x, 80, 36, 20);
    rect(ctx, C.roof, x - 4, 72, 44, 8);
    rect(ctx, done ? C.amber : C.dark, x + 12, 84, 12, 16);
  });
  text(ctx, m.homeName.toUpperCase(), 816, 64, 26, C.ink, "center");
  text(
    ctx,
    m.homeRestored
      ? "AIRFLOW RESTORED"
      : m.stage === "decide"
        ? "MATCH THE INSPECTED EQUIPMENT"
        : "INSPECT BEFORE INSTALLING",
    816,
    96,
    18,
    C.ink,
    "center",
  );
  if (m.stage === "decide") {
    m.options.forEach((option, i) => {
      const r = FILTER_GEOMETRY.cards[i];
      rect(
        ctx,
        option.id === m.selectedChoice ? C.mint : C.paper,
        r.x,
        r.y,
        r.width,
        r.height,
      );
      rect(ctx, C.timber, r.x, r.y, r.width, 4);
      text(ctx, String(i + 1), r.x + 12, r.y + 28, 20);
      const d = option.dimensions;
      const w = d ? Math.round(d[0] * 2) : 48,
        h = d ? Math.round(d[1] * 2) : 48;
      filter(ctx, r.x + r.width - 76, r.y + 12, w, h);
      if (d) text(ctx, `${d[0]} × ${d[1]}`, r.x + 12, r.y + 68, 24);
      const labelOnlyDimensions = d && option.label.replace(/\s/g, "").replace(/x/i, "×") === `${d[0]}×${d[1]}`;
      if (!labelOnlyDimensions) words(ctx, option.label, r.x + 12, r.y + 92, r.width - 24, 18, 3);
    });
  } else {
    rect(ctx, C.paper, 456, 608, 684, 128);
    text(
      ctx,
      m.homeRestored
        ? "AIRFLOW RESTORED."
        : "ONE HOME AT A TIME.",
      480,
      644,
      22,
    );
    words(
      ctx,
      m.homeRestored
        ? `${m.homeName} has a clean filter. Continue when you are ready.`
        : "Inspect the unit to read its equipment plate. Your installation choices will appear here.",
      480,
      680,
      636,
      20,
      2,
    );
  }
  for (const peer of m.teammates)
    person(ctx, peer.x, peer.y, C.wall, peer.selected);
  ctx.restore();
  return m;
}
