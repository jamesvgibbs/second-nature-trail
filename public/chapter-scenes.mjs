// Focused illustrations and semantic controls for the existing public tasks.
// This module never decides answers, scores, timing or world movement.
import { moveDaySceneModel } from "./move-day-scene.mjs";
export const CHAPTER_SCENE_TITLES = Object.freeze({
  2: "Attack of the clones",
  3: "Home, after the storm",
  4: "Pest resistance",
  5: "Credit where it’s due",
  6: "Rewards rebellion",
  7: "Reconnect humanity",
});
export const CHAPTER_SCENE_STORIES = Object.freeze({
  2: "A familiar face. An unfamiliar request. Check the evidence through a trusted channel.",
  3: "A disrupted apartment, a resident waiting for help. Document the facts and plan the next step.",
  4: "Read the warning signal. Resolve the marked outbreak while leaving friendly neighbors alone.",
  5: "A payment counter and three real decisions in a fictional budget. The clock and the amount both matter.",
  6: "Useful jobs earn tokens. Turn that work into a garden, a welcome station or a celebration.",
  7: "The neighborhood has the cables. Build a working route through the exchange to each home.",
});
const C = {
  ink: "#203536",
  sky: "#bcc9b1",
  horizon: "#81958c",
  ground: "#789170",
  grass: "#8fa37a",
  shade: "#647f65",
  paper: "#f3e9ca",
  wood: "#aa875d",
  timber: "#80654b",
  roof: "#304e50",
  wall: "#657773",
  amber: "#d29a55",
  mint: "#b6d18f",
  red: "#bd7259",
  dark: "#465c57",
  dust: "#a99e81",
};
export const CHAPTER_SCENE_GEOMETRY = Object.freeze({
  width: 1200,
  height: 800,
  companions: [
    { x: 88, y: 708 },
    { x: 160, y: 728 },
    { x: 232, y: 708 },
  ],
  choices: [0, 1, 2].map((i) => ({
    x: 432 + i * 240,
    y: 596,
    width: 228,
    height: 164,
  })),
  targets: [0, 1, 2].map((i) => ({
    x: 452 + i * 232,
    y: 340,
    width: 204,
    height: 200,
  })),
  objective: { x: 320, y: 260, width: 800, height: 300 },
});
const labelMap = {
  exchange: "EXCHANGE",
  north: "NORTH",
  south: "SOUTH",
  "relay-west": "WEST RELAY",
  "relay-east": "EAST RELAY",
  hub: "HUB",
  bypass: "BYPASS",
  "home-a": "HOME A",
  "home-b": "HOME B",
  "home-c": "HOME C",
};
export function chapterSceneModel(view, options = {}) {
  const event = view?.event || {},
    me = view?.me || {},
    chapter = event.chapter,
    phase = event.phase === "paused" ? event.pausedPhase : event.phase;
  const archivedFinale = event.archive?.finaleRecorded === false && ["awards", "closed"].includes(phase);
  const finale = ["finale", "awards", "closed"].includes(phase),
    progress = me.progress?.[chapter] || {},
    task = view?.chapter?.task || null;
  const snapshot = options.held;
  const held =
    !!snapshot &&
    snapshot.epoch === view?.projectionEpoch &&
    snapshot.chapter === chapter &&
    snapshot.step === progress.step &&
    phase === "chapter";
  const completed = progress.complete === true,
    stage = held
      ? "outcome"
      : completed
        ? "complete"
        : task?.stage || task?.kind || "visit";
  const peers = moveDaySceneModel(view, {
    focusedPeerId: options.focusedPeerId,
  });
  const active =
    finale || (phase === "chapter" && chapter >= 2 && chapter <= 7);
  const enabled =
    active &&
    !options.presentation &&
    event.phase !== "paused" &&
    !event.paused &&
    !options.pending;
  const shownTask = held ? snapshot.task : task;
  const inspected = shownTask?.stage === "decide";
  const evidence = inspected ? String(shownTask.evidence || "") : "";
  const choices =
    stage === "decide" || task?.kind === "budget" || task?.kind === "rewards"
      ? (task?.options || []).map((text, id) => ({ id, label: String(text) }))
      : [];
  const nodes = (shownTask?.nodes || []).map((n) => ({
    ...n,
    sceneX: 348 + (n.x / 4) * 736,
    sceneY: 268 + (n.y / 2) * 296,
    shortLabel: labelMap[n.id] || n.label || n.id,
  }));
  const hotspots = [];
  if (enabled) {
    if (
      finale &&
      phase === "finale" &&
      !event.finale?.contributors?.includes(me.id)
    )
      hotspots.push({
        id: "restore",
        action: "objective",
        x: 464,
        y: 264,
        width: 472,
        height: 312,
      });
    else if (!finale && !held && !completed) {
      if (task?.kind === "routing")
        nodes.forEach((n) =>
          hotspots.push({
            id: n.id,
            action: "node",
            node: n.id,
            x: n.sceneX - 32,
            y: n.sceneY - 32,
            width: 64,
            height: 64,
          }),
        );
      else if (task?.kind === "targeting")
        (task.targets || []).forEach((t, i) =>
          hotspots.push({
            id: "target-" + t.id,
            action: "choice",
            choice: t.id,
            ...CHAPTER_SCENE_GEOMETRY.targets[i],
          }),
        );
      else
        choices.forEach((choice, i) =>
          hotspots.push({
            id: "choice-" + i,
            action: "choice",
            choice: i,
            ...CHAPTER_SCENE_GEOMETRY.choices[i],
          }),
        );
      if (task?.stage === "inspect")
        hotspots.push({
          id: "inspect",
          action: "objective",
          ...CHAPTER_SCENE_GEOMETRY.objective,
        });
    }
  }
  const ownRepair = finale
    ? !!event.finale?.contributors?.includes(me.id)
    : held
      ? snapshot.success === true
      : completed &&
        (chapter !== 5 ||
          (progress.cycles?.length > 0 &&
            progress.cycles.every((c) => c.onTime === true)));
  const districtRestored = !finale && Number.isFinite(event.restoration?.perDistrict) &&
    event.restoration.perDistrict > 0 &&
    (event.contributions?.[chapter] || 0) >= event.restoration.perDistrict;
  const displayRepair = options.presentation ? districtRestored : ownRepair;
  return {
    active,
    chapter,
    phase,
    presentation: !!options.presentation,
    paused: event.phase === "paused" || !!event.paused,
    stage,
    task: shownTask,
    liveTask: task,
    held,
    completed,
    step: progress.step || 0,
    total: view?.chapter?.taskCount || task?.totalSteps || 3,
    archive: archivedFinale ? { source:String(event.archive.source || "recorded event"), finaleRecorded:false } : null,
    awardCount: (event.awards || view?.awards || []).length,
    completedObjectives: (event.contributions || []).reduce((sum,value)=>sum+(Number.isFinite(value)?value:0),0),
    title: archivedFinale ? "Archived results" : finale
      ? "Bring the lights home"
      : CHAPTER_SCENE_TITLES[chapter] || "The neighborhood",
    story: CHAPTER_SCENE_STORIES[chapter] || "",
    siteName: archivedFinale ? "Recorded chapter awards" : finale
      ? "Bragging Square"
      : held
        ? snapshot.siteName
        : task?.target?.name ||
          view?.chapter?.locations?.[0]?.name ||
          "Bragging Square",
    evidence,
    choices: selectedSafeChoices(choices, stage),
    selected: options.selection ?? null,
    route: held ? snapshot.route || [] : options.route || [],
    nodes,
    ownRepair,
    districtRestored,
    displayRepair,
    outcomeTitle: held ? String(snapshot.title || "") : null,
    outcomeText: held ? String(snapshot.text || "") : null,
    cycles: progress.cycles || [],
    retainedBudget: Number.isFinite(progress.budget) ? progress.budget : null,
    personalScore: progress.score || 0,
    rewards: view?.chapter?.rewardShop || null,
    shared: {
      completed: finale
        ? event.finale?.contributors?.length || 0
        : event.contributions?.[chapter] || 0,
      total: finale
        ? event.finale?.target || 1
        : event.restoration?.perDistrict || 1,
    },
    ending: event.finale?.ending || "",
    contributors: event.finale?.contributors || [],
    player: options.presentation || archivedFinale
      ? null
      : { id: me.id, palette: me.palette || 0 },
    teammates: options.presentation || archivedFinale
      ? []
      : peers.teammates.map((p, i) => ({
          ...p,
          ...CHAPTER_SCENE_GEOMETRY.companions[i],
        })),
    nearbyCount: peers.nearbyCount,
    teammateCount: peers.teammateCount,
    safe: options.presentation || options.safe !== false,
    hotspots,
    now: options.now ?? view?.serverTime ?? 0,
  };
}
function selectedSafeChoices(choices, stage) {
  return ["outcome", "complete"].includes(stage) ? [] : choices;
}
export function hitChapterHotspot(model, x, y) {
  return (
    model.hotspots.find(
      (h) => x >= h.x && x <= h.x + h.width && y >= h.y && y <= h.y + h.height,
    ) || null
  );
}
function r(c, color, x, y, w, h) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function text(c, value, x, y, size = 20, color = C.ink, align = "left") {
  c.fillStyle = color;
  c.font = `bold ${size}px monospace`;
  c.textAlign = align;
  c.fillText(String(value), x, y);
}
function wrap(c, value, x, y, width, size = 18, lines = 3) {
  const max = Math.floor(width / (size * 0.62)),
    rows = [];
  let row = "";
  for (const word of String(value).split(/\s+/)) {
    if ((row + " " + word).trim().length > max && row) {
      rows.push(row);
      row = word;
    } else row = (row + " " + word).trim();
  }
  if (row) rows.push(row);
  rows
    .slice(0, lines)
    .forEach((v, i) =>
      text(
        c,
        i === lines - 1 && rows.length > lines ? v.slice(0, max - 1) + "…" : v,
        x,
        y + i * (size + 6),
        size,
      ),
    );
}
function person(c, x, y, shirt = C.amber, selected = false) {
  r(c, C.dark, x - 20, y + 24, 44, 8);
  r(c, C.ink, x - 12, y - 48, 24, 12);
  r(c, C.amber, x - 12, y - 36, 24, 24);
  r(c, shirt, x - 20, y - 12, 40, 28);
  r(c, C.ink, x - 12, y + 16, 8, 12);
  r(c, C.ink, x + 4, y + 16, 8, 12);
  if (selected) r(c, C.paper, x - 24, y + 36, 48, 4);
}
function house(c, x, y, w = 300, h = 240, warm = false) {
  r(c, C.dark, x - 8, y + h, w + 16, 16);
  r(c, warm ? C.wood : C.wall, x, y, w, h);
  for (let py = y + 20; py < y + h; py += 24) r(c, C.timber, x, py, w, 4);
  for (let i = 0; i < 6; i++)
    r(c, C.roof, x - 16 + i * 24, y - 12 - i * 12, w + 32 - i * 48, 12);
  r(c, C.ink, x + w / 2 - 28, y + h - 112, 56, 112);
  r(c, C.timber, x + w / 2 - 20, y + h - 104, 40, 104);
  r(c, C.amber, x + w / 2 + 8, y + h - 64, 8, 8);
  for (const wx of [x + 24, x + w - 88]) {
    r(c, C.ink, wx, y + 48, 64, 64);
    r(c, warm ? C.amber : C.dark, wx + 8, y + 56, 48, 48);
    r(c, C.timber, wx + 28, y + 56, 8, 48);
  }
}
function sheet(c, x, y, w = 96, h = 120) {
  r(c, C.ink, x, y, w, h);
  r(c, C.paper, x + 4, y + 4, w - 8, h - 8);
  for (let py = y + 24; py < y + h - 12; py += 16)
    r(c, C.wall, x + 12, py, w - 24, 4);
}
function base(c, m) {
  r(c, C.sky, 0, 0, 1200, 800);
  r(c, C.horizon, 0, 156, 1200, 104);
  r(c, C.ground, 0, 260, 1200, 540);
  [
    [24, 144, 152],
    [208, 184, 120],
    [1056, 168, 120],
  ].forEach(([x, y, w], i) => {
    r(c, C.shade, x, y, w, 100);
    r(c, C.horizon, x + 20, y - 24, w - 40, 24);
    r(c, i < m.shared.completed ? C.amber : C.dark, x + 48, y + 36, 16, 20);
  });
  r(c, C.dust, 0, 576, 1200, 224);
  r(c, C.paper, 0, 548, 1200, 28);
  text(c, m.title.toUpperCase(), 600, 60, 28, C.ink, "center");
  text(c, m.siteName.toUpperCase(), 600, 96, 20, C.ink, "center");
}
function choices(c, m) {
  m.choices.forEach((o, i) => {
    const b = CHAPTER_SCENE_GEOMETRY.choices[i];
    r(c, m.selected === o.id ? C.mint : C.paper, b.x, b.y, b.width, b.height);
    r(c, C.timber, b.x, b.y, b.width, 4);
    text(c, i + 1, b.x + 12, b.y + 28, 22);
    wrap(c, o.label, b.x + 12, b.y + 64, b.width - 24, 19, 4);
  });
}
function presentationDescription(m) {
  return {
    2: "Neighbors verify requests through known contacts and check suspicious messages.",
    3: "Neighbors document damage and record safe recovery plans.",
    4: "Neighbors resolve marked service requests across three sites.",
    5: "Neighbors plan fictional payments and keep a record of each cycle.",
    6: "Completed jobs earn tokens for neighborhood projects.",
    7: "Working routes bring the neighborhood homes back online.",
  }[m.chapter] || "Neighbors are restoring the neighborhood together.";
}
function outcome(c, m, defaultTitle, defaultText) {
  r(c, C.paper, 432, 608, 708, 128);
  text(
    c,
    m.presentation ? (m.districtRestored ? "DISTRICT OBJECTIVE COMPLETE" : "NEIGHBORS AT WORK") : m.outcomeTitle || (m.ownRepair ? defaultTitle : "CHECK BEFORE ACTING"),
    456,
    644,
    23,
  );
  wrap(
    c,
    m.presentation ? presentationDescription(m) : m.outcomeText ||
      (m.ownRepair
        ? defaultText
        : m.evidence ||
          "Visit the site and inspect the evidence before making a decision."),
    456,
    680,
    660,
    20,
    2,
  );
}
function identity(c, m) {
  house(c, 696, 236, 376, 276, m.displayRepair);
  r(c, C.timber, 348, 420, 304, 24);
  r(c, C.wood, 368, 444, 264, 88);
  r(c, C.dark, 384, 532, 16, 24);
  r(c, C.dark, 600, 532, 16, 24);
  sheet(c, 392, 312, 100, 108);
  r(c, C.ink, 532, 328, 72, 84);
  r(c, C.paper, 540, 336, 56, 48);
  r(c, C.mint, 548, 392, 40, 8);
  text(c, "KNOWN CONTACT", 504, 474, 18, C.paper, "center");
  person(c, 976, 504, m.displayRepair ? C.mint : C.amber);
  if (m.evidence) {
    r(c, C.paper, 344, 196, 304, 96);
    text(c, "EVIDENCE OPEN", 368, 228, 20);
    wrap(c, m.evidence, 368, 256, 256, 16, 2);
  }
  if (m.displayRepair) {
    r(c, C.paper, 344, 136, 304, 48);
    text(c, "CONTACT CHECKED", 496, 168, 22, C.ink, "center");
    r(c, C.mint, 840, 360, 64, 12);
  }
  if (m.choices.length) choices(c, m);
  else
    outcome(
      c,
      m,
      "REQUEST CHECKED.",
      "The resident has a verified next step. Continue when ready.",
    );
}
function apartment(c, m) {
  r(c, C.ink, 480, 180, 568, 352);
  r(c, C.wall, 488, 188, 552, 336);
  r(c, C.dark, 488, 484, 552, 40);
  r(c, C.timber, 736, 188, 12, 336);
  r(c, C.ink, 536, 244, 144, 116);
  r(c, C.sky, 544, 252, 128, 100);
  r(c, C.timber, 604, 252, 8, 100);
  r(c, C.timber, 544, 300, 128, 8);
  r(c, C.wood, 824, 380, 156, 64);
  r(c, C.paper, 832, 364, 140, 24);
  r(c, C.timber, 836, 444, 16, 52);
  r(c, C.timber, 952, 444, 16, 52);
  {
    r(c, C.dark, 776, 228, 12, 112);
    r(c, C.dark, 788, 324, 36, 12);
    r(c, C.dust, 504, 500, 176, 12);
    r(c, C.dust, 800, 508, 208, 12);
  }
  sheet(c, 352, 356, 84, 112);
  if (m.displayRepair) {
    r(c, C.mint, 364, 380, 60, 24);
    text(c, "SAVED", 394, 398, 16, C.ink, "center");
  }
  r(c, C.dark, 316, 468, 152, 24);
  person(c, 1000, 524, m.displayRepair ? C.mint : C.amber);
  text(
    c,
    m.displayRepair ? "RECOVERY PLAN RECORDED" : "DOCUMENT · PLAN · SUPPORT",
    764,
    156,
    22,
    C.ink,
    "center",
  );
  if (m.choices.length) choices(c, m);
  else
    outcome(
      c,
      m,
      "A CLEAR NEXT STEP.",
      "The resident’s recovery action is recorded. Continue when ready.",
    );
}
function targetActor(c, x, y, marked, safe) {
  if (marked && !safe) {
    r(c, C.dark, x - 24, y - 20, 48, 56);
    r(c, C.dark, x - 16, y - 40, 32, 24);
    for (const dy of [-20, 0, 24]) {
      r(c, C.dark, x - 44, y + dy, 24, 8);
      r(c, C.dark, x + 20, y + dy, 24, 8);
    }
  } else {
    r(c, C.ink, x - 32, y - 40, 64, 40);
    r(c, C.wall, x - 28, y - 36, 56, 32);
    r(c, C.ink, x - 20, y - 28, 40, 16);
    r(c, C.mint, x - 12, y - 24, 8, 8);
    r(c, C.mint, x + 8, y - 24, 8, 8);
    r(c, marked ? C.amber : C.mint, x - 28, y, 56, 48);
    r(c, C.dark, x - 20, y + 48, 12, 16);
    r(c, C.dark, x + 8, y + 48, 12, 16);
    r(c, C.dark, x - 40, y + 8, 12, 24);
    r(c, C.dark, x + 28, y + 8, 12, 24);
  }
  if (marked) {
    r(c, C.amber, x + 36, y - 56, 28, 32);
    text(c, "!", x + 50, y - 32, 28, C.ink, "center");
  }
}
function pests(c, m) {
  r(c, C.roof, 420, 204, 724, 332);
  r(c, C.wall, 436, 220, 692, 300);
  for (let i = 0; i < 3; i++) {
    const b = CHAPTER_SCENE_GEOMETRY.targets[i];
    r(c, C.ink, b.x, b.y, b.width, b.height);
    r(
      c,
      m.displayRepair ? C.amber : C.dark,
      b.x + 8,
      b.y + 8,
      b.width - 16,
      b.height - 16,
    );
    r(
      c,
      m.selected === m.liveTask?.targets?.[i]?.id ? C.mint : C.paper,
      b.x,
      b.y - 44,
      b.width,
      32,
    );
    text(
      c,
      `TARGET ${String.fromCharCode(65 + i)}`,
      b.x + b.width / 2,
      b.y - 20,
      20,
      C.ink,
      "center",
    );
    if (m.presentation) targetActor(c, b.x + 100, b.y + 92, false, true);
    else if (!m.displayRepair && m.liveTask?.targets?.[i]) {
      const t = m.liveTask.targets[i];
      targetActor(c, b.x + 100, b.y + 92, t.marked, m.safe);
    }
  }
  const t = m.held ? m.task : m.liveTask;
  const prepare = m.now < (t?.actionAllowedAt || 0);
  text(
    c,
    m.presentation
      ? "NEIGHBORS ON RESPONSE"
      : m.displayRepair
        ? "SITE CLEAR"
        : m.paused
          ? "PAUSED"
          : t?.actedThisRound
            ? "ROUND RECORDED"
            : prepare
              ? "PREPARE"
              : "SIGNAL OPEN",
    780,
    172,
    28,
    C.ink,
    "center",
  );
  r(c, C.paper, 432, 608, 708, 128);
  text(
    c,
    m.presentation
      ? (m.districtRestored ? "DISTRICT OBJECTIVE COMPLETE" : "NEIGHBORHOOD SERVICE REQUESTS")
      : `${m.displayRepair ? t?.hitsRequired || 6 : t?.siteHits || 0} / ${t?.hitsRequired || 6} RESOLVED HERE`,
    456,
    644,
    24,
  );
  wrap(
    c,
    m.presentation ? presentationDescription(m) : m.displayRepair
      ? "This site is clear. Continue to the next home."
      : "Select the warning-marked target. Friendly neighbors have no warning marker.",
    456,
    682,
    660,
    20,
    2,
  );
}
function payment(c, m) {
  house(c, 624, 228, 448, 284, m.displayRepair);
  r(c, C.timber, 348, 424, 648, 24);
  r(c, C.wood, 368, 448, 608, 96);
  sheet(c, 408, 288, 124, 136);
  text(c, "PAYMENT", 470, 322, 18, C.ink, "center");
  r(c, C.ink, 600, 316, 184, 108);
  r(c, C.paper, 608, 324, 168, 92);
  text(c, "FICTIONAL", 692, 350, 16, C.ink, "center");
  text(
    c,
    m.presentation
      ? "PAYMENTS"
      : m.completed && !m.held
        ? m.retainedBudget === null ? "RECORDED" : `KEPT ${m.retainedBudget}`
        : `FUNDS ${m.task?.budget ?? m.liveTask?.budget ?? 0}`,
    692,
    390,
    22,
    C.ink,
    "center",
  );
  person(c, 908, 412, m.displayRepair ? C.mint : C.amber);
  for (let i = 0; i < m.step; i++) {
    r(c, C.paper, 852 + i * 52, 488, 40, 40);
    text(
      c,
      m.cycles[i]?.onTime ? "✓" : "—",
      872 + i * 52,
      518,
      24,
      C.ink,
      "center",
    );
  }
  if (m.choices.length) choices(c, m);
  else {
    r(c, C.paper, 432, 608, 708, 128);
    text(c, m.presentation ? (m.districtRestored ? "DISTRICT OBJECTIVE COMPLETE" : "FICTIONAL PAYMENT CYCLES") : m.outcomeTitle || "PAYMENT CYCLES RECORDED", 456, 644, 22);
    wrap(
      c,
      m.presentation ? presentationDescription(m) : m.outcomeText ||
        "Your recorded payments and retained budgets are saved. Only on-time, sufficient payments earn on-time points.",
      456,
      680,
      660,
      19,
      2,
    );
  }
}
function rewards(c, m) {
  r(c, C.timber, 452, 244, 652, 288);
  r(c, C.wood, 464, 256, 628, 264);
  for (let x = 464; x < 1092; x += 96) r(c, C.roof, x, 220, 48, 60);
  r(c, C.paper, 512, 312, 496, 64);
  text(c, "NEIGHBORHOOD WORKSHOP", 760, 352, 24, C.ink, "center");
  r(c, C.dark, 488, 468, 580, 64);
  person(c, 1012, 460, m.displayRepair ? C.mint : C.amber);
  if (m.presentation && m.districtRestored) {
    r(c, C.amber, 484, 288, 20, 48);
    r(c, C.amber, 1060, 288, 20, 48);
  }
  for (let i = 0; i < Math.min(6, m.step); i++) {
    r(c, C.mint, 536 + i * 60, 404, 44, 32);
    text(c, "✓", 558 + i * 60, 430, 22, C.ink, "center");
  }
  text(
    c,
    m.presentation
      ? "WORK BECOMES REWARDS"
      : `${m.rewards?.balance || 0} REWARD TOKENS`,
    760,
    184,
    26,
    C.ink,
    "center",
  );
  const used = m.rewards?.uses || [];
  if (used.includes("garden")) {
    r(c, C.timber, 332, 484, 96, 40);
    for (let x = 344; x < 416; x += 24) {
      r(c, C.mint, x, 460, 16, 28);
      r(c, C.amber, x + 4, 452, 8, 8);
    }
  }
  if (used.includes("welcome")) {
    r(c, C.paper, 1080, 384, 84, 72);
    r(c, C.timber, 1088, 456, 8, 68);
    text(c, "HI!", 1122, 428, 24, C.ink, "center");
  }
  if (used.includes("festival")) {
    for (let x = 472; x < 1060; x += 64) r(c, C.amber, x, 192, 32, 24);
  }
  if (m.choices.length) choices(c, m);
  else
    outcome(
      c,
      m,
      "WORK THAT HELPS THE BLOCK.",
      "Your jobs and funded projects stay recorded. Choose the next step beside the scene.",
    );
}
function line(c, x1, y1, x2, y2, color, width = 4, dashed = false) {
  const dx = x2 - x1,
    dy = y2 - y1,
    steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let i = 0; i <= steps; i++) {
    if (dashed && Math.floor(i / 3) % 2) continue;
    r(
      c,
      color,
      Math.round((x1 + (dx * i) / steps) / 4) * 4,
      Math.round((y1 + (dy * i) / steps) / 4) * 4,
      width,
      width,
    );
  }
}
function network(c, m) {
  const task = m.task || m.liveTask;
  if (!task?.nodes) {
    for (let i=0;i<3;i++) {
      const x=584+i*188, lit=m.presentation ? m.districtRestored : i<m.step;
      r(c,C.wall,x,324,160,176);r(c,C.roof,x-8,304,176,20);
      r(c,C.timber,x+64,408,40,92);
      r(c,lit?C.amber:C.dark,x+20,360,32,36);r(c,lit?C.amber:C.dark,x+108,360,32,36);
      text(c,`HOME ${String.fromCharCode(65+i)}`,x+80,284,22,C.ink,'center');
    }
    r(c, C.roof, 352, 340, 176, 20);
    r(c, C.wall, 368, 360, 144, 172);
    for (let y = 380; y < 500; y += 32) {
      r(c, C.ink, 384, y, 112, 20);
      r(c, (m.presentation ? m.districtRestored : m.completed) ? C.mint : C.amber, 476, y + 4, 12, 12);
    }
    line(c, 512, 500, 688, 500, m.displayRepair ? C.mint : C.dark, 8, !m.displayRepair);
    outcome(
      c,
      m,
      m.completed ? "THE HOMES ARE CONNECTED." : "RECONNECT THE NEIGHBORHOOD.",
      m.completed
        ? "Your recorded routes have brought the neighborhood back online."
        : "Working routes bring each home back online.",
    );
    return;
  }
  for (const edge of task.edges || []) {
    const a = m.nodes.find((n) => n.id === edge[0]),
      b = m.nodes.find((n) => n.id === edge[1]);
    if (!a || !b) continue;
    const broken = (task.blockedEdges || []).some(
      (e) => e.includes(a.id) && e.includes(b.id),
    );
    const selected = m.route.some(
      (id, i) =>
        i &&
        ((id === a.id && m.route[i - 1] === b.id) ||
          (id === b.id && m.route[i - 1] === a.id)),
    );
    line(
      c,
      a.sceneX,
      a.sceneY,
      b.sceneX,
      b.sceneY,
      broken ? C.red : selected ? C.amber : C.dark,
      selected ? 8 : 4,
      broken,
    );
    const current = m.route.at(-1) || task.source;
    if (selected || edge.includes(current)) {
      const cost = task.edgeCosts?.find(
        (e) => [e.from, e.to].includes(a.id) && [e.from, e.to].includes(b.id),
      )?.cost;
      const mx = Math.round((a.sceneX + b.sceneX) / 8) * 4,
        my = Math.round((a.sceneY + b.sceneY) / 8) * 4;
      r(c, C.paper, mx - 18, my - 16, 36, 28);
      text(c, broken ? "×" : (cost ?? "?"), mx, my + 6, 22, C.ink, "center");
    }
  }
  for (const n of m.nodes) {
    const lit = m.route.includes(n.id);
    r(c, C.ink, n.sceneX - 24, n.sceneY - 24, 48, 48);
    r(c, lit ? C.mint : C.paper, n.sceneX - 16, n.sceneY - 16, 32, 32);
    if (n.id.startsWith("home")) {
      const connected=m.presentation ? m.districtRestored : ["home-a","home-b","home-c"].indexOf(n.id)<m.step;
      r(c, C.wood, n.sceneX - 32, n.sceneY - 28, 64, 52);
      r(c, C.roof, n.sceneX - 40, n.sceneY - 40, 80, 12);
      r(c, C.ink, n.sceneX - 8, n.sceneY, 16, 24);
      r(c, connected ? C.amber : C.dark, n.sceneX - 24, n.sceneY - 16, 12, 12);
      r(c, connected ? C.amber : C.dark, n.sceneX + 12, n.sceneY - 16, 12, 12);
    }
    if (n.id === "exchange") {
      r(c, C.roof, n.sceneX - 44, n.sceneY - 48, 88, 12);
      r(c, C.wall, n.sceneX - 36, n.sceneY - 36, 72, 64);
      r(c, C.ink, n.sceneX - 24, n.sceneY - 24, 48, 12);
      r(c, C.ink, n.sceneX - 24, n.sceneY - 4, 48, 12);
      r(c, lit ? C.mint : C.amber, n.sceneX + 12, n.sceneY - 20, 8, 4);
      r(c, lit ? C.mint : C.amber, n.sceneX + 12, n.sceneY, 8, 4);
    }
    r(c, C.paper, n.sceneX - 72, n.sceneY + 32, 144, 28);
    text(c, n.shortLabel, n.sceneX, n.sceneY + 53, 20, C.ink, "center");
    if ((task.requiredNodes || []).includes(n.id)) {
      r(c, C.amber, n.sceneX - 64, n.sceneY + 64, 128, 28);
      text(c, "REQUIRED", n.sceneX, n.sceneY + 85, 20, C.ink, "center");
    }
  }
  r(c, C.paper, 432, 672, 708, 88);
  text(c, `CONNECT ${String(task.destination).toUpperCase()}`, 456, 706, 22);
  text(
    c,
    `Required: ${(task.requiredNodes || []).join(", ")} · budget ${task.budget}`,
    456,
    738,
    18,
  );
}
function archivedResults(c,m) {
  r(c,C.roof,284,196,720,40);r(c,C.timber,300,236,688,324);r(c,C.wood,316,252,656,292);
  for(let row=0;row<5;row++)r(c,C.timber,332,292+row*48,624,8);
  for(let i=0;i<Math.min(15,m.awardCount);i++){
    const x=364+(i%3)*192,y=264+Math.floor(i/3)*48;
    r(c,C.paper,x,y,128,32);r(c,C.amber,x+12,y+8,16,16);text(c,String(i+1).padStart(2,'0'),x+76,y+23,19,C.ink,'center');
  }
  r(c,C.paper,344,116,600,56);text(c,`${m.awardCount} RECORDED AWARDS`,644,154,28,C.ink,'center');
  r(c,C.paper,348,604,696,140);text(c,'FINALE OUTCOME NOT RETAINED',696,646,24,C.ink,'center');
  text(c,`${m.completedObjectives} recorded chapter completions`,696,684,22,C.ink,'center');
  text(c,`Archive: ${m.archive.source.slice(0,32)}`,696,718,18,C.ink,'center');
}
function finale(c, m) {
  if(m.archive){archivedResults(c,m);return;}

  for (const [i, x, y, w, h] of [
    [0, 64, 280, 240, 228],
    [1, 448, 244, 340, 288],
    [2, 904, 296, 224, 212],
  ])
    house(c, x, y, w, h, i === 1 ? m.ownRepair : m.shared.completed > i);
  r(c, C.timber, 472, 540, 292, 24);
  person(c, 860, 548, m.ownRepair ? C.mint : C.amber);
  text(
    c,
    m.phase === "finale"
      ? "ONE LAST REPAIR, TOGETHER"
      : "THE NEIGHBORHOOD REMEMBERS",
    600,
    132,
    26,
    C.ink,
    "center",
  );
  r(c, C.paper, 432, 608, 708, 128);
  text(
    c,
    m.ownRepair
      ? "YOUR HOME IS RESTORED"
      : `${m.shared.completed} NEIGHBOR REPAIRS`,
    456,
    646,
    24,
  );
  wrap(
    c,
    m.ending ||
      "Every neighbor can restore one home. The shared count records every contribution.",
    456,
    682,
    660,
    19,
    2,
  );
  if (m.phase !== "finale") {
    r(c, C.amber, 568, 376, 100, 72);
    r(c, C.amber, 548, 360, 140, 28);
    r(c, C.timber, 608, 448, 20, 32);
    r(c, C.amber, 580, 480, 76, 16);
  }
}
export function drawChapterScene(ctx, view, options = {}) {
  const m = chapterSceneModel(view, options);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  base(ctx, m);
  if (["finale", "awards", "closed"].includes(m.phase)) finale(ctx, m);
  else
    (
      ({
        2: identity,
        3: apartment,
        4: pests,
        5: payment,
        6: rewards,
        7: network,
      })[m.chapter] || identity
    )(ctx, m);
  if (m.player) {
    person(
      ctx,
      m.chapter === 7 ? 208 : 288,
      548,
      ["#e88960", "#79b8af", "#d5b84e", "#b49bc9", "#7799c5", "#cc899e"][
        m.player.palette % 6
      ],
    );
    text(ctx, "YOU", m.chapter === 7 ? 208 : 288, 486, 24, C.ink, "center");
  }
  for (const p of m.teammates) person(ctx, p.x, p.y, C.wall, p.selected);
  ctx.restore();
  return m;
}
