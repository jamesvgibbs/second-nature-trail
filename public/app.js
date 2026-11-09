import { createProjection, reduceProjection } from "/projection.mjs";
import { localFrameMeasurement } from "/performance.mjs";
const measureFrame = localFrameMeasurement();
import {
  DOORS,
  OBSTACLES,
  isWalkable,
  clipMove,
  findPath,
  waypointReached,
  stepToward,
} from "/world.mjs";
import {
  classifyDevice,
  readStoredPreferences,
  clientPreferences,
  serverPreferences,
  isValidKeyMap,
  readSafeOverride,
  writeSafeOverride,
  restorationProgress,
  routeSummary,
} from "/helpers.mjs";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  modal = $("#modal"),
  body = $("#modal-body");
const palette = [
  "#e88960",
  "#79b8af",
  "#d5b84e",
  "#b49bc9",
  "#7799c5",
  "#cc899e",
];
const names = [
  "The gardener",
  "The fixer",
  "The explorer",
  "The neighbor",
  "The courier",
  "The thinker",
  "The builder",
  "The ranger",
  "The inventor",
  "The navigator",
  "The optimist",
  "The original",
];
const districts = [
  ["Move day mayhem", "Moving depot", "Broken highway"],
  ["The great filter shortage", "Filter warehouse", "Ventilation maze"],
  ["Attack of the clones", "Identity bureau", "Counterfeit town hall"],
  ["RIP, my apartment", "Insurance office", "Disaster block"],
  ["Pest resistance", "Apartment block", "Pest-control HQ"],
  ["Credit where it’s due", "Trading post", "Payment station"],
  ["Rewards rebellion", "Rewards arcade", "Night market"],
  ["Reconnect humanity", "Internet exchange", "AI headquarters"],
];
const cells = [
  [0, 0],
  [1, 0],
  [2, 0],
  [0, 1],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];
let hostProjection = createProjection(),
  hostGeneration = 0,
  hostStream = null,
  hostConnected = false;
let projection = createProjection(),
  streamGeneration = 0,
  loadGeneration = 0,
  movementSequence = 0,
  settingsSequence = 0,
  visualIntentGeneration = 0,
  latestVisualIntentInsects = false;
let state = null,
  connected = false,
  stream = null,
  target = null,
  lastMove = 0,
  activeCanvas = null,
  activeCtx = null,
  displayPosition = null,
  panel = "",
  chosen = 0,
  swatch = 0,
  safe = true,
  selection = null,
  currentPhase = "",
  currentChapter = -1,
  hostState = null;
let prefs = {};
try {
  prefs = readStoredPreferences(localStorage);
} catch {}
let missionSignature = "",
  serverOffset = 0;
const normalizedSettings = clientPreferences,
  serverSettings = serverPreferences;
let forceSafe = false,
  routePath = [],
  tutorialMovePending = false,
  presentedTarget = null,
  autoTargetEnabled = false,
  autoTargetRound = null,
  targetRequestPending = false;
try {
  forceSafe = readSafeOverride(localStorage);
} catch {
  forceSafe = true;
}
let replacementSavePending = false;
const defaultKeys = {
  up: "w",
  left: "a",
  down: "s",
  right: "d",
  interact: "e",
  inventory: "i",
  map: "m",
  help: "h",
};
let keys = { ...defaultKeys, ...prefs.keys };
const client = globalThis.crypto?.randomUUID?.() || null;
const isHost = location.pathname.startsWith("/host"),
  isPresentation = location.pathname.startsWith("/presentation");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const btn = (text, fn, cls = "") => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.className = cls;
  if (cls.split(" ").includes("choice"))
    b.setAttribute("aria-pressed", "false");
  b.onclick = fn;
  return b;
};
function toast(text) {
  if (modal.open) {
    $("#toast").style.display = "none";
    let feedback = $("#dialog-feedback");
    if (!feedback) {
      feedback = document.createElement("p");
      feedback.id = "dialog-feedback";
      feedback.className = "notice";
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      body.prepend(feedback);
    }
    feedback.textContent = text;
    return;
  }
  $("#toast").textContent = text;
  $("#toast").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").style.display = "none"), 4500);
}
function open(title, html = "") {
  target = null;
  $("#modal-title").textContent = title;
  body.innerHTML = html;
  if (!modal.open) modal.showModal();
  else $("#close-modal").focus({ preventScroll: true });
}
function close() {
  modal.close();
  panel = "";
  selection = null;
  activeCanvas?.focus();
}
$("#close-modal").onclick = close;
modal.addEventListener("cancel", () => {
  panel = "";
  setTimeout(() => activeCanvas?.focus(), 0);
});
async function api(path, data) {
  const r = await fetch(path, {
    method: data ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Trail-Client": client },
    body: data ? JSON.stringify(data) : undefined,
  });
  let v;
  try {
    v = await r.json();
  } catch {
    throw Error("The server could not complete that request.");
  }
  if (!r.ok)
    throw Object.assign(Error(v.error || v.message || "Please try again."), {
      status: r.status,
    });
  return v;
}
async function act(type, fields = {}) {
  const requestGeneration = streamGeneration;
  const expectedChapter = fields.expectedChapter ?? state?.event?.chapter;
  const requestPhase = state?.event?.phase;
  const competitive = [
    "task",
    "challenge",
    "quiz",
    "secret",
    "mystery",
    "assist",
    "tradeOffer",
    "tradeConfirm",
    "rewardRedeem",
  ].includes(type);
  startAudio();
  if (!connected) {
    toast("Reconnecting. Your saved progress is safe; actions are paused.");
    return null;
  }
  try {
    const v = await api("/api/action", {
      type,
      requestId: crypto.randomUUID(),
      expectedChapter,
      ...(type === "task"
        ? {
            expectedStep: state.me?.progress?.[state.event.chapter]?.step,
            expectedStage: state.chapter?.task?.stage || null,
          }
        : {}),
      ...fields,
      ...(type === "move" ? { movementSequence: ++movementSequence } : {}),
      ...(type === "setup" ? { settingsSequence: ++settingsSequence } : {}),
    });
    if (requestGeneration !== streamGeneration) return null;
    const response = v.state || v.patch || v;
    if (response.projectionEpoch !== projection.epoch) return null;
    if (v.state) accept(v.state, "full");
    if (v.patch) accept(v.patch, "patch");
    if (v.position) accept(v, "move");
    if (
      competitive &&
      (expectedChapter !== state?.event?.chapter ||
        requestPhase !== state?.event?.phase)
    )
      return null;
    if (type !== "move" && type !== "tutorial") soundEffect();
    return v.result;
  } catch (e) {
    if (requestGeneration === streamGeneration) toast(e.message);
    return null;
  }
}
function applyPrefs() {
  document.documentElement.style.setProperty(
    "--base",
    (prefs.textSize || 16) + "px",
  );
  document.body.classList.toggle("reduced-motion", !!prefs.reducedMotion);
}
applyPrefs();
function topbar(extra = "") {
  return `<header class="topbar"><div class="brand"><span class="brand-mark">sn</span> SECOND NATURE TRAIL</div>${extra || '<span class="eyebrow">A neighborhood worth saving</span>'}</header>`;
}
function blocked(message, title = "A bigger adventure needs a bigger screen") {
  app.innerHTML =
    topbar() +
    `<main class="phone-screen card"><div class="eyebrow">Before you set out</div><h1>${esc(title)}</h1><p>${esc(message)}</p><p class="small">Event code: SN-TRAIL</p><div id="blocked-actions" class="row"></div><p class="small muted" style="margin-top:20px">Using a company laptop? Ask your event host for device support. Touchscreen laptops are supported.</p></main>`;
  $("#blocked-actions").append(
    btn("Copy invitation link", async () => {
      await navigator.clipboard.writeText(location.href);
      toast("Link copied.");
    }),
    btn("Try again", () => location.reload(), "quiet"),
  );
}
function capabilities() {
  if (
    classifyDevice({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      anyCoarsePointer: matchMedia("(any-pointer: coarse)").matches,
      mobileHint: navigator.userAgentData?.mobile === true,
    }) === "unsupported-mobile"
  ) {
    blocked(
      "This game requires a laptop or desktop with a keyboard and mouse or trackpad. Phones and tablets are not supported. Open your invitation link on a computer to join.",
    );
    return false;
  }
  try {
    localStorage.setItem("trail-check", "1");
    localStorage.removeItem("trail-check");
    if (
      !client ||
      !document.createElement("canvas").getContext("2d") ||
      !window.EventSource
    )
      throw Error();
  } catch {
    blocked(
      "A secure connection, rendering, browser storage, and a live connection are required. Enable storage for this site and use a supported desktop browser, then retry.",
      "Let’s get your browser ready",
    );
    return false;
  }
  return true;
}
function windowCheck() {
  let n = $("#size-note");
  if (innerWidth < 1024 || innerHeight < 640) {
    if (!n) {
      n = document.createElement("div");
      n.id = "size-note";
      n.className = "block-banner";
      n.textContent =
        "Enlarge this window to at least 1024 × 640 for the full game. This is a window-size check, not a phone restriction.";
      document.body.append(n);
    }
  } else n?.remove();
}
function landing(error = "") {
  app.innerHTML = `<div class="landing">${topbar()}<main class="hero"><section class="hero-copy"><div class="pill"><span class="dot"></span> 100 NEIGHBORS · ONE SHARED WORLD</div><h1>The machines<br>lost the plot.<br><span>We’ve got this.</span></h1><p>Pack your cart. Find your people. Bring a neighborhood back to life, one very human decision at a time.</p><form class="join-form"><label for="invite">Your private invitation code</label><div class="row"><input id="invite" name="invite" placeholder="Paste your invitation code" required autocomplete="off"><button class="primary">Set out →</button></div></form>${error ? `<p class="error">${esc(error)}</p>` : ""}<p class="small" style="margin-top:20px">Laptop or desktop · Keyboard or mouse · No install</p></section><section class="hero-art"><canvas id="hero-map" width="1200" height="800" aria-label="Original pixel neighborhood with houses, parks, and a central meeting square"></canvas><div class="art-caption">EST. BEFORE THE ROBOTS GOT IDEAS &nbsp; / &nbsp; BRAGGING SQUARE</div></section></main><footer class="landing-bottom"><div><strong>08 chapters</strong><p>A fresh district. A different kind of trouble.</p></div><div><strong>15 ways to shine</strong><p>Find your edge. Help a neighbor find theirs.</p></div><div><strong>01 neighborhood</strong><p>Every repair makes this place a little more human.</p></div></footer></div>`;
  drawMap($("#hero-map").getContext("2d"), false);
  $(".join-form").onsubmit = (e) => {
    e.preventDefault();
    join($("#invite").value);
  };
}
async function join(token, takeover = false) {
  try {
    await api("/api/join", { token, takeover });
    history.replaceState({}, "", location.pathname);
    await loadPlayer();
  } catch (e) {
    if (e.status === 409) {
      open(
        "Continue in this browser?",
        `<p>This invitation is already open elsewhere. Taking over disconnects the other play session and restores your saved progress here.</p><div id="takeover" class="row"></div>`,
      );
      $("#takeover").append(
        btn(
          "Take over here",
          async () => {
            close();
            await join(token, true);
          },
          "primary",
        ),
        btn("Cancel", close),
      );
    } else landing(e.message);
  }
}
async function loadPlayer() {
  const loading = ++loadGeneration,
    generation = detachStream();
  const snapshot = await api("/api/state");
  if (loading !== loadGeneration || generation !== streamGeneration) return;
  accept(snapshot, "full", true);
  if (!state)
    throw Error(
      "The server did not provide an ordered game snapshot. Please reload.",
    );
  safe = forceSafe || state.me?.insects !== true;
  prefs = { ...prefs, ...normalizedSettings(state.me?.settings) };
  keys = { ...defaultKeys, ...prefs.keys };
  applyPrefs();
  connect();
  if (!state.me?.setup) setup();
  else game();
}
function detachStream() {
  const previous = stream;
  stream = null;
  streamGeneration++;
  connected = false;
  previous?.close();
  return streamGeneration;
}
async function connect(takeover = false) {
  const generation = detachStream();
  if (!isPresentation && !takeover) {
    try {
      const lease = await api(
        "/api/lease?client=" + encodeURIComponent(client),
      );
      if (generation !== streamGeneration) return;
      if (lease.otherClient) {
        takenOver();
        return;
      }
    } catch {
      if (generation !== streamGeneration) return;
    }
  }
  const url = isPresentation
    ? "/api/events?presentation=1"
    : `/api/events?client=${encodeURIComponent(client)}${takeover ? "&takeover=1" : ""}`;
  const source = new EventSource(url);
  stream = source;
  let bootstrapPending = true;
  const current = () => generation === streamGeneration && stream === source;
  source.onopen = () => {
    if (!current()) return;
    bootstrapPending = true;
    connected = false;
    updateConnection();
  };
  const receive = (event) => {
    if (!current()) return;
    try {
      if (accept(JSON.parse(event.data), "full", bootstrapPending)) {
        bootstrapPending = false;
        const wasConnected = connected;
        connected = true;
        updateConnection();
        if (!wasConnected && forceSafe) persistReplacement();
      }
    } catch {}
  };
  source.onmessage = receive;
  source.addEventListener("state", receive);
  source.addEventListener("takeover", () => {
    if (current()) takenOver();
  });
  source.addEventListener("replaced", () => {
    if (current()) takenOver();
  });
  source.onerror = () => {
    if (!current()) return;
    connected = false;
    updateConnection();
  };
}

function takenOver() {
  detachStream();
  updateConnection();
  open(
    "This session moved",
    `<p>Your identity is now active in another browser or tab. Your committed progress is saved.</p><div id="reclaim"></div>`,
  );
  $("#reclaim").append(
    btn(
      "Take over in this tab",
      () => {
        close();
        connect(true);
      },
      "primary",
    ),
  );
}
function updateConnection() {
  const el = $("#connection");
  if (el) {
    el.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "dot " + (connected ? "" : "offline");
    el.append(
      dot,
      document.createTextNode(connected ? "CONNECTED" : "RECONNECTING"),
    );
    if (!connected && !isPresentation)
      el.append(
        btn(
          "Resume here",
          () => {
            open(
              "Resume in this tab?",
              '<p>If another tab is playing, this will move control here. Your saved progress stays with you.</p><div id="resume-here"></div>',
            );
            $("#resume-here").append(
              btn(
                "Take over here",
                () => {
                  close();
                  connect(true);
                },
                "primary",
              ),
            );
          },
          "quiet",
        ),
      );
  }
}
function setup() {
  app.innerHTML =
    topbar() +
    `<main class="setup"><div class="eyebrow safe">YOUR NEIGHBORHOOD NEEDS YOU</div><h1>Make yourself at home.</h1><p class="intro">Hi, ${esc(state.me.name)}. Pick your look and how you’d like to play.</p><form id="setup-form"><div class="grid2"><section class="card"><h2>Choose your character</h2><div class="avatar-grid" id="avatars"></div><label>Pick a palette</label><div class="palette-grid" id="palettes"></div><p class="small muted">Same abilities. Same chances. Entirely your style.</p></section><section class="card"><h2>Show spiders and insects?</h2><p class="small">Choose before entering the world. Both versions play exactly the same.</p><label class="radio-choice"><input type="radio" name="insects" value="false" required> Replace with friendly robots</label><label class="radio-choice"><input type="radio" name="insects" value="true" required> Show spiders and insects</label><div id="setup-settings"></div></section></div><div class="row spread" style="margin-top:24px;color:var(--paper)"><span class="small">You can change these settings during play.</span><button class="primary">Enter Bragging Square →</button></div></form></main>`;
  avatarOptions();
  settingsFields($("#setup-settings"));
  $("#setup-form")
    .querySelectorAll('input[name="insects"]')
    .forEach((input) => {
      input.onchange = () => noteVisualIntent(input.value === "true", true);
    });
  $("#setup-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const insects = form.get("insects") === "true";
    const intent = noteVisualIntent(insects);
    const settings = readSettings();
    const r = await act("setup", {
      character: chosen,
      palette: swatch,
      insects,
      settings: serverSettings(settings),
    });
    if (r !== null && commitVisualIntent(intent, insects)) game();
  };
}
function avatarOptions() {
  const a = $("#avatars"),
    p = $("#palettes");
  a.replaceChildren();
  p.replaceChildren();
  names.forEach((n, i) => {
    const b = btn(
      "",
      () => {
        chosen = i;
        avatarOptions();
      },
      i === chosen ? "selected" : "",
    );
    b.setAttribute("aria-label", n);
    b.setAttribute("aria-pressed", i === chosen);
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 80;
    drawAvatar(c.getContext("2d"), 32, 64, i, swatch, 2);
    b.append(c, document.createTextNode(n.replace("The ", "")));
    a.append(b);
  });
  palette.forEach((v, i) => {
    const b = btn(
      "",
      () => {
        swatch = i;
        avatarOptions();
      },
      "swatch " + (i === swatch ? "selected" : ""),
    );
    b.style.background = v;
    b.setAttribute("aria-label", "Palette " + (i + 1));
    b.setAttribute("aria-pressed", i === swatch);
    p.append(b);
  });
}
function settingsFields(container) {
  container.innerHTML = `<label>Text size<select id="text-size"><option value="16">Standard</option><option value="20">Large</option><option value="24">Extra large</option></select></label><label>Control preference<select id="controls"><option value="keyboard">Keyboard</option><option value="pointer">Mouse / trackpad</option></select></label><label class="checkline"><input id="reduced" type="checkbox"> Reduced motion</label><div class="grid2"><label>Music volume<input id="music" type="range" min="0" max="100" value="0"></label><label>Effects volume<input id="effects" type="range" min="0" max="100" value="0"></label></div>`;
  $("#text-size").value = prefs.textSize || 16;
  $("#controls").value = prefs.controls || "keyboard";
  $("#reduced").checked = !!prefs.reducedMotion;
  $("#music").value = prefs.music || 0;
  $("#effects").value = prefs.effects || 0;
}
function readSettings() {
  prefs = {
    ...prefs,
    textSize: Number($("#text-size").value),
    controls: $("#controls").value,
    reducedMotion: $("#reduced").checked,
    music: Number($("#music").value),
    effects: Number($("#effects").value),
    keys,
  };
  try {
    localStorage.setItem("trail-prefs", JSON.stringify(prefs));
  } catch {}
  applyPrefs();
  startAudio();
  return prefs;
}
function accept(s, kind = "full", allowEpoch = false) {
  if (s.state) s = s.state;
  const next = reduceProjection(projection, s, { kind, allowEpoch });
  if (next === projection) return false;
  const previous = state;
  const coreChanged =
    next.epoch !== projection.epoch ||
    next.coreVersion !== projection.coreVersion;
  if (next.epoch !== projection.epoch) target = null;
  projection = next;
  state = next.state;
  if (kind === "move") return true;
  if (state.me?.settings) {
    prefs = { ...prefs, ...normalizedSettings(state.me.settings) };
    keys = { ...defaultKeys, ...prefs.keys };
    updateControlHints();
  }
  if (coreChanged) serverOffset = (state.serverTime || Date.now()) - Date.now();
  safe = forceSafe || isPresentation || state.me?.insects !== true;
  const e = state.event || {};
  if (currentPhase !== e.phase || currentChapter !== e.chapter) {
    target = null;
    if (
      currentPhase &&
      modal.open &&
      [
        "activity",
        "challenge",
        "quiz",
        "secret",
        "targeting",
        "routing",
      ].includes(panel)
    ) {
      close();
      toast("The neighborhood has moved to the next phase.");
    }
    currentPhase = e.phase;
    currentChapter = e.chapter;
  }
  const signature = JSON.stringify([
    { ...state.event, remainingMs: undefined },
    state.chapter,
    state.me?.progress,
    state.me?.tutorial,
    state.me?.ready,
    state.me?.mystery,
  ]);
  if ($("#mission") && signature !== missionSignature) {
    missionSignature = signature;
    renderMission();
  }
  updateConnection();
  const tradesChanged =
    JSON.stringify(previous?.trades) !== JSON.stringify(state.trades);
  if (tradesChanged && panel === "neighbors" && modal.open)
    preservePanelFocus(() => neighbors(true));
  if (
    panel === "inventory" &&
    modal.open &&
    JSON.stringify(previous?.me?.inventory) !==
      JSON.stringify(state.me?.inventory)
  )
    preservePanelFocus(() => inventory(true));
  const incoming = (state.trades || []).filter(
    (t) =>
      t.to === state.me?.id &&
      !(previous?.trades || []).some((old) => old.id === t.id),
  );
  if (incoming.length)
    toast(
      "A neighbor offered a trade. Open Neighbors to review and confirm it.",
    );
  return true;
}
function game() {
  app.innerHTML = `<main class="game ${isPresentation ? "presentation" : ""}">${topbar(`<div class="row"><span id="connection" class="pill"></span><div style="text-align:right"><div class="phase-label" id="phase-label"></div><div class="timer" id="timer">--:--</div></div></div>`)}<div class="game-main"><section class="world-wrap"><canvas class="world" id="world" width="1200" height="800" tabindex="0" role="application" aria-label="Shared neighborhood. Move with arrow keys or WASD, or click a destination. Press E to interact. Tab reaches all menus."></canvas><div class="map-label" id="map-label">BRAGGING SQUARE</div><div class="world-hint" id="world-hint">Click to walk · WASD / arrows to move · E to interact</div></section><aside class="mission" id="mission"></aside></div><footer class="game-footer"><div class="row" id="toolbar"></div><span class="small">One neighborhood. Everyone belongs.</span><span class="small" id="player-name"></span></footer></main>`;
  activeCanvas = $("#world");
  activeCtx = activeCanvas.getContext("2d");
  if (!isPresentation) {
    const bar = $("#toolbar");
    bar.append(
      btn("Inventory [I]", () => inventory()),
      btn("Map [M]", map),
      btn("Neighbors", () => neighbors()),
      btn("Help [H]", help),
      btn("Settings", settings),
    );
    $("#player-name").textContent = state.me?.name || "";
    activeCanvas.addEventListener("pointerdown", (e) => {
      const r = activeCanvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 1200,
        y = ((e.clientY - r.top) / r.height) * 800;
      setDestination(x, y);
      activeCanvas.focus();
    });
    activeCanvas.addEventListener("keydown", worldKeys);
  } else {
    $("#toolbar").innerHTML =
      '<span class="pill">FRIENDLY ROBOT VISUALS · PRESENTATION</span>';
    $("#world-hint").textContent =
      "Repairs bring the whole neighborhood back to life.";
  }
  renderMission();
  updateConnection();
  updateControlHints();
  windowCheck();
  requestAnimationFrame(frame);
  firstUseControls();
}
function firstUseControls() {
  if (isPresentation || !state.me || state.me.tutorial?.length >= 5) return;
  const key = "trail-controls-seen:" + state.me.id;
  try {
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
  } catch {}
  panel = "controls-intro";
  open(
    "Your first steps on the trail",
    `<p>Explore together at your own pace. Every action works with a keyboard or a mouse / trackpad.</p><table class="compact-table"><tr><th>Action</th><th>Keyboard</th><th>Pointer</th></tr><tr><td>Walk</td><td>${esc(movementKeys())} or arrow keys while the map is focused</td><td>Click a destination on the map</td></tr><tr><td>Visit an objective</td><td>Tab to its button, then Enter; ${esc(keyLabel("interact"))} interacts nearby</td><td>Click the objective button</td></tr><tr><td>Choose an action</td><td>Tab and Enter, or a numbered choice</td><td>Click a choice, then Confirm</td></tr><tr><td>Close a menu</td><td>Escape</td><td>Click ×</td></tr></table><p class="notice">${["draft", "lobby"].includes(state.event.phase) ? "Start with the five practice steps in the sidebar." : "Follow the current chapter in the sidebar."} Help (${esc(keyLabel("help"))}) stays available throughout the game. Settings changes controls, text size, sound, and visuals.</p><div id="intro-start"></div>`,
  );
  $("#intro-start").append(btn("Let’s explore", close, "primary"));
}
function renderMission() {
  const mission = $("#mission");
  const focused = mission.contains(document.activeElement)
    ? document.activeElement
    : null;
  const focusedText = focused?.textContent;
  const focusedIndex = focused
    ? [...mission.querySelectorAll("button")].indexOf(focused)
    : -1;
  const previousPhase = mission.dataset.phase;
  const e = state.event || {},
    me = state.me || {},
    ch = state.chapter,
    progress = me.progress?.[e.chapter];
  $("#phase-label").textContent = (
    e.paused ? "Paused" : e.phase || "Lobby"
  ).replaceAll("_", " ");
  let html = "";
  if (e.broadcast) html += `<div class="notice">${esc(e.broadcast)}</div>`;
  if (e.phase === "lobby" || e.phase === "draft") {
    html += `<span class="chapter-count">BEFORE THE ADVENTURE</span><h2>Welcome to<br>Bragging Square.</h2><p>The AI has put the neighborhood on “permanent optimization.” Let’s remind it who lives here.</p>`;
    if (!isPresentation) {
      const t = me.tutorial || [];
      html += `<hr><h3>Your first five steps</h3><div id="tutorial-actions"></div><hr><div id="ready-action"></div>`;
    } else
      html +=
        '<div class="notice">Open your private invitation on a laptop or desktop. Choose a character, practice, and mark yourself ready.</div>';
  } else if (e.phase === "countdown") {
    html +=
      '<span class="chapter-count">HERE WE GO</span><h2>The trail<br>starts here.</h2><p>Pack some patience. The machines packed none.</p><div class="notice">The shared countdown is part of the first chapter’s five minutes.</div>';
  } else if (e.phase === "finale") {
    html += `<span class="chapter-count">THE NEIGHBORHOOD FINALE</span><h2>Bring the<br>lights home.</h2><p>One last repair. One home at a time. Every neighbor gets a turn.</p><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, (100 * (e.finale?.contributors?.length || 0)) / (e.finale?.target || 1))}%"></div></div>${e.finale?.ending ? `<div class="notice" role="status">${esc(e.finale.ending)}</div>` : `<p class="small">${e.finale?.contributors?.length || 0} neighbors have contributed toward ${e.finale?.target || 1} repairs.</p>`}<p class="small">Award results are locked. This moment belongs to everyone.</p><div id="finale-action"></div>`;
  } else if (["awards", "closed"].includes(e.phase)) {
    html +=
      '<span class="chapter-count">HUMANS: STILL PRETTY GOOD</span><h2>A neighborhood<br>restored.</h2><p>For the fixers, the thinkers, and the people who stopped to help.</p>' +
      awardsHTML();
  } else {
    html += `<span class="chapter-count">CHAPTER ${Number(e.chapter) + 1} / 08 ${e.ranked?.[e.chapter] === false ? "· UNRANKED" : ""}</span><h2>${esc(ch?.title || districts[e.chapter]?.[0] || "The adventure")}</h2><p>${esc(ch?.objective || "Help your neighbors restore the district.")}</p>`;
    if (e.phase === "brag" || e.phase === "brag_break") {
      html +=
        '<div class="phase-banner"><strong>Bragging rights.</strong><p class="small" style="margin:8px 0 0">Supplies and scoring are frozen. Tell us how you did it.</p></div>' +
        verifiedHighlightHTML() +
        standingsHTML() +
        awardsHTML() +
        nextChapterHTML();
    } else if (!isPresentation) {
      html += `<div class="stat-row"><span>Your chapter score</span><strong>${progress?.score || 0}</strong></div><div class="stat-row"><span>Objective progress</span><strong>${progress?.step || 0} / ${ch?.taskCount || ch?.task?.totalSteps || 3}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progress?.complete ? 100 : Math.min(100, (100 * (progress?.step || 0)) / (ch?.taskCount || ch?.task?.totalSteps || 3))}%"></div></div><div id="chapter-actions"></div>`;
    }
    html += "<hr><h3>Neighborhood restoration</h3>" + contributionsHTML();
  }
  $("#mission").innerHTML = html;
  mission.dataset.phase = `${e.phase}:${e.chapter}`;
  $("#map-label").textContent = (ch?.title || "Bragging Square").toUpperCase();
  if ($("#tutorial-actions")) renderTutorial();
  if ($("#chapter-actions")) {
    const n = $("#chapter-actions");
    n.append(
      btn(
        progress?.complete
          ? "✓ Main objective complete"
          : ch?.task?.target
            ? "Go to " + ch.task.target.name + " →"
            : "Go to main objective →",
        () => travel(0, "activity"),
        "primary",
      ),
      btn("Learning encounters", learning),
      btn(
        progress?.challenge
          ? "✓ Challenge complete"
          : "Try the harder challenge",
        () => travel(1, "challenge"),
      ),
      btn(progress?.secret ? "✓ Clue discovered" : "Look for a secret", () =>
        travel(1, "secret"),
      ),
      btn(
        me.mystery ? "✓ Mystery solved" : "The neighborhood mystery",
        mystery,
      ),
    );
    if (ch?.rewardShop)
      n.append(
        btn("Rewards: " + ch.rewardShop.balance + " tokens", () =>
          travel(1, "rewards"),
        ),
      );
    if (e.paused) {
      n.querySelectorAll("button").forEach((b) => (b.disabled = true));
      n.prepend(
        Object.assign(document.createElement("p"), {
          className: "notice",
          textContent:
            "The host paused play. Movement, supplies, and scoring are frozen.",
        }),
      );
    }
  }
  if ($("#finale-action") && !isPresentation)
    $("#finale-action").append(
      btn(
        "Restore a home",
        async () => {
          const r = await act("finale");
          if (r !== null)
            toast(
              `Repair ${state.event.finale.contributors.indexOf(state.me.id) + 1} is yours. Your marker is lit in the neighborhood.`,
            );
        },
        "primary",
      ),
    );
  if ($("#finale-action button") && e.finale?.contributors?.includes(me.id)) {
    $("#finale-action button").textContent = "✓ Your home is restored";
    $("#finale-action button").disabled = true;
  }
  if (focused && !modal.open) {
    const buttons = [...mission.querySelectorAll("button")];
    const replacement =
      previousPhase === mission.dataset.phase
        ? buttons.find((b) => b.textContent === focusedText && !b.disabled) ||
          buttons[focusedIndex]
        : null;
    (replacement && !replacement.disabled ? replacement : activeCanvas)?.focus({
      preventScroll: true,
    });
  }
}
function nextChapterHTML() {
  const next = state.world?.find((c) => c.index === state.event.chapter + 1);
  if (!next)
    return `<section class="notice"><span class="eyebrow">UP NEXT · THE FINALE</span><h3>Bring the lights home</h3><p class="small">Scoring is finished. Every neighbor can restore a home together before the awards.</p></section>`;
  return `<section class="notice"><span class="eyebrow">UP NEXT · CHAPTER ${next.index + 1}</span><h3>${esc(next.title)}</h3>${next.objective ? `<p class="small">${esc(next.objective)}</p>` : ""}<p class="small">Start at ${esc(next.locations[0].name)}. Then explore ${esc(next.locations[1].name)} for a challenge and a hidden clue. The next chapter opens when this break ends.</p></section>`;
}
function rewardsShop() {
  const chapterIndex = state.event.chapter;
  const shop = state.chapter?.rewardShop;
  if (!shop) return;
  panel = "activity";
  open(
    "Turn rewards into a neighborhood repair",
    `<p class="notice">${shop.balance} tokens available · ${shop.earned} earned from completed jobs</p><p class="small">Finish all six jobs to use reward tokens. Tokens cannot be traded. Choose a different project for each redemption. These repairs do not add award points.</p><div class="choice-list" id="reward-projects"></div>`,
  );
  for (const [i, project] of shop.options.entries()) {
    const used = shop.uses.includes(project.id);
    const b = btn(
      `${used ? "✓ " : ""}${project.label} · ${project.cost} tokens — ${project.outcome}`,
      async () => {
        const r = await act("rewardRedeem", {
          choice: i,
          expectedChapter: chapterIndex,
        });
        if (r !== null) {
          rewardsShop();
          toast(r.message || project.outcome);
        }
      },
    );
    b.disabled =
      used ||
      shop.balance < project.cost ||
      state.me.progress[chapterIndex].step < state.rules.spatialTaskCount;
    $("#reward-projects").append(b);
  }
}
function contributionsHTML() {
  const c = state.event?.contributions || [];
  const restoration = restorationProgress(state.event);
  return (
    `<p class="small">${restoration.completed} completed objectives · AI control ${100 - restoration.percent}%</p><div class="progress-track" aria-label="Neighborhood restored ${restoration.percent}%"><div class="progress-fill" style="width:${restoration.percent}%"></div></div><p class="small muted">Completed objectives remove AI beacons and clear debris along the roads. Road centers remain open to everyone.</p>` +
    districts
      .map(
        (d, i) =>
          `<div class="stat-row"><span>${i + 1}. ${esc(d[1])}</span><strong>${typeof c[i] === "object" ? c[i]?.count || 0 : c[i] || 0}</strong></div>`,
      )
      .join("") +
    (state.rules?.rewards?.projects || [])
      .filter((p) => state.event.rewardProjects?.[p.id])
      .map(
        (p) =>
          `<p class="small">${esc(p.label)}: ${state.event.rewardProjects[p.id]} funded</p>`,
      )
      .join("")
  );
}
function awardsHTML() {
  const a = state.event?.awards || state.awards || [];
  return a.length
    ? '<ol class="leaderboard">' +
        a
          .map(
            (x, i) =>
              `<li><span class="rank">${i + 1}</span><span>${esc(x.category || x.title || x.name)}<br><strong>${esc(x.winnerName || x.winner?.name || x.playerName || x.name || state.players?.find((p) => p.id === x.playerId)?.name || x.playerId || x.winner || "Unawarded")}</strong></span></li>`,
          )
          .join("") +
        "</ol>"
    : '<p class="small muted">Winners appear here after the server settles the chapter.</p>';
}
function tutorialDone(step) {
  const t = state.me?.tutorial;
  return Array.isArray(t) ? t.includes(step) : !!t?.[step];
}
function renderTutorial() {
  const n = $("#tutorial-actions");
  const options = [
    [
      "move",
      "Move around",
      `Click the path or focus the map and use ${movementKeys()} / arrows.`,
    ],
    [
      "interact",
      "Meet your guide",
      "Practice interaction without competitive points.",
    ],
    [
      "collect",
      "Collect a practice supply",
      "Pick up a practice parcel. Your competitive inventory stays unchanged.",
    ],
    [
      "answer",
      "Answer a practice question",
      "Practice selecting and confirming an answer.",
    ],
    ["help", "Ask a neighbor for help", "Try a preset help request."],
  ];
  options.forEach(([s, t, desc]) => {
    const b = btn(
      `${tutorialDone(s) ? "✓" : "○"} ${t}`,
      () => {
        if (s === "move") {
          close();
          activeCanvas.focus();
          toast(desc);
          return;
        }
        if (s === "answer") {
          open(
            "A quick practice question",
            '<p>Which supply repairs a broken sign?</p><div class="choice-list" id="practice-answers"></div>',
          );
          ["Repair parts", "A robot compliment"].forEach((v, i) =>
            $("#practice-answers").append(
              btn(v, async () => {
                if (i === 0) {
                  const r = await act("tutorial", {
                    step: "answer",
                    choice: 0,
                  });
                  if (r !== null) {
                    close();
                    toast("Exactly. Repair parts belong in a useful cart.");
                  }
                } else toast("Try again. There are no points in practice.");
              }),
            ),
          );
        } else {
          open(t, `<p>${desc}</p><div id="practice-action"></div>`);
          $("#practice-action").append(
            btn(
              s === "help"
                ? "Request help"
                : s === "collect"
                  ? "Collect practice parcel"
                  : "Say hello",
              async () => {
                if (s === "help") await act("help", { preset: 0 });
                const r = await act("tutorial", { step: s });
                if (r === null) return;
                close();
                toast(
                  s === "interact"
                    ? "Guide: “The AI scheduled lunch for yesterday. We’re working on it.”"
                    : "Practice complete.",
                );
              },
              "primary",
            ),
          );
        }
      },
      tutorialDone(s) ? "quiet" : "",
    );
    n.append(b);
  });
  $("#ready-action").append(
    btn(
      state.me?.ready ? "✓ You’re ready" : "I’m ready",
      async () => {
        await act("ready");
      },
      "primary",
    ),
  );
}
function travel(index, kind) {
  if (!state.chapter?.locations?.[index]) return;
  const l =
      (kind === "activity" && state.chapter.task?.target) ||
      state.chapter.locations[index],
    p = state.me.position;
  const distance = Math.hypot(l.x - p.x, l.y - p.y);
  if (
    distance < (kind === "activity" && state.chapter.task?.target ? 60 : 100)
  ) {
    showActivity(kind);
    return;
  }
  setDestination(l.x, l.y, kind);
  toast(`Walking to ${l.name}. You can also use the keyboard.`);
  activeCanvas.focus();
}
function showActivity(kind) {
  if (kind === "rewards") {
    rewardsShop();
    return;
  }
  const chapterIndex = state.event.chapter;
  if (kind === "secret") {
    panel = "secret";
    open(
      "Something the AI missed",
      `<p>${esc(state.chapter?.secretHint || "A curious detail is tucked near this location.")}</p><div id="secret-action"></div>`,
    );
    $("#secret-action").append(
      btn(
        "Inspect this spot",
        async () => {
          const r = await act("secret", { expectedChapter: chapterIndex });
          if (r !== null) {
            toast(
              typeof r === "string"
                ? r
                : r.clue || r.message || "A clue is saved in your journal.",
            );
            close();
          }
        },
        "primary",
      ),
    );
    return;
  }
  const c = state.chapter,
    prog = state.me.progress?.[state.event.chapter];
  if (kind === "activity" && prog?.complete) {
    toast("You finished this objective. Try a challenge or help a neighbor.");
    return;
  }
  const task = kind === "challenge" ? c.challenge : c.task;
  if (!task) {
    toast("No activity is available right now.");
    return;
  }
  if (kind === "activity" && task.kind === "targeting") {
    targeting(task);
    return;
  }
  if (kind === "activity" && task.kind === "routing") {
    routing(task);
    return;
  }
  panel = kind;
  open(
    kind === "challenge"
      ? "A little extra trouble"
      : task.target?.name || c.locations[0].name,
    `${task.kind === "rewards" ? `<div class="notice">${c.rewardShop?.balance || 0} reward tokens available · ${c.rewardShop?.earned || 0} earned. Choose a neighborhood repair to finish your main objective. Tokens are nontradable; repairs add no award points.</div>` : ""}${task.kind === "budget" ? `<div class="notice">Fictional cycle ${(prog?.step || 0) + 1} of 3<br>Income ${task.income} + retained ${task.retained} = ${task.budget}<br>Payment due: ${task.due}. This budget cannot be traded.<br><span id="budget-clock"></span></div>` : ""}${
      chapterIndex === 0 && task.kind === "delivery"
        ? `<div class="notice">Cart: ${Object.entries(state.me.inventory)
            .map(([k, v]) => `${v} ${k}`)
            .join(" · ")}<br>Personal reserve: ${Object.entries(
            prog?.reserve || {},
          )
            .map(([k, v]) => `${v} ${k}`)
            .join(
              " · ",
            )}<br>Delivery ${(prog?.step || 0) + 1} of 3 · ${esc(task.stage || "load")}</div>`
        : ""
    }<span class="eyebrow">${esc(task.kind || "NEIGHBORHOOD TASK")} · ${kind === "challenge" ? "OPTIONAL CHALLENGE" : "STEP " + ((prog?.step || 0) + 1) + " OF " + (c.taskCount || task.totalSteps || 3)}</span>${task.evidence ? `<section class="evidence-card" aria-label="Evidence from your inspection"><span class="eyebrow">YOUR INSPECTION</span><p>${esc(task.evidence)}</p></section>` : ""}<h3 id="activity-prompt" tabindex="-1" style="margin-top:18px">${esc(task.prompt)}</h3><p class="small muted">Choose an action, then confirm. Keyboard and pointer use the same rules.</p><div class="choice-list" id="task-choices"></div><div class="row" id="task-confirm"></div>`,
  );
  selection = null;
  task.options.forEach((o, i) =>
    $("#task-choices").append(
      btn(
        `${i + 1}. ${typeof o === "string" ? o : o.label || o.text}`,
        () => choose(i),
        "choice",
      ),
    ),
  );
  $("#task-confirm").append(
    btn(
      "Confirm action",
      async () => {
        if (selection === null) {
          toast("Choose an action first.");
          return;
        }
        const r = await act(kind === "challenge" ? "challenge" : "task", {
          choice: selection,
          expectedChapter: chapterIndex,
          expectedStep: task.step,
          expectedStage: task.stage || null,
        });
        if (r !== null) {
          if (r.message) toast(r.message);
          if (
            state.me.progress?.[state.event.chapter]?.complete ||
            kind === "challenge"
          )
            close();
          else if (
            kind === "activity" &&
            state.chapter.task?.target &&
            Math.hypot(
              state.me.position.x - state.chapter.task.target.x,
              state.me.position.y - state.chapter.task.target.y,
            ) >= 60
          ) {
            close();
            travel(0, "activity");
          } else showActivity(kind);
        }
      },
      "primary",
    ),
  );
  $("#activity-prompt")?.focus({ preventScroll: true });
}
function choose(i) {
  if (!$("#task-choices")?.children[i]) return;
  selection = i;
  $("#task-choices")
    ?.querySelectorAll("button")
    .forEach((b, j) => {
      b.classList.toggle("selected", i === j);
      b.setAttribute("aria-pressed", String(i === j));
    });
  $("#task-choices").children[i].focus({ preventScroll: true });
  let status = $("#selection-status");
  if (!status) {
    status = document.createElement("p");
    status.id = "selection-status";
    status.className = "small";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    $("#task-choices").after(status);
  }
  status.textContent = `Selected: ${$("#task-choices").children[i].textContent}. Confirm when ready.`;
}
function learning() {
  panel = "learning";
  open(
    "A little human intelligence",
    '<p>Two encounters per chapter. Your first answer is scored; retries are just for learning.</p><div id="learning-list" class="stack"></div>',
  );
  (state.chapter?.questions || []).forEach((q, i) => {
    const answer = state.me.progress?.[state.event.chapter]?.quiz?.[i];
    $("#learning-list").append(
      btn(`${answer ? "✓ " : ""}Encounter ${i + 1}: ${q.prompt}`, () =>
        quiz(i),
      ),
    );
  });
}
function quiz(index) {
  const chapterIndex = state.event.chapter;
  const q = state.chapter.questions[index],
    a = state.me.progress?.[state.event.chapter]?.quiz?.[index];
  panel = "quiz";
  open(
    `Human intelligence · ${index + 1} of 2`,
    `<h3>${esc(q.prompt)}</h3>${a ? `<div class="notice">First answer: ${a.correct ? "correct" : "incorrect"}. ${esc(a.explanation)}</div><p class="small">Another answer is an unscored retry.</p>` : '<p class="small muted">Your first confirmed answer counts. Take a moment.</p>'}<div class="choice-list" id="task-choices"></div><div id="quiz-confirm"></div>`,
  );
  selection = null;
  q.options.forEach((o, i) =>
    $("#task-choices").append(btn(`${i + 1}. ${o}`, () => choose(i), "choice")),
  );
  $("#quiz-confirm").append(
    btn(
      a ? "Try again, unscored" : "Confirm answer",
      async () => {
        if (selection === null) {
          toast("Choose an answer first.");
          return;
        }
        const r = await act("quiz", {
          index,
          choice: selection,
          expectedChapter: chapterIndex,
        });
        if (r !== null) {
          if (r.explanation)
            toast(
              `${r.correct ? "Correct." : "Not quite."} ${r.first ? "First answer recorded." : "Unscored retry."} ${r.explanation}`,
            );
          quiz(index);
        }
      },
      "primary",
    ),
  );
}
function inventory(refresh = false) {
  panel = "inventory";
  if (!refresh) open("Your cart");
  const inv = state.me?.inventory || {},
    values = state.rules?.values || {};
  body.innerHTML =
    '<p class="small">Limited space. Useful supplies. Every trade needs both neighbors to confirm.</p>' +
    Object.entries(inv)
      .map(
        ([k, v]) =>
          `<div class="inventory-item"><strong>${esc(k)}</strong><span>${v} units ${typeof values[k] === "number" ? `· ${values[k]} value each` : ""}</span></div>`,
      )
      .join("") +
    reserveHTML() +
    '<div class="row" id="inventory-tools" style="margin-top:20px"></div>';
  $("#inventory-tools").append(
    btn("Trade with a neighbor", () => neighbors(), "primary"),
    btn("View the rules", rules),
  );
}
function neighbors(refresh = false) {
  const chapterIndex = state.event.chapter;
  panel = "neighbors";
  if (!refresh) open("Good neighbors, good odds");
  body.innerHTML =
    '<p class="small">Help with an unfinished task, offer a fair trade, or send a little encouragement.</p><div class="row" id="emotes"></div><h3 style="margin-top:22px">Ask for help</h3><div class="row" id="help-requests"></div><div id="neighbor-list"></div><h3 style="margin-top:22px">Your open trades</h3><div id="trade-list"></div>';
  (
    state.rules?.emotes || [
      "Wave",
      "Cheer",
      "Thanks",
      "Thinking",
      "Ready",
      "Robot dance",
    ]
  ).forEach((v, i) =>
    $("#emotes").append(btn(v, () => act("emote", { emote: i }), "quiet")),
  );
  (
    state.rules?.helpPresets || [
      "Help with my task",
      "Trade supplies",
      "Show me the way",
    ]
  ).forEach((v, i) =>
    $("#help-requests").append(
      btn(v, () => act("help", { preset: i }), "quiet"),
    ),
  );
  (state.players || [])
    .filter((p) => p.id !== state.me?.id)
    .forEach((p) => {
      const d = document.createElement("div");
      d.className = "player-item";
      d.innerHTML = `<strong>${esc(p.name)}${p.help !== null && p.help !== undefined ? '<br><span class="badge">Asked for help</span>' : ""}</strong>`;
      const r = document.createElement("div");
      r.className = "row";
      r.append(
        btn("Help", async () => {
          const v = await act("assist", {
            target: p.id,
            expectedChapter: chapterIndex,
          });
          if (v !== null)
            toast(
              "Assist registered. It counts when the unfinished task is completed.",
            );
        }),
        btn("Trade", () => trade(p)),
      );
      d.append(r);
      $("#neighbor-list").append(d);
    });
  (state.trades || []).forEach((t) => {
    const d = document.createElement("div");
    d.className = "card";
    d.style.padding = "14px";
    d.innerHTML = `<p class="small">${esc(t.from)} gives ${t.give.qty} ${esc(t.give.item)} for ${t.receive.qty} ${esc(t.receive.item)} from ${esc(t.to)}.</p><p class="small">Confirmed: ${t.confirmed?.length || 0} of 2</p>`;
    d.append(
      btn(
        "Confirm current offer",
        () =>
          act("tradeConfirm", { tradeId: t.id, expectedChapter: chapterIndex }),
        "primary",
      ),
      btn("Cancel", () => act("tradeCancel", { tradeId: t.id }), "quiet"),
    );
    $("#trade-list").append(d);
  });
}
function trade(p) {
  const chapterIndex = state.event.chapter;
  panel = "trade";
  open(
    `Trade with ${p.name}`,
    `<p class="small">No gift transfers. Both neighbors confirm the same offer. Inventory changes cancel unconfirmed offers.</p><form id="trade-form"><div class="grid2"><label>You give<select id="give-item">${Object.keys(
      state.me.inventory,
    )
      .map((k) => `<option>${esc(k)}</option>`)
      .join(
        "",
      )}</select></label><label>Quantity<input id="give-qty" type="number" min="1" max="3" value="1" required></label><label>You receive<select id="receive-item">${Object.keys(
      state.me.inventory,
    )
      .map((k) => `<option>${esc(k)}</option>`)
      .join(
        "",
      )}</select></label><label>Quantity<input id="receive-qty" type="number" min="1" max="3" value="1" required></label></div><button class="primary">Propose this trade</button></form>`,
  );
  $("#trade-form").onsubmit = async (e) => {
    e.preventDefault();
    const r = await act("tradeOffer", {
      target: p.id,
      expectedChapter: chapterIndex,
      give: { item: $("#give-item").value, qty: Number($("#give-qty").value) },
      receive: {
        item: $("#receive-item").value,
        qty: Number($("#receive-qty").value),
      },
    });
    if (r !== null) neighbors();
  };
}
function map() {
  panel = "map";
  open(
    "One shared neighborhood",
    `<p class="small">Eight districts around Bragging Square. The active chapter’s locations are open to everyone at once.</p><div class="chapter-map" id="map-districts"></div>`,
  );
  districts.forEach((d, i) => {
    const b = btn(
      `${i + 1}. ${d[0]}${i === state.event.chapter ? " · ACTIVE" : ""}`,
      () => {
        if (i !== state.event.chapter) {
          toast("That district opens in its chapter.");
          return;
        }
        close();
        travel(0, "activity");
      },
      i === state.event.chapter ? "primary" : "",
    );
    const places = document.createElement("span");
    places.className = "map-places";
    places.textContent = `${d[1]} · ${d[2]}`;
    b.append(places);
    $("#map-districts").append(b);
  });
}
function mystery() {
  const chapterIndex = state.event.chapter;
  panel = "mystery";
  open(
    "The neighborhood mystery",
    `<p>Eight districts. Eight overlooked clues. The AI missed a very human message.</p><p class="small">Your discovered clues:</p><div class="mystery">${districts.map((_, i) => esc(state.me.clues?.find((c) => c.chapter === i)?.letter || "_")).join(" ")}</div><form id="mystery-form"><label>Your answer<input id="mystery-answer" autocomplete="off" maxlength="64" required></label><p class="small">Type your answer or click your discovered letters. Both submit the same answer.</p><div id="mystery-letters" class="row" role="group" aria-label="Discovered clue letters"></div><div id="mystery-edit" class="row" style="margin:16px 0"></div><p id="mystery-entry-status" class="small" role="status" aria-live="polite"></p><button class="primary">Reveal the message</button></form>`,
  );
  const input = $("#mystery-answer");
  const announce = () => {
    $("#mystery-entry-status").textContent = input.value
      ? `Your answer: ${input.value}`
      : "Your answer is empty.";
  };
  for (const clue of [...(state.me.clues || [])].sort(
    (a, b) => a.chapter - b.chapter,
  )) {
    const letter = btn(`${clue.letter} · chapter ${clue.chapter + 1}`, () => {
      input.value = (input.value + clue.letter).slice(0, 64);
      announce();
    });
    letter.setAttribute(
      "aria-label",
      `Add ${clue.letter}, clue from chapter ${clue.chapter + 1}`,
    );
    $("#mystery-letters").append(letter);
  }
  if (!state.me.clues?.length)
    $("#mystery-letters").textContent =
      "Discovered letters will appear here as you find chapter secrets.";
  $("#mystery-edit").append(
    btn(
      "Backspace",
      () => {
        input.value = input.value.slice(0, -1);
        announce();
      },
      "quiet",
    ),
    btn(
      "Clear answer",
      () => {
        input.value = "";
        announce();
      },
      "quiet",
    ),
  );
  $("#mystery-form").onsubmit = async (e) => {
    e.preventDefault();
    const r = await act("mystery", {
      answer: input.value,
      expectedChapter: chapterIndex,
    });
    if (r !== null) {
      if (r.correct) close();
      toast(
        r.message ||
          (r.correct
            ? "Mystery solved."
            : "That message does not fit the clues yet."),
      );
    }
  };
}
function help() {
  panel = "help";
  open(
    "A hand with the controls",
    `<div class="notice">Help does not pause the shared clock.</div><table class="compact-table"><tr><th>Action</th><th>Keyboard</th><th>Mouse / trackpad</th></tr><tr><td>Move</td><td>${esc(movementKeys())} or arrows</td><td>Click a destination</td></tr><tr><td>Interact</td><td>${esc(keyLabel("interact"))} or Enter</td><td>Objective button</td></tr><tr><td>Choose</td><td>1–4, Tab + Enter</td><td>Click then confirm</td></tr><tr><td>Inventory / map</td><td>${esc(keyLabel("inventory"))} / ${esc(keyLabel("map"))}</td><td>Bottom buttons</td></tr><tr><td>Close</td><td>Escape</td><td>× button</td></tr></table><p class="small" style="margin-top:18px">Focus the map to use movement keys. In menus, Tab moves between controls. Your character passes through other players. Nothing requires sound or rapid clicking.</p><div class="row" id="help-buttons"></div>`,
  );
  $("#help-buttons").append(
    btn("See award rules", rules),
    btn("Change controls", settings),
  );
}
function rules() {
  panel = "rules";
  open(
    "Rules everyone plays by",
    `<p class="small">One prize per employee. Chapter prizes are allocated first, in chapter order. The top performer is still recognized if the prize passes to the next eligible neighbor.</p><ol class="small"><li>Top hoarder</li><li>Trailblazer</li><li>Neighborhood hero</li><li>Human intelligence champion</li><li>Easter egg hunter</li><li>Master trader</li><li>All-round survivor</li></ol><p class="small">First learning submissions count. Secrets offer clues, never supplies or scored answers. The finale cannot change awards.</p><h3>Frozen event rules</h3>${rulesHTML()}`,
  );
}
function settings() {
  panel = "settings";
  open(
    "Make yourself comfortable",
    '<div id="settings-fields"></div><label>Show spiders and insects?<select id="safe-select"><option value="false">Replace with friendly robots</option><option value="true">Show spiders and insects</option></select></label><h3>Remap gameplay keys</h3><div id="remap" class="grid2"></div><div id="settings-save"></div>',
  );
  settingsFields($("#settings-fields"));
  $("#safe-select").value = String(!safe);
  $("#safe-select").onchange = () =>
    noteVisualIntent($("#safe-select").value === "true", true);
  Object.entries(keys).forEach(([action, key]) => {
    const l = document.createElement("label");
    l.textContent = action;
    const i = document.createElement("input");
    i.value = key;
    i.maxLength = 1;
    i.dataset.action = action;
    l.append(i);
    $("#remap").append(l);
  });
  $("#settings-save").append(
    btn(
      "Save settings",
      async () => {
        const vals = [...$("#remap").querySelectorAll("input")].map((i) =>
          i.value.toLowerCase(),
        );
        if (vals.some((v) => !v.trim()) || new Set(vals).size !== vals.length) {
          toast("Choose a different, non-empty key for every action.");
          return;
        }
        keys = Object.fromEntries(
          [...$("#remap").querySelectorAll("input")].map((i) => [
            i.dataset.action,
            i.value.toLowerCase(),
          ]),
        );
        const insects = $("#safe-select").value === "true";
        const intent = noteVisualIntent(insects);
        const settings = readSettings();
        const result = await act("setup", {
          character: state.me.character,
          palette: state.me.palette,
          insects,
          settings: serverSettings(settings),
        });
        if (result !== null && commitVisualIntent(intent, insects)) {
          updateControlHints();
          close();
        }
      },
      "primary",
    ),
  );
}
function worldKeys(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(),
    pos = state.me?.position;
  if (!pos) return;
  const vector =
    k === keys.up || k === "arrowup"
      ? [0, -1]
      : k === keys.down || k === "arrowdown"
        ? [0, 1]
        : k === keys.left || k === "arrowleft"
          ? [-1, 0]
          : k === keys.right || k === "arrowright"
            ? [1, 0]
            : null;
  if (vector) {
    e.preventDefault();
    const next = clipMove(pos, {
      x: Math.max(30, Math.min(1170, pos.x + vector[0] * 35)),
      y: Math.max(30, Math.min(770, pos.y + vector[1] * 35)),
    });
    target = { ...next, path: [next] };
  } else if (k === keys.interact || k === "enter") {
    e.preventDefault();
    const loc = [
      state.chapter?.task?.target || state.chapter?.locations?.[0],
      state.chapter?.locations?.[1],
    ].filter(Boolean);
    const i = loc.findIndex(
      (l, index) =>
        Math.hypot(l.x - pos.x, l.y - pos.y) <
        (index === 0 && state.chapter?.task?.target ? 65 : 110),
    );
    if (i >= 0) showActivity(i ? "challenge" : "activity");
    else if (["lobby", "draft"].includes(state.event.phase)) {
      act("tutorial", { step: "interact" });
      toast("Guide: “Welcome. The robots rearranged the signs again.”");
    } else toast("Walk to one of the current chapter’s marked locations.");
  } else if (k === keys.inventory) {
    e.preventDefault();
    inventory();
  } else if (k === keys.map) {
    e.preventDefault();
    map();
  } else if (k === keys.help) {
    e.preventDefault();
    help();
  }
}
modal.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (/^[1-4]$/.test(e.key) && $("#task-choices")) {
    e.preventDefault();
    choose(Number(e.key) - 1);
  }
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && $("#task-choices")) {
    e.preventDefault();
    const total = $("#task-choices").children.length;
    choose(
      ((selection ?? -1) + (e.key === "ArrowDown" ? 1 : total - 1)) % total,
    );
  }
});
function frame(now) {
  if (!activeCanvas?.isConnected) return;
  measureFrame(now, state?.event?.phase);
  drawMap(activeCtx, true);
  if (target && connected && !modal.open && !isPresentation) {
    const p = state.me.position;
    const frozen =
      state.event.paused ||
      !["lobby", "chapter", "finale"].includes(state.event.phase);
    if (frozen) target = null;
    else if (now - lastMove > 100) {
      const elapsed = Math.min(0.25, (now - lastMove) / 1000);
      lastMove = now;
      const waypoint = target.path?.[0] || target;
      if (waypointReached(p, waypoint)) {
        if (target.path?.length > 1) {
          target.path.shift();
        } else {
          const arrival = target.arrival;
          target = null;
          if (arrival) showActivity(arrival);
        }
      } else {
        act(
          "move",
          stepToward(p, waypoint, state.rules?.moveSpeed || 190, elapsed),
        );
        if (
          ["lobby", "draft"].includes(state.event.phase) &&
          !tutorialDone("move") &&
          !tutorialMovePending &&
          Math.hypot(p.x - 600, p.y - 380) >= 20
        ) {
          tutorialMovePending = true;
          act("tutorial", { step: "move" }).finally(
            () => (tutorialMovePending = false),
          );
        }
      }
    }
  }
  const timer = $("#timer");
  if (timer) {
    const e = state.event || {},
      remaining = e.paused
        ? e.remainingMs
        : e.deadline
          ? e.deadline - (Date.now() + serverOffset)
          : 0,
      seconds = Math.max(0, Math.ceil(remaining / 1000));
    timer.textContent =
      e.deadline || e.paused
        ? `${Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
        : "LOBBY";
  }
  requestAnimationFrame(frame);
}
function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function drawAvatar(ctx, x, y, character = 0, color = 0, scale = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(scale, scale);
  const skin = ["#e7b787", "#a76b45", "#d39868", "#7e5039"][character % 4],
    shirt = palette[color % 6];
  rect(ctx, -5, 1, 4, 5, "#263b3f");
  rect(ctx, 2, 1, 4, 5, "#263b3f");
  rect(ctx, -6, -9, 12, 11, shirt);
  rect(ctx, -8, -8, 2, 8, skin);
  rect(ctx, 6, -8, 2, 8, skin);
  rect(ctx, -5, -19, 10, 11, skin);
  rect(
    ctx,
    -5,
    -20,
    10,
    4,
    character % 3 === 0
      ? "#e7d7ad"
      : character % 3 === 1
        ? "#493f38"
        : "#6b513b",
  );
  if (character % 4 === 0) {
    rect(ctx, -7, -18, 14, 3, shirt);
    rect(ctx, -5, -23, 10, 5, shirt);
  }
  if (character % 4 === 1) {
    rect(ctx, -6, -18, 3, 10, "#493f38");
    rect(ctx, 4, -18, 3, 10, "#493f38");
  }
  if (character % 4 === 2) {
    rect(ctx, -4, -14, 3, 2, "#29383c");
    rect(ctx, 2, -14, 3, 2, "#29383c");
  }
  rect(ctx, -3, -14, 1, 2, "#29383c");
  rect(ctx, 3, -14, 1, 2, "#29383c");
  rect(ctx, -1, -10, 3, 1, "#68493b");
  // Twelve silhouettes/accessories are original, with palette-independent details.
  if (character === 0) {
    rect(ctx, -7, -18, 14, 2, "#d8bf73");
    rect(ctx, -4, -22, 8, 3, "#ead797");
  }
  if (character === 1) {
    rect(ctx, -7, -7, 2, 8, "#63767b");
    rect(ctx, 4, -7, 2, 8, "#63767b");
    rect(ctx, -3, -2, 6, 3, "#d8cc9e");
  }
  if (character === 2) {
    rect(ctx, -5, -9, 10, 2, "#e4d1a2");
    rect(ctx, 3, -7, 3, 7, "#e4d1a2");
  }
  if (character === 3) {
    rect(ctx, -3, -7, 6, 3, "#f0dfbb");
    rect(ctx, -2, -5, 4, 2, "#f0dfbb");
  }
  if (character === 4) {
    rect(ctx, -4, -23, 8, 4, "#8b6754");
    rect(ctx, 4, -22, 4, 2, "#8b6754");
    rect(ctx, 4, -6, 5, 7, "#ccb288");
  }
  if (character === 5) {
    rect(ctx, -5, -15, 4, 3, "#192f3d");
    rect(ctx, 1, -15, 4, 3, "#192f3d");
    rect(ctx, -1, -14, 2, 1, "#192f3d");
  }
  if (character === 6) {
    rect(ctx, -6, -21, 12, 4, "#e1c259");
    rect(ctx, -7, -18, 14, 2, "#e1c259");
    rect(ctx, -4, -8, 2, 9, "#334d4b");
    rect(ctx, 3, -8, 2, 9, "#334d4b");
  }
  if (character === 7) {
    rect(ctx, -6, -20, 12, 4, "#53735b");
    rect(ctx, -8, -17, 16, 2, "#53735b");
    rect(ctx, -3, -7, 6, 5, "#b8d1a5");
  }
  if (character === 8) {
    rect(ctx, -7, -8, 3, 10, "#627d80");
    rect(ctx, 4, -8, 3, 10, "#627d80");
    rect(ctx, -1, -7, 3, 3, "#eedda7");
  }
  if (character === 9) {
    rect(ctx, -5, -22, 10, 5, "#e8e4c7");
    rect(ctx, -6, -18, 12, 2, "#334d4b");
    rect(ctx, -1, -7, 2, 6, "#edc655");
  }
  if (character === 10) {
    rect(ctx, -4, -23, 8, 5, "#b8d1a5");
    rect(ctx, -2, -26, 4, 4, "#e8d78a");
    rect(ctx, -2, -5, 4, 4, "#e8d78a");
  }
  if (character === 11) {
    rect(ctx, -6, -20, 12, 3, "#493f38");
    rect(ctx, -7, -17, 3, 5, "#493f38");
    rect(ctx, -5, -5, 10, 2, "#f0dfbb");
  }
  ctx.restore();
}
function tree(ctx, x, y, type = 0) {
  rect(ctx, x - 4, y + 9, 8, 18, "#84684c");
  rect(ctx, x - 14, y - 7, 28, 23, type ? "#537c58" : "#416e52");
  rect(ctx, x - 10, y - 15, 20, 12, "#5b8b59");
  rect(ctx, x - 17, y, 7, 13, "#5b8b59");
  rect(ctx, x - 8, y - 12, 8, 6, "#7b9c65");
}
function building(ctx, x, y, w, h, color, index, lit) {
  rect(ctx, x + 7, y + 8, w, h, "#52764f");
  rect(ctx, x, y, w, h, color);
  rect(ctx, x - 5, y - 5, w + 10, 14, "#334d4b");
  rect(ctx, x, y - 12, w, 9, index % 2 ? "#c78059" : "#476c65");
  rect(ctx, x + 8, y - 9, w - 16, 3, index % 2 ? "#e9ab78" : "#729789");
  rect(ctx, x + w / 2 - 8, y + h - 25, 16, 25, "#3d534b");
  rect(ctx, x + w / 2 + 3, y + h - 14, 2, 2, "#e7ca82");
  for (let i = 12; i < w - 12; i += 26) {
    rect(ctx, x + i, y + 22, 15, 21, "#426358");
    rect(ctx, x + i + 2, y + 24, 11, 17, lit ? "#f5d889" : "#9bb9a0");
    rect(ctx, x + i + 7, y + 24, 2, 17, "#426358");
    rect(ctx, x + i + 2, y + 31, 11, 2, "#426358");
  }
  if (h > 85)
    for (let i = 12; i < w - 12; i += 26) {
      rect(ctx, x + i, y + 57, 15, 15, lit ? "#f5d889" : "#9bb9a0");
      rect(ctx, x + i + 6, y + 57, 2, 15, "#426358");
    }
}
function drawMap(ctx, live) {
  ctx.clearRect(0, 0, 1200, 800);
  rect(ctx, 0, 0, 1200, 800, "#86a77a");
  for (let x = 0; x < 1200; x += 20)
    for (let y = 0; y < 800; y += 20) {
      if ((x * 13 + y * 7) % 93 < 20) rect(ctx, x + 3, y + 4, 3, 2, "#7b9d70");
      if ((x * 3 + y * 17) % 137 < 12)
        rect(ctx, x + 10, y + 12, 2, 3, "#a9bb84");
    }
  const road = "#c5b991";
  rect(ctx, 0, 245, 1200, 55, road);
  rect(ctx, 0, 505, 1200, 55, road);
  rect(ctx, 365, 0, 55, 800, road);
  rect(ctx, 780, 0, 55, 800, road);
  for (let x = 0; x < 1200; x += 38) {
    rect(ctx, x, 270, 14, 2, "#e3d8b4");
    rect(ctx, x, 530, 14, 2, "#e3d8b4");
  }
  for (let y = 0; y < 800; y += 38) {
    rect(ctx, 390, y, 2, 14, "#e3d8b4");
    rect(ctx, 805, y, 2, 14, "#e3d8b4");
  }
  const restoration = restorationProgress(state?.event);
  const roadSections = [
    [80, 251],
    [490, 251],
    [900, 251],
    [80, 511],
    [900, 511],
    [80, 550],
    [490, 550],
    [900, 550],
  ];
  roadSections.forEach(([x, y], i) => {
    const cleared = Math.floor(restoration.districts[i] * 4);
    for (let j = 0; j < 4; j++) {
      const bx = x + j * 49;
      if (j < cleared) {
        rect(ctx, bx, y, 31, 4, "#709989");
      } else {
        // Decorative shoulder debris leaves the traversable road center open.
        rect(ctx, bx, y - 2, 19, 7, "#756c65");
        rect(ctx, bx + 10, y - 6, 14, 8, "#989083");
        rect(ctx, bx + 5, y - 3, 4, 3, "#dfb67f");
      }
    }
  });
  cells.forEach(([col, row], i) => {
    const x = col * 415 + 34,
      y = row * 260 + 35,
      active = live && state?.event?.chapter === i;
    const districtRestored = restoration.districts[i];
    const lit = districtRestored > 0;
    rect(ctx, x - 10, y - 16, 305, 205, active ? "#a7bd7e" : "#8eac79");
    const a = DOORS[i * 2],
      b = DOORS[i * 2 + 1];
    building(
      ctx,
      a[0] - 45,
      a[1] - 85,
      90,
      65,
      ["#dfc799", "#b6c7a6", "#c4b8a8", "#d5b495"][i % 4],
      i,
      lit,
    );
    building(
      ctx,
      b[0] - 45,
      b[1] - 85,
      90,
      65,
      ["#c9d2b2", "#e0c29d", "#b6c7bd", "#ccc1a6"][i % 4],
      i + 1,
      lit,
    );
    rect(ctx, a[0] - 6, a[1] - 20, 12, 35, "#d9ccaa");
    rect(ctx, b[0] - 6, b[1] - 20, 12, 35, "#d9ccaa");
    // Original AI relay: its four control lights switch off as this district repairs.
    const relayX = x + 137,
      relayY = y + 100;
    rect(ctx, relayX, relayY, 23, 30, "#294450");
    rect(ctx, relayX + 9, relayY - 9, 5, 10, "#53646a");
    const activeLights = 4 - Math.floor(districtRestored * 4);
    for (let n = 0; n < 4; n++)
      rect(
        ctx,
        relayX + 4 + (n % 2) * 9,
        relayY + 5 + Math.floor(n / 2) * 10,
        6,
        6,
        n < activeLights ? "#e88960" : "#79b8af",
      );
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#233e3b";
    ctx.fillText(
      activeLights ? "AI RELAY" : "NEIGHBOR LINK",
      relayX + 11,
      relayY + 42,
    );
    tree(ctx, x + 137, y + 145, i % 2);
    tree(ctx, x + 276, y + 22);
    tree(ctx, x - 5, y + 148);
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#233e3b";
    ctx.fillText(districts[i][1].toUpperCase(), a[0], a[1] - 108);
    ctx.font = "10px monospace";
    ctx.fillText(districts[i][2], b[0], b[1] - 108);
    if (active) {
      rect(ctx, x + 13, y - 11, 18, 18, "#ed825e");
      ctx.fillStyle = "#142b35";
      ctx.font = "bold 12px monospace";
      ctx.fillText(String(i + 1), x + 22, y + 2);
    }
  });
  // The central square remains open, with no collisions between players.
  rect(ctx, 433, 314, 330, 175, "#ddd1a8");
  for (let x = 440; x < 760; x += 20)
    for (let y = 320; y < 485; y += 20) rect(ctx, x, y, 18, 18, "#d0c29a");
  rect(ctx, 563, 355, 70, 66, "#6d9790");
  rect(ctx, 570, 362, 56, 52, "#a6c9b6");
  rect(ctx, 579, 372, 38, 32, "#78aba1");
  rect(ctx, 592, 360, 12, 37, "#d7e4c9");
  rect(ctx, 584, 353, 28, 12, "#e9e6c9");
  rect(ctx, 587, 396, 24, 5, "#4a7c78");
  tree(ctx, 454, 346);
  tree(ctx, 738, 346);
  tree(ctx, 454, 458);
  tree(ctx, 738, 458);
  rect(ctx, 485, 438, 38, 8, "#967148");
  rect(ctx, 490, 446, 5, 8, "#574f3e");
  rect(ctx, 513, 446, 5, 8, "#574f3e");
  rect(ctx, 677, 438, 38, 8, "#967148");
  ctx.textAlign = "center";
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "#35544c";
  ctx.fillText("BRAGGING SQUARE", 600, 470);
  ctx.font = "10px monospace";
  ctx.fillText("PLEASE DO NOT FEED THE ALGORITHM", 600, 337);
  const projects = state?.event?.rewardProjects || {};
  if (projects.garden) {
    rect(ctx, 470, 378, 48, 30, "#78583e");
    for (let n = 0; n < 6; n++) {
      const x = 476 + (n % 3) * 14,
        y = 382 + Math.floor(n / 3) * 13;
      rect(ctx, x, y + 3, 3, 8, "#477050");
      rect(ctx, x - 3, y, 9, 5, "#b7d57b");
    }
  }
  if (projects.welcome) {
    rect(ctx, 679, 375, 44, 30, "#b5d88e");
    rect(ctx, 675, 371, 52, 8, "#e88960");
    ctx.fillStyle = "#233e3b";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("HELLO", 701, 395);
  }
  if (projects.festival) {
    rect(ctx, 575, 424, 53, 15, "#af8960");
    for (let n = 0; n < 5; n++) rect(ctx, 577 + n * 10, 418, 6, 6, palette[n]);
  }
  if (live) {
    rect(ctx, 444, 481, 310, 20, "#294450");
    ctx.fillStyle = "#f7f2df";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `AI CONTROL ${100 - restoration.percent}% · ${restoration.completed} REPAIRS`,
      600,
      495,
    );
    drawRepairs(ctx);
    const loc = [
      state?.chapter?.task?.target || state?.chapter?.locations?.[0],
      state?.chapter?.locations?.[1],
    ].filter(Boolean);
    loc.forEach((l, i) => {
      rect(ctx, l.x - 13, l.y - 35, 26, 24, i ? "#b9e5a5" : "#ed825e");
      ctx.fillStyle = "#142b35";
      ctx.font = "bold 13px monospace";
      ctx.fillText(i ? "?" : "!", l.x, l.y - 18);
      rect(ctx, l.x - 3, l.y - 11, 6, 5, i ? "#b9e5a5" : "#ed825e");
    });
    (state?.players || [])
      .filter(
        (p) =>
          p.connected !== false && (p.setup !== false || p.id === state.me?.id),
      )
      .sort(
        (a, b) => Number(a.id === state.me?.id) - Number(b.id === state.me?.id),
      )
      .forEach((p) => {
        const pos = p.position || { x: 600, y: 430 };
        rect(ctx, pos.x - 9, pos.y + 6, 18, 5, "#698768");
        drawAvatar(ctx, pos.x, pos.y, p.character || 0, p.palette || 0, 1.5);
        ctx.font = "bold 11px monospace";
        const label = p.name || "Neighbor",
          width = ctx.measureText(label).width + 10;
        rect(
          ctx,
          pos.x - width / 2,
          pos.y - 48,
          width,
          16,
          p.id === state.me?.id ? "#142b35" : "#f7f2df",
        );
        ctx.fillStyle = p.id === state.me?.id ? "#f7f2df" : "#142b35";
        ctx.fillText(label, pos.x, pos.y - 36);
        if (
          p.emote !== undefined &&
          p.emote !== null &&
          (!p.emote.until || p.emote.until > Date.now() + serverOffset)
        ) {
          ctx.font = "10px monospace";
          ctx.fillStyle = "#142b35";
          ctx.fillText(
            (state.rules?.emotes || [
              "Wave",
              "Cheer",
              "Thanks",
              "Thinking",
              "Ready",
              "Robot dance",
            ])[typeof p.emote === "object" ? p.emote.index : p.emote] || "",
            pos.x,
            pos.y - 56,
          );
        }
      });
    if (target) {
      ctx.strokeStyle = "#fff6ce";
      ctx.lineWidth = 3;
      ctx.strokeRect(target.x - 7, target.y - 7, 14, 14);
    }
  } else {
    [
      [530, 426, 0, 0],
      [665, 388, 5, 1],
      [700, 465, 9, 2],
      [450, 272, 4, 3],
      [290, 530, 7, 4],
    ].forEach((v) => drawAvatar(ctx, ...v, 1.7));
  }
}
async function host() {
  const generation = ++hostGeneration;
  hostStream?.close();
  hostStream = null;
  hostConnected = false;
  try {
    const snapshot = await api("/api/host/state");
    if (generation !== hostGeneration) return;
    hostProjection = reduceProjection(hostProjection, snapshot, {
      allowEpoch: true,
    });
    hostState = hostProjection.state;
    hostDashboard();
    startHostRefresh();
  } catch {
    if (generation !== hostGeneration) return;
    app.innerHTML =
      topbar() +
      `<main class="phone-screen card"><div class="eyebrow">EVENT OPERATIONS</div><h1>Welcome, operator.</h1><p class="small">Use your private operator access token. Employee invitations do not grant host access.</p><form id="host-login"><label>Operator access token<input id="host-token" type="password" autocomplete="off" required></label><button class="primary">Open event controls</button></form></main>`;
    $("#host-login").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("/api/host/login", { token: $("#host-token").value });
        host();
      } catch (err) {
        toast(err.message);
      }
    };
  }
}
async function hostCommand(type, extra = {}) {
  if (!hostConnected) {
    toast("Operator view is reconnecting. Wait for current event state.");
    return;
  }
  const generation = hostGeneration;
  try {
    const response = await api("/api/host/action", {
      type,
      requestId: crypto.randomUUID(),
      reason: extra.reason || "Operator requested from control page",
      ...extra,
    });
    if (generation !== hostGeneration) return;
    hostProjection = reduceProjection(hostProjection, response.state);
    hostState = hostProjection.state;
    hostDashboard();
  } catch (e) {
    toast(e.message);
  }
}
function hostDashboard() {
  const raw = hostState.state || hostState,
    e = raw.event || raw,
    ps = Array.isArray(raw.players)
      ? raw.players
      : Object.values(raw.players || {});
  app.innerHTML =
    topbar(
      '<span id="host-connection" class="pill">PRIVATE OPERATOR CONTROLS · CONNECTING</span>',
    ) +
    `<main class="host-shell"><div class="eyebrow safe">LIVE OPERATIONS</div><h1>${esc(e.name || "Second Nature Trail")}</h1><div class="host-stats">${[
      ["Players", ps.length],
      ["Connected", (raw.connections || []).length],
      [
        "Reconnecting",
        ps.filter((p) => p.connectionStatus === "reconnecting").length,
      ],
      [
        "Tutorial complete",
        ps.filter((p) =>
          Array.isArray(p.tutorial)
            ? p.tutorial.length >= 5
            : Object.values(p.tutorial || {}).filter(Boolean).length >= 5,
        ).length,
      ],
      ["Ready", ps.filter((p) => p.ready).length],
    ]
      .map(
        ([k, v]) =>
          `<div class="card"><span class="eyebrow">${k}</span><strong data-host-stat="${k}">${v}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="host-grid"><section class="card"><span class="eyebrow">EVENT STATE</span><h2 id="host-phase" style="margin-top:14px">${esc(e.phase || "draft")} ${e.paused ? "· paused" : ""}</h2><p id="host-context" class="small">Chapter ${Number(e.chapter ?? -1) + 1} of 8. Control owner: ${esc(e.controlOwner || raw.controlOwner || "See operator log")}.</p><div class="host-actions" id="host-actions"></div><hr><form id="broadcast-form"><label>Message to all players<input id="broadcast" maxlength="200" required></label><button>Broadcast message</button></form></section><section class="card"><h2>Operator log</h2><div class="log" id="host-log">${
      (raw.audit || raw.log || e.audit || [])
        .slice(-20)
        .reverse()
        .map(
          (a) =>
            `<div>${esc(new Date(a.at || a.time || Date.now()).toLocaleTimeString())} · ${esc(a.operatorId || a.operator || a.actor || "operator")} · ${esc(a.type || a.action)} · ${esc(a.reason || "")}</div>`,
        )
        .join("") || "No operator actions recorded yet."
    }</div><div class="row" id="host-links" style="margin-top:24px"></div></section><section class="card" style="grid-column:1/-1"><h2>Participant status</h2><div id="host-players"></div></section></div></main>`;
  const controls = [
    ["Open lobby", "lobby"],
    ["Start event", "start"],
    ["Cancel countdown", "cancelStart"],
    ["Pause", "pause"],
    ["Resume", "resume"],
    ["Shorten current phase", "shorten"],
    ["Advance to next phase", "advance"],
    ["Skip chapter", "skip"],
    ["End scoring", "endScoring"],
    ["Close event", "close"],
  ];
  controls.forEach(([label, type]) =>
    $("#host-actions").append(
      btn(
        label,
        () => {
          const raw = hostState.state || hostState;
          const e = raw.event;
          const ps = raw.players || [];
          open(
            label,
            `<p>${esc(e.name || "Second Nature Trail")} · ${ps.length} players · current phase ${esc(e.phase)}</p>${type === "shorten" ? `<label>Seconds remaining after this change<input id="host-seconds" type="number" min="1" step="1" max="${Math.max(1, Math.ceil((e.remainingMs || 0) / 1000))}" value="30" required></label>` : ""}${type === "advance" ? `<p class="notice">Ends this phase now. During a chapter, current results stay ranked and the chapter award settles. Use Skip chapter only for an unranked recovery.</p>` : ""}<label>Reason<input id="host-reason" value="${esc(label)}" required></label><div id="host-confirm"></div>`,
          );
          $("#host-confirm").append(
            btn(
              `Confirm: ${label}`,
              () => {
                const reason = $("#host-reason").value;
                if (!reason.trim()) return;
                const seconds =
                  type === "shorten"
                    ? Number($("#host-seconds").value)
                    : undefined;
                if (
                  type === "shorten" &&
                  (!Number.isInteger(seconds) || seconds < 1)
                )
                  return;
                close();
                hostCommand(type, {
                  reason,
                  ...(seconds === undefined ? {} : { seconds }),
                });
              },
              type === "skip" || type === "endScoring" ? "danger" : "primary",
            ),
          );
        },
        type === "start" ? "primary" : "",
      ),
    ),
  );
  $("#broadcast-form").onsubmit = (ev) => {
    ev.preventDefault();
    hostCommand("broadcast", { message: $("#broadcast").value });
  };
  const link = document.createElement("a");
  link.className = "button";
  link.href = "/presentation";
  link.target = "_blank";
  link.textContent = "Open safe presentation";
  $("#host-links").append(
    link,
    btn("Review frozen content and rules", () => {
      open(
        "Event content and scoring",
        `<p class="notice">${raw.rules?.contentApproved ? "Content marked approved in the frozen ruleset." : "Draft content: SN owner approval is still required before release."}</p><p class="small">Content fingerprint: <code style="overflow-wrap:anywhere">${esc(raw.contentHash || "Unavailable")}</code></p>${rulesHTML(raw)}`,
      );
    }),
    btn("Export results", () => {
      location.href = "/api/host/export";
    }),
    btn("Refresh status", host),
  );
  updateHostPlayers(ps);
  updateHostLive();
}
function updateHostPlayers(ps) {
  const liveIds = new Set(ps.map((p) => `host-player-${p.id}`));
  for (const row of $("#host-players").children)
    if (!liveIds.has(row.id)) row.remove();
  ps.forEach((p) => {
    let d = document.getElementById(`host-player-${p.id}`);
    if (d) {
      if (d.querySelector("strong").textContent !== p.name)
        d.querySelector("strong").textContent = p.name;
      const label = d.querySelector(".host-player-status");
      const text = hostPlayerStatus(p);
      if (label.textContent !== text) label.textContent = text;
      return;
    }
    d = document.createElement("div");
    d.id = `host-player-${p.id}`;
    d.className = "player-item";
    d.innerHTML = `<strong>${esc(p.name)}</strong><span class="small host-player-status">${hostPlayerStatus(p)}</span>`;
    d.append(
      btn("Rescue", () =>
        hostCommand("rescue", {
          target: p.id,
          playerId: p.id,
          reason: "Operator rescued a stuck character",
        }),
      ),
    );
    $("#host-players").append(d);
  });
}
function hostPlayerStatus(p) {
  const connection =
    p.connectionStatus === "connected"
      ? "Connected"
      : p.connectionStatus === "reconnecting"
        ? "Reconnecting / offline"
        : "Not joined";
  return `${connection} · ${p.ready ? "Ready" : p.setup ? "Practicing" : "Setup incomplete"}`;
}
window.addEventListener("resize", () => {
  if (activeCanvas) windowCheck();
});
async function init() {
  if (isHost) {
    host();
    return;
  }
  if (!capabilities()) return;
  if (isPresentation) {
    await presentation();
    return;
  }
  const token =
    new URLSearchParams(location.search).get("invite") ||
    new URLSearchParams(location.search).get("token");
  if (token) {
    await join(token);
    return;
  }
  try {
    await loadPlayer();
  } catch {
    landing();
  }
}
init();

function standingsHTML() {
  const rows = state.standings || [];
  if (!rows.length) return "";
  return (
    '<h3>Chapter standings</h3><ol class="leaderboard">' +
    rows
      .slice(0, 10)
      .map(
        (p, i) =>
          `<li><span class="rank">${i + 1}</span><span>${esc(p.name)}${p.eligible === false ? '<br><span class="small muted">Already awarded</span>' : ""}</span><span class="score">${p.score}</span></li>`,
      )
      .join("") +
    '</ol><p class="small muted">Ranking uses recorded chapter performance. Prize eligibility is separate.</p>'
  );
}
function rulesHTML(context = state) {
  const r = context.rules;
  if (!r) return "<p>The event rules are still loading.</p>";
  const list = (values, suffix = "") =>
    Object.entries(values || {})
      .map(([item, value]) => `${item}: ${value}${suffix}`)
      .join(" · ");
  const planValue = (plan) =>
    Object.entries(plan).reduce(
      (sum, [item, quantity]) => sum + r.values[item] * quantity,
      0,
    );
  const maxLoadValue = Math.max(...r.cargoPlans.map(planValue));
  const maxima = r.chapterMaxima;
  const maximumDescription =
    new Set(maxima).size === 1
      ? `${maxima[0]} points per chapter`
      : maxima
          .map(
            (value, index) =>
              `${context.world?.[index]?.title || `Chapter ${index + 1}`}: ${value}`,
          )
          .join("; ");
  const groups = [
    [
      "Supplies",
      [
        [
          "Storage",
          `${r.storageLimit} tradable items. Starting allocation: ${list(r.allocation)}.`,
        ],
        ["Published item values", list(r.values)],
        [
          "Delivery cart",
          `${r.cargoSlots} slots per load. Slot weights: ${list(r.cargoWeights)}.`,
        ],
        [
          "Available loads",
          r.cargoPlans
            .map((plan) => `${list(plan)}; safe value ${planValue(plan)}`)
            .join(" / "),
        ],
        [
          "Personal reserve",
          `${r.reservePerChapter} of each supply per chapter, used when that item runs out in your cart. Reserve items cannot be traded and do not count toward Top hoarder.`,
        ],
      ],
    ],
    [
      "Chapter scoring",
      [
        [
          "Site work",
          `${r.spatialTaskCount} inspected sites × ${r.spatialTaskPoints} points for each correct decision. Inspection itself earns no points. Applies to filters, identity, insurance, and rewards.`,
        ],
        [
          "Rewards projects",
          `${r.rewards.perJob} nontradable tokens per completed rewards job. After all ${r.spatialTaskCount} jobs, redeem at least one project to complete the objective; the redemption adds no score. Each project can be funded once per player: ${r.rewards.projects.map((p) => `${p.label}, ${p.cost} tokens`).join("; ")}. Remaining tokens may fund another affordable project.`,
        ],
        [
          "Cargo delivery",
          `Each delivery earns round(useful cargo value ÷ ${maxLoadValue} × ${r.taskPoints}) points, at most ${r.taskPoints}. The shortcut reduces every delivered item's value by ${r.deliveryDamage}, with a minimum item value of zero.`,
        ],
        [
          "Targeting",
          `${r.targetHitsPerSite} valid hits complete a site and earn ${r.taskPoints} points; three sites total. Partial sites add no main score. Every valid hit adds one to the ranking metric; each decoy subtracts one.`,
        ],
        [
          "Routing",
          `${r.taskPoints} points per valid home connection. A route must include its required relays, avoid broken links, and stay within the displayed cable budget.`,
        ],
        [
          "Fictional payments",
          `${r.taskPoints} points when the full amount is paid before that cycle's deadline; zero for a late or incomplete payment. The chapter ranks on-time payments first, then retained budget.`,
        ],
        [
          "Mistakes",
          `Wrong site decisions, decoy hits, invalid routes, and wrong harder-challenge answers subtract ${r.mistakePenalty} chapter points, with a zero-point floor. Wrong filter, insurance, rewards, target, or route decisions also subtract one from that chapter's primary ranking metric. In identity checks, only an actual false accusation subtracts from the primary metric; other incorrect decisions still lose chapter points.`,
        ],
        [
          "Harder challenge",
          `${r.challengePoints} points once per chapter, after completing the main objective.`,
        ],
        [
          "Learning encounters",
          `${r.quizPoints} points for each correct first answer. Incorrect or unanswered encounters earn zero. Later retries are unscored.`,
        ],
        [
          "Assists",
          `At most ${r.assistPoints} bonus points per chapter. Further distinct completed assists can count toward Neighborhood hero, but add no more chapter points. Each player pair counts once per chapter; reciprocal repeats do not count.`,
        ],
        [
          "All-round survivor",
          `Fixed maxima: ${maximumDescription}. Each ranked chapter is normalized to 0–100, then averaged. Unplayed ranked chapters count as zero; skipped chapters are excluded.`,
        ],
        [
          "Current objective",
          `${context.chapter?.title || "Current chapter"}: ${context.chapter?.taskCount ?? "loading"} main-objective steps.`,
        ],
      ],
    ],
    [
      "Timing",
      [
        [
          "Chapter and break",
          `${r.chapterMs / 60000} minutes of play, then ${r.breakMs / 60000} minutes of bragging. The opening ${r.countdownMs / 1000}-second countdown is included in chapter one's play window.`,
        ],
        [
          "Target rounds",
          `One attempt per ${r.targetRoundMs / 1000}-second round, starting with a ${r.targetTelegraphMs / 1000}-second preparation signal. Optional automatic confirmation submits only the target you selected, with the same timing and limits.`,
        ],
        [
          "Payment cycles",
          `${r.budgetIncomes.length} cycles of ${r.budgetCycleMs / 1000} seconds, measured from the chapter opening. A cycle cannot be paid early. Its full payment must arrive before the deadline.`,
        ],
        [
          "Payment amounts",
          `Cycle income: ${r.budgetIncomes.join(" / ")}. Amount due: ${r.budgetDues.join(" / ")}. Retained budget carries forward; the optional decoration costs ${r.optionalExpense}. This budget cannot be traded.`,
        ],
        [
          "Finale",
          `${r.finaleMs / 60000} minutes. Award inputs are frozen before it begins; finale contributions cannot change prizes.`,
        ],
      ],
    ],
  ];
  const names = {
    chapter: "Chapter prize",
    hoarder: "Top hoarder",
    trailblazer: "Trailblazer",
    hero: "Neighborhood hero",
    intelligence: "Human intelligence champion",
    discovery: "Easter egg hunter",
    trader: "Master trader",
    survivor: "All-round survivor",
  };
  return (
    `<p class="small muted">Frozen ruleset: ${esc(r.version)}</p>` +
    groups
      .map(
        ([title, rows]) =>
          `<h3 style="margin-top:20px">${esc(title)}</h3><table class="compact-table">${rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join("")}</table>`,
      )
      .join("") +
    `<h3 style="margin-top:20px">Who qualifies?</h3><table class="compact-table">${Object.entries(
      r.thresholds,
    )
      .map(
        ([key, value]) =>
          `<tr><th>${esc(names[key] || key)}</th><td>${esc(value)}</td></tr>`,
      )
      .join(
        "",
      )}</table><h3 style="margin-top:20px">Published tie breakers</h3><p class="small">${esc(r.ties)}</p><h3>When no one qualifies</h3><p class="small">${esc(r.fallback)}</p><div class="notice">${esc(r.fiction)}</div>`
  );
}

function targeting(task) {
  panel = "targeting";
  open(
    "Outbreak response",
    `<div class="eyebrow">TARGET SELECTION MODE · ARROWS SELECT · SPACE ACTS</div><h3 style="margin-top:16px">${esc(task.prompt || "Resolve the marked outbreak. Leave friendly neighbors alone.")}</h3><p class="small">One deliberate action per round. No rapid clicking. Your choice of visuals does not change the targets.</p><div class="row spread"><span id="round-label" class="badge">Round ${Number(task.round) + 1}</span><span id="round-timer" class="small"></span></div><div id="targets" class="target-grid" style="margin:18px 0"></div><p id="site-progress" class="notice"></p><label class="row"><input id="auto-target" type="checkbox">Confirm my selected target automatically when the signal opens</label><div id="target-confirm"></div><p id="target-status" class="notice"></p>`,
  );
  selection = null;
  drawTargets(task);
  $("#target-confirm").append(
    btn("Resolve selected target", resolveTarget, "primary"),
  );
  $("#auto-target").checked = autoTargetEnabled;
  $("#auto-target").onchange = (e) => {
    autoTargetEnabled = e.target.checked;
  };
  updateTargetStatus(task);
}
function drawTargets(task) {
  presentedTarget = { ...task, chapter: state.event.chapter };
  const holder = $("#targets");
  if (!holder) return;
  const focusedTarget = holder.contains(document.activeElement)
    ? document.activeElement.closest("button")?.dataset.targetId
    : undefined;
  holder.replaceChildren();
  (task.targets || []).forEach((t, i) => {
    const b = btn(
      "",
      () => {
        selection = t.id;
        drawTargets(state.chapter.task);
        $("#targets").children[i]?.focus({ preventScroll: true });
      },
      selection === t.id ? "selected" : "",
    );
    b.setAttribute(
      "aria-label",
      `${t.label}${t.marked ? " · warning marker" : ""}`,
    );
    b.setAttribute("aria-pressed", String(selection === t.id));
    b.dataset.targetId = String(t.id);
    const c = document.createElement("canvas");
    c.width = 88;
    c.height = 80;
    const ctx = c.getContext("2d");
    if (t.marked && !safe) {
      rect(ctx, 34, 31, 22, 24, "#516348");
      rect(ctx, 38, 23, 14, 10, "#516348");
      [
        [23, 28],
        [18, 40],
        [23, 55],
        [58, 28],
        [65, 40],
        [58, 55],
      ].forEach(([x, y]) => rect(ctx, x, y, 13, 4, "#516348"));
      rect(ctx, 39, 27, 3, 3, "#f7f2df");
      rect(ctx, 48, 27, 3, 3, "#f7f2df");
    } else {
      rect(ctx, 29, 31, 32, 25, t.marked ? "#e88960" : "#9bc9b0");
      rect(ctx, 25, 21, 40, 19, "#6a9690");
      rect(ctx, 31, 25, 28, 11, "#193e44");
      rect(ctx, 35, 28, 5, 5, "#e2edbd");
      rect(ctx, 51, 28, 5, 5, "#e2edbd");
      rect(ctx, 35, 57, 7, 8, "#44695f");
      rect(ctx, 49, 57, 7, 8, "#44695f");
      rect(ctx, 20, 40, 8, 12, "#44695f");
      rect(ctx, 62, 40, 8, 12, "#44695f");
      rect(ctx, 43, 13, 3, 8, "#44695f");
      rect(ctx, 40, 8, 9, 6, "#e6c565");
    }
    if (t.marked) {
      rect(ctx, 68, 3, 16, 18, "#e88960");
      ctx.fillStyle = "#142b35";
      ctx.font = "bold 14px monospace";
      ctx.fillText("!", 72, 17);
    }
    b.append(c, document.createTextNode(`${i + 1}. ${t.label}`));
    holder.append(b);
  });
  if (focusedTarget !== undefined)
    [...holder.children]
      .find((b) => b.dataset.targetId === focusedTarget)
      ?.focus({ preventScroll: true });
  updateTargetStatus(task);
}
function updateTargetStatus(task) {
  const preparing = Date.now() + serverOffset < (task.actionAllowedAt || 0);
  if ($("#site-progress"))
    $("#site-progress").textContent =
      `${task.target?.name || "Current site"} · ${task.siteHits || 0} / ${task.hitsRequired || 1} outbreaks resolved here`;
  if ($("#target-status"))
    $("#target-status").textContent = state.event.paused
      ? "Play is paused."
      : task.actedThisRound
        ? "Your action is recorded. The next round opens automatically."
        : preparing
          ? "Prepare: inspect the warning marker and select a target. The action signal opens shortly."
          : "Signal open: resolve your selected target.";
  $("#target-confirm button")?.toggleAttribute(
    "disabled",
    !!task.actedThisRound ||
      preparing ||
      targetRequestPending ||
      state.event.paused,
  );
}

async function resolveTarget() {
  if (
    targetRequestPending ||
    state.event.paused ||
    state.chapter.task.actedThisRound
  )
    return;
  if (Date.now() + serverOffset < (state.chapter.task.actionAllowedAt || 0)) {
    toast("Select a target now; wait for the action signal to confirm.");
    return;
  }
  if (selection === null) {
    toast("Select a target first.");
    return;
  }
  const shown = presentedTarget;
  targetRequestPending = true;
  autoTargetRound = `${shown.chapter}:${shown.step}:${shown.round}`;
  const r = await act("task", {
    choice: selection,
    expectedChapter: shown.chapter,
    expectedStep: shown.step,
    expectedStage: shown.stage || null,
    expectedRound: shown.round,
  });
  targetRequestPending = false;
  if (r !== null) {
    if (state.me.progress[state.event.chapter].complete) {
      close();
      toast("All outbreaks resolved.");
    } else if (state.chapter.task.step !== shown.step) {
      close();
      travel(0, "activity");
    } else {
      toast(
        r.correct
          ? "Outbreak resolved. Wait for the next round."
          : "That was a decoy. The next round gives you another chance.",
      );
      drawTargets(state.chapter.task);
    }
  }
}
function routing(task) {
  const chapterIndex = state.event.chapter;
  panel = "routing";
  routePath = [task.source];
  open(
    "Reconnect a home",
    `<div class="notice">Required relays: ${(task.requiredNodes || []).map(esc).join(", ") || "None"}. Cable budget: ${task.budget ?? "unlimited"} units.</div><div class="eyebrow">ROUTE PLANNING · NO DRAGGING REQUIRED</div><h3 style="margin-top:16px">Connect ${esc(task.destination)} to the exchange.</h3><p class="small">Build a path by selecting connected nodes. Broken links cannot carry the signal. Start at the exchange and finish at the home.</p><canvas id="routing-canvas" width="540" height="250" style="width:100%;border:2px solid var(--ink);background:#dce6cf" aria-label="Network diagram; the same connections are described by the node buttons below"></canvas><p class="small">Broken links: ${(task.blockedEdges || []).map((e) => e.map(esc).join(" ↔ ")).join("; ") || "None"}. Dashed lines show these breaks.</p><div id="route-nodes" class="choice-list"></div><p id="route-path" class="notice"></p><div class="row" id="route-actions"></div>`,
  );
  drawRouting(task);
  $("#route-actions").append(
    btn(
      "Connect this route",
      async () => {
        const r = await act("task", {
          path: routePath,
          expectedChapter: chapterIndex,
          expectedStep: task.step,
          expectedStage: task.stage || null,
        });
        if (r !== null) {
          if (state.me.progress[state.event.chapter].complete) {
            close();
            toast("Every home is connected.");
          } else if (
            state.chapter.task.target &&
            state.chapter.task.step !== task.step
          ) {
            close();
            travel(0, "activity");
          } else routing(state.chapter.task);
        }
      },
      "primary",
    ),
    btn(
      "Reset path",
      () => {
        routePath = [task.source];
        drawRouting(state.chapter.task);
      },
      "quiet",
    ),
  );
}
function drawRouting(task) {
  const c = $("#routing-canvas"),
    ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  const nodes = task.nodes || [];
  const xs = nodes.map((n) => n.x),
    ys = nodes.map((n) => n.y),
    maxX = Math.max(...xs, 1),
    maxY = Math.max(...ys, 1);
  const pos = (n) => ({
    x: 50 + (n.x / maxX) * 430,
    y: 35 + (n.y / maxY) * 175,
  });
  for (const edge of task.edges || []) {
    const a = nodes.find((n) => n.id === edge[0]),
      b = nodes.find((n) => n.id === edge[1]);
    if (!a || !b) continue;
    const pa = pos(a),
      pb = pos(b),
      broken = (task.blockedEdges || []).some(
        (e) => e.includes(a.id) && e.includes(b.id),
      );
    ctx.strokeStyle = broken ? "#af624d" : "#6b8d76";
    ctx.setLineDash(broken ? [5, 5] : []);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  nodes.forEach((n) => {
    const p = pos(n);
    rect(
      ctx,
      p.x - 11,
      p.y - 11,
      22,
      22,
      routePath.includes(n.id) ? "#ed825e" : "#f7f2df",
    );
    ctx.strokeStyle = "#142b35";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 11, p.y - 11, 22, 22);
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#142b35";
    ctx.fillText(n.label || n.id, p.x, p.y + 29);
  });
  const summary = routeSummary(task, routePath);
  $("#route-path").textContent =
    `${routePath.join(" → ")} · Cost ${summary.cost} / ${task.budget ?? "unlimited"}${summary.invalid ? " · Contains a missing or broken link" : ""}${summary.missing.length ? " · Still needs " + summary.missing.join(", ") : " · Required relays included"}`;
  const list = $("#route-nodes");
  list.replaceChildren();
  nodes.forEach((n) => {
    const links = (task.edges || [])
      .filter((e) => e.includes(n.id))
      .map((e) => {
        const other = e.find((id) => id !== n.id);
        return (
          other +
          " (cost " +
          (task.edgeCosts?.find(
            (c) =>
              [c.from, c.to].includes(n.id) && [c.from, c.to].includes(other),
          )?.cost ?? 0) +
          ")" +
          ((task.blockedEdges || []).some(
            (b) => b.includes(n.id) && b.includes(other),
          )
            ? " (broken)"
            : "")
        );
      });
    const b = btn(
      `${n.label || n.id} · links to ${links.join(", ")}`,
      () => {
        routePath.push(n.id);
        drawRouting(task);
        [...$("#route-nodes").children]
          .find((el) => el.dataset.nodeId === n.id)
          ?.focus({ preventScroll: true });
      },
      routePath.at(-1) === n.id ? "selected" : "",
    );
    b.dataset.nodeId = n.id;
    b.setAttribute("aria-pressed", String(routePath.at(-1) === n.id));
    list.append(b);
  });
}
modal.addEventListener("keydown", (e) => {
  if (
    panel !== "targeting" ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)
  )
    return;
  const t = state.chapter.task;
  if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    const ids = t.targets.map((x) => x.id),
      idx = ids.indexOf(selection),
      delta = ["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : ids.length - 1;
    selection = ids[(idx + delta + ids.length) % ids.length];
    drawTargets(t);
  }
  if (e.key === " ") {
    e.preventDefault();
    resolveTarget();
  }
  if (/^[1-3]$/.test(e.key)) {
    e.preventDefault();
    selection = t.targets[Number(e.key) - 1]?.id;
    drawTargets(t);
  }
});
setInterval(() => {
  if (panel === "targeting" && modal.open) {
    const task = state.chapter?.task;
    if (task?.kind !== "targeting") {
      close();
      return;
    }
    const label = $("#round-label");
    if (label && label.textContent !== `Round ${Number(task.round) + 1}`) {
      selection = null;
      drawTargets(task);
      label.textContent = `Round ${Number(task.round) + 1}`;
    }
    updateTargetStatus(task);
    if (
      autoTargetEnabled &&
      selection !== null &&
      !task.actedThisRound &&
      !targetRequestPending &&
      !state.event.paused &&
      Date.now() + serverOffset >= (task.actionAllowedAt || 0) &&
      autoTargetRound !== `${state.event.chapter}:${task.step}:${task.round}`
    )
      resolveTarget();
    if ($("#round-timer"))
      $("#round-timer").textContent =
        `Next round in ${Math.max(0, Math.ceil((task.nextRoundAt - Date.now() - serverOffset) / 1000))}s`;
  }
}, 250);
let audioContext = null,
  musicGain = null,
  effectsGain = null,
  musicStep = 0,
  musicInterval = null;
function startAudio() {
  if (!prefs.music && !prefs.effects) {
    if (musicGain) musicGain.gain.value = 0;
    if (effectsGain) effectsGain.gain.value = 0;
    return;
  }
  try {
    if (!audioContext) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      audioContext = new C();
      musicGain = audioContext.createGain();
      effectsGain = audioContext.createGain();
      musicGain.connect(audioContext.destination);
      effectsGain.connect(audioContext.destination);
    }
    audioContext.resume();
    musicGain.gain.value = ((prefs.music || 0) / 100) * 0.045;
    effectsGain.gain.value = ((prefs.effects || 0) / 100) * 0.04;
    if (!musicInterval)
      musicInterval = setInterval(() => {
        if (!prefs.music || document.hidden) return;
        const melody = [
          60, 67, 69, 67, 64, 62, 64, 67, 57, 64, 67, 69, 67, 64, 62, 60,
        ];
        const midi = melody[musicStep++ % melody.length];
        tone(440 * Math.pow(2, (midi - 69) / 12), 0.16, musicGain, "triangle");
      }, 320);
  } catch {}
}
function tone(frequency, duration, gain, type = "square") {
  if (!audioContext || !gain) return;
  const o = audioContext.createOscillator(),
    g = audioContext.createGain();
  o.type = type;
  o.frequency.value = frequency;
  g.gain.setValueAtTime(1, audioContext.currentTime);
  g.gain.exponentialRampToValueAtTime(
    0.01,
    audioContext.currentTime + duration,
  );
  o.connect(g);
  g.connect(gain);
  o.start();
  o.stop(audioContext.currentTime + duration);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}
function soundEffect() {
  if (prefs.effects) tone(660, 0.08, effectsGain, "triangle");
}
function startHostRefresh() {
  if (hostStream) return;
  const generation = hostGeneration;
  const source = new EventSource("/api/events?client=operator-view");
  hostStream = source;
  let bootstrap = true;
  const current = () => generation === hostGeneration && source === hostStream;
  source.onopen = () => {
    if (current()) {
      bootstrap = true;
      hostConnected = false;
      updateHostLive();
    }
  };
  source.addEventListener("state", (event) => {
    if (!current()) return;
    try {
      const next = reduceProjection(hostProjection, JSON.parse(event.data), {
        allowEpoch: bootstrap,
      });
      if (next === hostProjection) return;
      hostProjection = next;
      hostState = next.state;
      bootstrap = false;
      hostConnected = true;
      updateHostLive();
    } catch {}
  });
  source.onerror = () => {
    if (current()) {
      hostConnected = false;
      updateHostLive();
    }
  };
}
function updateHostLive() {
  if (!hostState || !$("#host-phase")) return;
  const raw = hostState.state || hostState,
    e = raw.event,
    ps = raw.players || [];
  $("#host-phase").textContent = e.phase + (e.paused ? " · paused" : "");
  $("#host-connection").textContent =
    "PRIVATE OPERATOR CONTROLS · " +
    (hostConnected ? "CONNECTED" : "RECONNECTING");
  const context = $("#host-context");
  if (context)
    context.textContent = `Chapter ${Number(e.chapter ?? -1) + 1} of 8. Control owner: ${e.controlOwner || raw.controlOwner || "No operator action yet"}.`;
  const values = {
    Players: ps.length,
    Connected: (raw.connections || []).length,
    Reconnecting: ps.filter((p) => p.connectionStatus === "reconnecting")
      .length,
    "Tutorial complete": ps.filter((p) =>
      Array.isArray(p.tutorial)
        ? p.tutorial.length >= 5
        : Object.values(p.tutorial || {}).filter(Boolean).length >= 5,
    ).length,
    Ready: ps.filter((p) => p.ready).length,
  };
  document.querySelectorAll("[data-host-stat]").forEach((n) => {
    const text = String(values[n.dataset.hostStat]);
    if (n.textContent !== text) n.textContent = text;
  });
  updateHostPlayers(ps);
  const log = $("#host-log");
  if (log) {
    const html =
      (raw.audit || [])
        .slice(-20)
        .reverse()
        .map(
          (a) =>
            `<div>${esc(new Date(a.at).toLocaleTimeString())} · ${esc(a.operatorId)} · ${esc(a.type)} · ${esc(a.reason)}</div>`,
        )
        .join("") || "No operator actions recorded yet.";
    if (log.innerHTML !== html) log.innerHTML = html;
  }
}
function setDestination(x, y, arrival) {
  const p = state.me?.position;
  if (!p) return;
  if (!isWalkable({ x, y })) {
    const obstacle = OBSTACLES.findIndex(
      (r) =>
        x >= r.x - 8 &&
        x <= r.x + r.width + 8 &&
        y >= r.y - 8 &&
        y <= r.y + r.height + 8,
    );
    if (obstacle >= 0) {
      [x, y] = DOORS[obstacle];
      if (Math.floor(obstacle / 2) === state.event.chapter)
        arrival = obstacle % 2 ? "challenge" : "activity";
    } else {
      toast("Choose an open path inside the neighborhood.");
      return;
    }
  }
  const path = findPath(p, { x, y });
  if (!path) {
    toast("That destination is blocked. Choose an open path.");
    return;
  }
  target = { x, y, path, arrival };
}
function drawRepairs(ctx) {
  const contributors = state?.event?.finale?.contributors || [];
  contributors.forEach((id, i) => {
    const district = i % 8,
      slot = Math.floor(i / 8),
      door = DOORS[district * 2],
      x = door[0] - 47 + (slot % 7) * 14,
      y = door[1] + 27 + Math.floor(slot / 7) * 18;
    rect(ctx, x, y, 10, 10, id === state.me?.id ? "#fff2ab" : "#b9e5a5");
    rect(ctx, x + 3, y + 2, 2, 6, "#43755b");
    rect(ctx, x + 1, y + 4, 6, 2, "#43755b");
    if (id === state.me?.id) {
      ctx.strokeStyle = "#142b35";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 3, y - 3, 16, 16);
      ctx.fillStyle = "#142b35";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("YOUR REPAIR", x + 5, y + 24);
    }
  });
}
setInterval(() => {
  const t = state?.chapter?.task;
  if (panel === "activity" && t?.kind === "budget" && $("#budget-clock")) {
    const now = Date.now() + serverOffset,
      waiting = now < t.opensAt;
    $("#budget-clock").textContent = waiting
      ? `Next cycle opens in ${Math.ceil((t.opensAt - now) / 1000)}s`
      : now > t.dueAt
        ? "This cycle’s deadline has passed. A late payment is still recorded."
        : `Payment due in ${Math.max(0, Math.ceil((t.dueAt - now) / 1000))}s`;
    if ($("#task-confirm button")) $("#task-confirm button").disabled = waiting;
  }
}, 250);
async function presentation() {
  const loading = ++loadGeneration,
    generation = detachStream();
  try {
    const snapshot = await api("/api/presentation");
    if (loading !== loadGeneration || generation !== streamGeneration) return;
    accept(snapshot, "full", true);
    if (!state)
      throw Error(
        "The server did not provide an ordered presentation snapshot.",
      );
    safe = true;
    connect();
    game();
  } catch (e) {
    app.innerHTML =
      topbar('<span class="pill">SAFE PRESENTATION</span>') +
      `<main class="phone-screen card"><div class="eyebrow">MEETING DISPLAY</div><h1>Bring the neighborhood into the room.</h1><p class="small">Use your presentation access token to open the read-only meeting display. This view always uses friendly robot visuals.</p><form id="presentation-login"><label>Presentation access token<input id="presentation-token" type="password" autocomplete="off" required></label><button class="primary">Open safe presentation</button></form><p id="presentation-error" class="error hidden" role="alert"></p><p class="small muted" style="margin-top:20px">Your event organizer provides this token. The display cannot control the event or change player progress.</p></main>`;
    $("#presentation-login").onsubmit = async (ev) => {
      ev.preventDefault();
      const button = $("#presentation-login button");
      button.disabled = true;
      try {
        await api("/api/presentation/login", {
          token: $("#presentation-token").value,
        });
        await presentation();
      } catch (err) {
        const error = $("#presentation-error");
        error.textContent = err.message;
        error.classList.remove("hidden");
        button.disabled = false;
      }
    };
  }
}
function preservePanelFocus(update) {
  const active = document.activeElement,
    buttons = [...body.querySelectorAll("button")],
    text = active?.textContent,
    index = buttons.indexOf(active);
  update();
  const next = [...body.querySelectorAll("button")];
  (next.find((b) => b.textContent === text) || next[index])?.focus({
    preventScroll: true,
  });
}
function reserveHTML() {
  const reserve = state.me?.progress?.[state.event.chapter]?.reserve;
  if (!reserve) return "";
  return `<h3 style="margin-top:20px">Your personal reserve</h3><p class="small muted">These essential supplies keep you in the game when your cart runs low. They cannot be traded and do not count toward your final inventory value.</p><p class="small">${Object.entries(
    reserve,
  )
    .map(([k, v]) => `${v} ${esc(k)}`)
    .join(" · ")}</p>`;
}
function keyLabel(action) {
  return (keys[action] || defaultKeys[action]).toUpperCase();
}
function movementKeys() {
  return ["up", "left", "down", "right"].map(keyLabel).join("");
}
function updateControlHints() {
  if (isPresentation) return;
  const buttons = $("#toolbar")?.children;
  if (buttons?.length >= 5) {
    buttons[0].textContent = `Inventory [${keyLabel("inventory")}]`;
    buttons[1].textContent = `Map [${keyLabel("map")}]`;
    buttons[3].textContent = `Help [${keyLabel("help")}]`;
  }
  const hint = $("#world-hint");
  if (hint)
    hint.textContent = `Click to walk · ${movementKeys()} / arrows to move · ${keyLabel("interact")} to interact`;
  activeCanvas?.setAttribute(
    "aria-label",
    `Shared neighborhood. Move with arrow keys or ${movementKeys()}, or click a destination. Press ${keyLabel("interact")} to interact. Tab reaches all menus.`,
  );
}
function verifiedHighlightHTML() {
  const chapter = state.event.chapter;
  if (state.event.ranked?.[chapter] === false)
    return '<div class="notice">This chapter was skipped and is unranked. No chapter prize is allocated.</div>';
  const award = state.event.awards?.find((a) => a.chapter === chapter);
  if (!award) return "";
  if (!award.playerId)
    return `<div class="notice">Chapter prize unawarded: ${esc(award.reason)}.</div>`;
  const labels = [
    "useful cargo value delivered",
    "correct installations minus incorrect attempts",
    "correct scam decisions minus false accusations",
    "preparation and recovery decision points",
    "valid targets resolved minus decoy hits",
    "on-time fictional payments",
    "distinct completed challenges",
    "valid homes connected minus invalid attempts",
  ];
  return `<section class="notice" aria-label="Recorded chapter highlight"><strong>Chapter prize: ${esc(award.name)}</strong><p class="small" style="margin:8px 0 0">Recorded result: ${award.metric} ${labels[chapter]}.${chapter === 5 ? ` Retained fictional budget: ${award.secondary}.` : ""}</p></section>`;
}

function noteVisualIntent(insects, persist = false) {
  latestVisualIntentInsects = insects;
  const generation = ++visualIntentGeneration;
  if (!insects) {
    forceSafe = true;
    safe = true;
    try {
      writeSafeOverride(localStorage, true);
    } catch {}
    if (persist) persistReplacement();
  }
  return generation;
}
function commitVisualIntent(generation, insects) {
  if (generation !== visualIntentGeneration) {
    if (!latestVisualIntentInsects) persistReplacement();
    return false;
  }
  forceSafe = !insects;
  safe = !insects;
  try {
    writeSafeOverride(localStorage, !insects);
  } catch {}
  return true;
}

async function persistReplacement() {
  if (
    latestVisualIntentInsects ||
    !forceSafe ||
    !connected ||
    !state?.me?.setup ||
    replacementSavePending ||
    state.me.insects === false
  )
    return;
  replacementSavePending = true;
  try {
    await act("setup", {
      character: state.me.character,
      palette: state.me.palette,
      insects: false,
      settings: state.me.settings,
    });
  } finally {
    replacementSavePending = false;
  }
}
