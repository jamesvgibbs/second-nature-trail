import { eventSceneModel, drawEventScene } from "/event-scenes.mjs";
import { chapterSceneModel, drawChapterScene, hitChapterHotspot, CHAPTER_SCENE_TITLES } from "/chapter-scenes.mjs";
import { filterSceneModel, drawFilterScene, hitFilterHotspot } from "/filter-scene.mjs";
import { overviewCrowd } from "/crowd-view.mjs";
import { createProjection, reduceProjection } from "/projection.mjs";
import { districtScenery, SQUARE_TREES, ROAD_BANDS } from "/scenery.mjs";
import { deliveryModel, actionReceipt } from "/trail-feedback.mjs";
import {
  FIELD_NOTES,
  fitWorld,
  DELIVERY_STAGES,
  stageLabel,
  SITE_LABELS,
} from "/trail-visuals.mjs";
import {
  moveDaySceneModel,
  drawMoveDayScene,
  hitMoveDayHotspot,
} from "/move-day-scene.mjs";
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
  chapterMapStatus,
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
let filterState = { epoch:null, key:"", selection:null, pending:false, token:0, overview:false, completedHome:null, journal:null, focusedPeerId:null };
let travelToastText = null;
let chapterSceneState = {epoch:null,chapter:null,key:"",round:null,selection:null,pending:false,token:0,overview:false,held:null,journal:null,focusedPeerId:null,route:[],auto:false,autoRound:null};
let moveDayOverview = false;
let moveDayState = {
  epoch: null,
  key: "",
  selection: null,
  pending: false,
  token: 0,
  journal: [],
  focusedPeerId: null,
};
let state = null,
  connected = false,
  authorizationLost = false,
  stream = null,
  target = null,
  lastMove = 0,
  activeCanvas = null,
  activeCtx = null,
  canvasObserver = null,
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
  modal.trailRevision = (modal.trailRevision || 0) + 1;
  target = null;
  $("#modal-title").textContent = title;
  body.innerHTML = html;
  if (!modal.open) modal.showModal();
  else $("#close-modal").focus({ preventScroll: true });
}
function close() {
  modal.trailRevision = (modal.trailRevision || 0) + 1;
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
      code: v.code,
    });
  return v;
}
async function act(type, fields = {}, observe = null) {
  const requestGeneration = streamGeneration;
  const expectedChapter = fields.expectedChapter ?? state?.event?.chapter;
  const requestPhase = state?.event?.phase;
  const requestModalRevision = modal.trailRevision;
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
    if (authorizationLost) {
      showSignInRequired();
      return null;
    }
    toast("Reconnecting. Your saved progress is safe; actions are paused.");
    return null;
  }
  try {
    const before = observe
      ? structuredClone({
          projectionEpoch: state.projectionEpoch,
          projectionVersion: state.projectionVersion,
          event: state.event,
          me: state.me,
          chapter: state.chapter,
          rules: state.rules,
        })
      : null;
    const action = {
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
    };
    const v = await api("/api/action", action);
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
    if (observe) observe({ before, after: response, action, result: v.result });
    return v.result;
  } catch (e) {
    if (requestGeneration === streamGeneration) {
      if (e.status === 401) loseAuthorization();
      else if (modal.trailRevision === requestModalRevision) toast(e.message);
    }
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
  return `<header class="topbar"><div class="brand"><span class="brand-mark">sn</span> SECOND NATURE TRAIL</div>${
    extra || '<span class="eyebrow">A neighborhood worth saving</span>'
  }</header>`;
}
function blocked(message, title = "A bigger adventure needs a bigger screen") {
  app.innerHTML =
    topbar() +
    `<main class="phone-screen card"><div class="eyebrow">Before you set out</div><h1>${esc(
      title,
    )}</h1><p>${esc(
      message,
    )}</p><p class="small">Event code: SN-TRAIL</p><div id="blocked-actions" class="row"></div><p class="small muted" style="margin-top:20px">Using a company laptop? Ask your event host for device support. Touchscreen laptops are supported.</p></main>`;
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
  app.innerHTML = `<div class="landing">${topbar()}<main class="hero"><section class="hero-copy"><div class="pill"><span class="dot"></span> 100 NEIGHBORS · ONE SHARED WORLD</div><h1>The machines<br>lost the plot.<br><span>We’ve got this.</span></h1><p>Pack your cart. Find your people. Bring a neighborhood back to life, one very human decision at a time.</p><form class="join-form"><label for="invite">Your private invitation code</label><div class="row"><input id="invite" name="invite" placeholder="Paste your invitation code" required autocomplete="off"><button class="primary">Set out →</button></div></form>${
    error ? `<p class="error">${esc(error)}</p>` : ""
  }<p class="small entry-note">Laptop or desktop · Keyboard or mouse · No install</p></section><section class="hero-art"><canvas id="hero-map" width="1200" height="800" aria-label="An arrival scene with a supply cart, neighbors and a neighborhood noticeboard"></canvas><div class="art-caption">EST. BEFORE THE ROBOTS GOT IDEAS &nbsp; / &nbsp; BRAGGING SQUARE</div></section></main><footer class="landing-bottom"><div><strong>08 chapters</strong><p>A fresh district. A different kind of trouble.</p></div><div><strong>15 ways to shine</strong><p>Find your edge. Help a neighbor find theirs.</p></div><div><strong>01 neighborhood</strong><p>Every repair makes this place a little more human.</p></div></footer></div>`;
  drawEventScene($("#hero-map").getContext("2d"), {}, { mode: "arrival" });
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
    if (e.status === 409 && e.code !== "PROFILE_ROLE_CONFLICT") {
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
  authorizationLost = false;
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
  if (!isPresentation) {
    try {
      const lease = await api(
        "/api/lease?client=" + encodeURIComponent(client),
      );
      if (generation !== streamGeneration) return;
      if (lease.otherClient && !takeover) {
        takenOver();
        return;
      }
    } catch (e) {
      if (generation !== streamGeneration) return;
      if (e.status === 401) {
        loseAuthorization();
        return;
      }
    }
  }
  const url = isPresentation
    ? "/api/events?presentation=1"
    : `/api/events?client=${encodeURIComponent(client)}${
        takeover ? "&takeover=1" : ""
      }`;
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

function loseAuthorization() {
  authorizationLost = true;
  detachStream();
  target = null;
  routePath = [];
  selection = null;
  presentedTarget = null;
  autoTargetEnabled = false;
  autoTargetRound = null;
  targetRequestPending = false;
  panel = "";
  updateConnection();
  showSignInRequired();
}
function showSignInRequired() {
  open(
    "Player sign-in required",
    '<p>This browser profile no longer has your player sign-in. Gameplay is stopped; your committed progress is saved.</p><p>Use your player invitation to sign in again. Keep operator controls and separately signed-in displays in a different browser or profile; another tab shares the same sign-in.</p><div id="sign-in-recovery"></div>',
  );
  $("#sign-in-recovery").append(
    btn("Open invitation entry", () => location.assign("/"), "primary"),
  );
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
      document.createTextNode(
        authorizationLost
          ? "SIGN-IN REQUIRED"
          : connected
            ? "CONNECTED"
            : "RECONNECTING",
      ),
    );
    if (authorizationLost) {
      el.append(btn("Sign-in help", showSignInRequired, "quiet"));
    } else if (!connected && !isPresentation)
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
    `<main class="setup"><div class="setup-welcome"><div><div class="eyebrow safe">YOUR NEIGHBORHOOD NEEDS YOU</div><h1>Make yourself at home.</h1><p class="intro">Hi, ${esc(
      state.me.name,
    )}. Pick your look and how you’d like to play.</p></div><canvas id="setup-art" width="1200" height="800" aria-hidden="true"></canvas></div><form id="setup-form"><div class="grid2"><section class="card"><h2>Choose your character</h2><div class="avatar-grid" id="avatars"></div><label>Pick a palette</label><div class="palette-grid" id="palettes"></div><p class="small muted">Same abilities. Same chances. Entirely your style.</p></section><section class="card"><h2>Show spiders and insects?</h2><p class="small">Choose before entering the world. Both versions play exactly the same.</p><label class="radio-choice"><input type="radio" name="insects" value="false" required> Replace with friendly robots</label><label class="radio-choice"><input type="radio" name="insects" value="true" required> Show spiders and insects</label><div id="setup-settings"></div></section></div><div class="row spread" style="margin-top:24px;color:var(--paper)"><span class="small">You can change these settings during play.</span><button class="primary">Enter Bragging Square →</button></div></form></main>`;
  drawEventScene($("#setup-art").getContext("2d"), state, { mode: "setup" });
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
  if (next.epoch !== projection.epoch) {
    target = null;
    if (typeof chapterSceneState !== "undefined") {chapterSceneState.held=null;chapterSceneState.journal=null;chapterSceneState.token++;chapterSceneState.pending=false;}
    if (typeof filterState !== "undefined") { filterState.completedHome=null; filterState.journal=null; }
    if (
      previous &&
      modal.open &&
      [
        "receipt",
        "activity",
        "challenge",
        "quiz",
        "secret",
        "targeting",
        "routing",
      ].includes(panel)
    ) {
      close();
      toast(
        "The connection has refreshed. Open the current activity to continue.",
      );
    }
  }
  projection = next;
  state = next.state;
  if (sceneAvailable() && (chapterSceneState.epoch !== state.projectionEpoch || chapterSceneState.chapter !== state.event.chapter)) syncChapterSceneState();
  reconcileTravelRoute();
  if (
    isMoveDayFocused() &&
    moveDayCompanionSignature(previous) !== moveDayCompanionSignature(state)
  )
    renderMoveDayCompanions();
  if (isFilterFocused() && filterCompanionSignature(previous) !== filterCompanionSignature(state)) renderFilterCompanions();
  if (sceneFocused() && sceneCompanionSignature(previous) !== sceneCompanionSignature(state)) renderSceneCompanions();
  if (kind === "move") return true;
  if ($("#supply-hud")) renderSupplyHUD();
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
    if (typeof chapterSceneState !== "undefined" && ["finale","awards","closed"].includes(e.phase)) chapterSceneState.overview=false;
    if (typeof chapterSceneState !== "undefined") { chapterSceneState.token++;chapterSceneState.pending=false;if(!["chapter","paused"].includes(e.phase)||e.chapter!==chapterSceneState.chapter){chapterSceneState.held=null;chapterSceneState.journal=null;} }
    if (typeof filterState !== "undefined" && filterState.pending) { filterState.token++; filterState.pending=false; }
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
        "receipt",
      ].includes(panel)
    ) {
      close();
      toast("The neighborhood has moved to the next phase.");
    }
    if (typeof filterState !== "undefined" && (e.chapter !== 1 || !["chapter", "paused"].includes(e.phase))) { filterState.completedHome=null; filterState.journal=null; filterState.token++; filterState.pending=false; }
    currentPhase = e.phase;
    currentChapter = e.chapter;
  }
  const signature = JSON.stringify([
    { ...state.event, remainingMs: undefined },
    state.chapter,
    state.me?.progress,
    state.me?.inventory,
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
  if (
    panel === "neighbors" &&
    modal.open &&
    (tradesChanged ||
      neighborListSignature(previous) !== neighborListSignature(state))
  )
    preservePanelFocus(() => neighbors(true));
  refreshNeighborEmotes();
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
function reconcileTravelRoute() {
  const position = state?.me?.position,
    waypoint = target?.path?.[0] || target;
  if (!position || !waypoint) return;
  const visible = clipMove(position, waypoint);
  if (Math.hypot(visible.x - waypoint.x, visible.y - waypoint.y) < 0.01) return;
  const path = findPath(position, target);
  if (path?.length) target = { ...target, path };
  else {
    target = null;
    toast("Your position changed. Choose a destination to continue.");
  }
}
function game() {
  app.innerHTML = `<main class="game ${
    isPresentation ? "presentation" : ""
  }">${topbar(
    `<div class="row"><span id="connection" class="pill"></span><div style="text-align:right"><div class="phase-label" id="phase-label"></div><div class="timer" id="timer">--:--</div></div></div>`,
  )}<div class="game-main"><section class="world-wrap"><div id="supply-hud" class="supply-hud"></div><div class="map-viewport"><canvas class="world" id="world" width="1200" height="800" tabindex="0" role="application" aria-label="Shared neighborhood. Move with arrow keys or WASD, or click a destination. Press E to interact. Tab reaches all menus."></canvas></div><div class="world-legend"><div class="map-label" id="map-label">BRAGGING SQUARE</div><div class="world-hint" id="world-hint">Click to walk · WASD / arrows to move · E to interact</div></div></section><aside class="mission" id="mission"></aside></div><footer class="game-footer"><div class="row" id="toolbar"></div><span class="small">One neighborhood. Everyone belongs.</span><span class="small" id="player-name"></span></footer></main>`;
  activeCanvas = $("#world");
  activeCtx = activeCanvas.getContext("2d");
  if (typeof canvasObserver !== "undefined") canvasObserver?.disconnect();
  if (typeof ResizeObserver !== "undefined" && activeCanvas.parentElement) {
    canvasObserver = new ResizeObserver(sizeWorldCanvas);
    canvasObserver.observe(activeCanvas.parentElement);
  }
  sizeWorldCanvas();
  renderSupplyHUD();
  if (!isPresentation) {
    const bar = $("#toolbar");
    bar.append(
      btn("Inventory [I]", () => inventory()),
      btn("Map [M]", map),
      btn("Neighbors", () => neighbors()),
      btn("Help [H]", help),
      btn("Settings", settings),
    );
    const notes = btn("Field notes", () => sceneAvailable() ? sceneFieldNotes() : isFilterAvailable() ? filterFieldNotes() : moveDayFieldNotes());
    notes.id = "field-notes-menu";
    const back = btn("Return to Move Day", () => sceneAvailable() ? setChapterOverview(false) : isFilterAvailable() ? setFilterOverview(false) : setMoveDayOverview(false));
    back.id = "move-day-return";
    bar.append(notes, back);
    $("#player-name").textContent = state.me?.name || "";
    activeCanvas.addEventListener("pointerdown", (e) => {
      const r = activeCanvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 1200,
        y = ((e.clientY - r.top) / r.height) * 800;
      if (sceneFocused()) sceneClick(x, y);
      else if (isFilterFocused()) filterSceneClick(x, y);
      else if (isMoveDayFocused()) moveDaySceneClick(x, y);
      else {
        setDestination(x, y);
        activeCanvas.focus();
      }
    });
    activeCanvas.addEventListener("keydown", worldKeys);
  } else {
    activeCanvas.setAttribute("role", "img");
    activeCanvas.setAttribute("tabindex", "-1");
    activeCanvas.setAttribute("aria-label", "Live read-only neighborhood illustration. Friendly robot visuals. Phase, shared progress and results are available in the adjacent event report.");
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
  const focused = document.activeElement;
  const editing =
    focused?.isConnected &&
    (["INPUT", "TEXTAREA", "SELECT"].includes(focused.tagName) ||
      focused.isContentEditable);
  if (!isPresentation && !modal.open && !editing)
    activeCanvas.focus({ preventScroll: true });
}
function sizeWorldCanvas() {
  const viewport = activeCanvas?.parentElement;
  if (!viewport) return;
  const size = fitWorld(viewport.clientWidth, viewport.clientHeight);
  activeCanvas.style.width = `${size.width}px`;
  activeCanvas.style.height = `${size.height}px`;
}
function renderSupplyHUD() {
  const hud = $("#supply-hud");
  if (!hud) return;
  if (state?.event?.archive?.finaleRecorded === false) {
    hud.innerHTML=`<span class="hud-caption">ARCHIVED RESULTS</span><strong>${(state.event.awards || state.awards || []).length} recorded awards</strong><span class="hud-safe">Finale outcome not retained</span>`;return;
  }
  if (isPresentation || !state?.me) {
    hud.innerHTML = `<span class="hud-caption">NEIGHBORHOOD FIELD REPORT</span><span class="hud-safe">${overviewCrowd(state, { presentation: true }).total} neighbors connected · Friendly robots</span>`;
    return;
  }
  if (sceneFocused()) {
    const model=syncChapterSceneState();
    hud.innerHTML=`<span class="hud-caption">${esc(model.title.toUpperCase())}</span><strong>${['finale','awards','closed'].includes(model.phase)?(model.ownRepair?'Your home restored':model.phase==='finale'?'Your repair awaits':'Event complete'):`${model.step}/${model.total} steps · Chapter score ${model.personalScore}`}</strong><span class="hud-safe">${model.shared.completed}/${model.shared.total} shared ${model.phase==='chapter'?'completions':'repairs'}</span>`;return;
  }
  if (isFilterFocused()) {
    const model=syncFilterState();
    hud.innerHTML=`<span class="hud-caption">FILTER SHORTAGE · HOME VISITS</span><strong>${model.step}/6 homes helped</strong><span class="hud-safe">District: ${model.sharedRecovery.completed}/${model.sharedRecovery.total} neighbors finished</span>`;
    return;
  }
  if (isMoveDayFocused()) {
    const model = deliveryModel(state);
    const shared = moveDaySceneModel(state).sharedRecovery;
    hud.innerHTML = `<span class="hud-caption">MOVE DAY · YOUR DELIVERY TRAIL</span><strong>${model.completedDeliveries} / ${model.totalDeliveries} deliveries</strong><span class="hud-safe">District: ${shared.completed}/${shared.total} neighbors finished</span>`;
    return;
  }
  const inventory = state.me.inventory || {};
  const used = Object.values(inventory).reduce((sum, n) => sum + n, 0);
  hud.innerHTML = `<div class="supply-total"><span class="hud-caption">YOUR SUPPLIES</span><strong>${used}<small> / ${
    state.rules?.storageLimit || 12
  } stored</small></strong></div><div class="supply-counts">${[
    "parts",
    "filters",
    "food",
    "cable",
  ]
    .map(
      (item) =>
        `<span class="supply-count"><i class="supply-icon ${item}" aria-hidden="true"></i><strong>${
          inventory[item] || 0
        }</strong><span>${item}</span></span>`,
    )
    .join("")}</div>`;
  const crowd = overviewCrowd(state);
  hud.innerHTML += `<span class="hud-safe overview-presence">${crowd.nearby} nearby · ${crowd.total} connected · Meet everyone in Neighbors</span>`;
}
function deliveryTrailHTML(task, progress) {
  const stage = DELIVERY_STAGES.findIndex(([key]) => key === task?.stage);
  return `<div class="delivery-trail" aria-label="Delivery stages">${DELIVERY_STAGES.map(
    ([key, label], i) =>
      `<span class="${
        progress?.complete
          ? "done"
          : i === stage
            ? "current"
            : i < stage
              ? "done"
              : ""
      }"${
        i === stage && !progress?.complete ? ' aria-current="step"' : ""
      }><b>${i + 1}</b>${label}</span>`,
  ).join("")}</div>`;
}
function isMoveDayAvailable() {
  return (
    !isPresentation &&
    state?.event?.chapter === 0 &&
    (state.event.phase === "chapter" ||
      (state.event.phase === "paused" && state.event.pausedPhase === "chapter"))
  );
}
function isMoveDayFocused() {
  return (
    typeof moveDayOverview !== "undefined" &&
    !moveDayOverview &&
    isMoveDayAvailable()
  );
}
function syncMoveDayState() {
  const model = deliveryModel(state);
  if (!model) return null;
  if (moveDayState.epoch !== state.projectionEpoch) {
    moveDayState = {
      epoch: state.projectionEpoch,
      key: "",
      selection: null,
      pending: false,
      token: moveDayState.token + 1,
      journal: [],
      focusedPeerId: null,
    };
  }
  const key = `${state.projectionEpoch}:${model.completedDeliveries}:${model.stage}`;
  if (moveDayState.key !== key) {
    moveDayState.key = key;
    moveDayState.selection = null;
  }
  return model;
}
function moveDayNearTarget() {
  const p = state?.me?.position,
    destination = state?.chapter?.task?.target;
  return (
    !!p &&
    !!destination &&
    Math.hypot(p.x - destination.x, p.y - destination.y) < 60
  );
}
function moveDaySidebarHTML() {
  const model = syncMoveDayState();
  if (!model) return "<p>Loading your delivery cart…</p>";
  const latest = moveDayState.journal.at(-1);
  const heading = model.complete ? "A little more human." : "Move Day";
  const manifest = model.loaded
    ? Object.entries(model.loaded)
        .map(([kind, qty]) => `${qty} ${esc(kind)}`)
        .join(" + ")
    : "Empty cart";
  return `<div class="move-day-sidebar"><span class="chapter-count">CHAPTER 1 · ${
    model.complete
      ? "DELIVERIES COMPLETE"
      : "TRIP " + model.deliveryNumber + " OF " + model.totalDeliveries
  }</span><h2>${heading}</h2><section class="travel-journal" aria-live="polite" aria-atomic="true"><span class="eyebrow">TRAVEL JOURNAL</span><h3 id="move-day-result" tabindex="-1">${esc(
    latest?.title ||
      (model.completedDeliveries
        ? `${model.completedDeliveries} ${model.completedDeliveries === 1 ? "delivery" : "deliveries"} made.`
        : "A home needs its supplies."),
  )}</h3><p>${esc(
    latest?.text ||
      (model.complete
        ? "The roadside home has supplies again."
        : model.loaded
          ? "Cargo packed. Choose your next stop."
          : "Choose a load, then a crossing."),
  )}</p></section><section class="focused-cart"><div class="row spread"><strong>${manifest}</strong><span>${
    model.slots
  }/${model.maxSlots} cart slots</span></div><div class="focused-supplies">${[
    "parts",
    "food",
    "cable",
  ]
    .map((item) => `<span><b>${model.storage[item]}</b> ${item}</span>`)
    .join(
      "",
    )}</div></section><div id="move-day-actions"></div><div id="move-day-companions" class="move-day-companions"></div></div>`;
}
function renderMoveDaySidebar() {
  const model = syncMoveDayState(),
    holder = $("#move-day-actions");
  if (!model || !holder) return;
  const paused = state.event.phase !== "chapter" || !!state.event.paused;
  const prompt = document.createElement("h3");
  prompt.id = "move-day-prompt";
  prompt.tabIndex = -1;
  prompt.textContent = model.complete
    ? "Where next?"
    : {
        load: "What will you carry?",
        route: "Which way will you go?",
        travel: "Check the crossing.",
        deliver: "Bring the supplies home.",
      }[model.stage];
  holder.append(prompt);
  if (!model.complete && ["load", "route"].includes(model.stage)) {
    const choices = document.createElement("div");
    choices.className = "move-day-choices";
    const options = model.stage === "load" ? model.plans : model.routes;
    options.forEach((option, i) => {
      const b = btn(
        option.label,
        () => selectMoveDayChoice(i),
        `move-day-choice${moveDayState.selection === i ? " selected" : ""}`,
      );
      b.dataset.focusKey = `move-day:${model.stage}:choice:${i}`;
      b.setAttribute("aria-pressed", String(moveDayState.selection === i));
      const detail = document.createElement("span");
      detail.className = "choice-detail";
      detail.textContent = deliveryChoiceDetail(model, i);
      b.append(detail);
      b.disabled = paused || moveDayState.pending || option.available === false;
      choices.append(b);
    });
    holder.append(choices);
  }
  const controls = document.createElement("div");
  controls.className = "move-day-controls";
  const near = moveDayNearTarget(),
    traveling = !!target?.arrival && target.arrival === "activity";
  const travelLabel = {
    load: model.completedDeliveries ? "Return to the depot" : "Go to the depot",
    route: "Return to the depot",
    travel:
      model.selectedRoute === "shortcut"
        ? "Take the damaged shortcut"
        : "Take the paved detour",
    deliver: "Go to the roadside home",
  }[model.stage];
  const actionLabel = {
    load: "Pack this load",
    route: "Choose this route",
    travel: "Inspect the crossing",
    deliver: "Deliver supplies",
  }[model.stage];
  const primary = btn(
    model.complete
      ? "Open field notes"
      : moveDayState.pending
        ? "Recording…"
        : !near
          ? traveling
            ? "On the way…"
            : travelLabel
          : actionLabel,
    model.complete ? moveDayFieldNotes : moveDayPrimary,
    "primary move-day-primary",
  );
  primary.id = "move-day-primary";
  primary.dataset.focusKey = "move-day:primary";
  primary.disabled =
    !model.complete && (paused || moveDayState.pending || (!near && traveling));
  controls.append(primary);
  if (!model.complete) {
    const status = document.createElement("p");
    status.id = "move-day-travel";
    status.className = "small move-day-travel";
    status.textContent = paused
      ? "The expedition is paused."
      : near
        ? "Ready when you are."
        : traveling
          ? "On the way to your next stop…"
          : "Head to your next stop when ready.";
    controls.append(status);
  }
  holder.append(controls);
  renderMoveDayCompanions();
}
function selectMoveDayChoice(index) {
  const model = syncMoveDayState();
  if (
    !model ||
    moveDayState.pending ||
    state.event.phase !== "chapter" ||
    state.event.paused
  )
    return;
  const option = (
    model.stage === "load"
      ? model.plans
      : model.stage === "route"
        ? model.routes
        : []
  )[index];
  if (!option || option.available === false) return;
  moveDayState.selection = index;
  renderMission();
  const button = [
    ...($("#move-day-actions")?.querySelectorAll("button") || []),
  ].find(
    (b) => b.dataset.focusKey === `move-day:${model.stage}:choice:${index}`,
  );
  button?.focus({ preventScroll: true });
}
function moveDayPrimary() {
  const model = syncMoveDayState();
  if (
    !model ||
    model.complete ||
    moveDayState.pending ||
    state.event.phase !== "chapter" ||
    state.event.paused
  )
    return;
  if (!moveDayNearTarget()) {
    travel(0, "activity");
    renderMission();
    return;
  }
  return submitMoveDayChoice();
}
async function submitMoveDayChoice() {
  const model = syncMoveDayState();
  if (
    !model ||
    model.complete ||
    moveDayState.pending ||
    state.event.phase !== "chapter" ||
    state.event.paused ||
    !moveDayNearTarget()
  )
    return;
  const choice = ["load", "route"].includes(model.stage)
    ? moveDayState.selection
    : 0;
  if (choice === null) {
    toast(
      model.stage === "load" ? "Choose a load first." : "Choose a route first.",
    );
    return;
  }
  const epoch = state.projectionEpoch,
    token = ++moveDayState.token;
  const originFocus = document.activeElement;
  const restoreFocus =
    originFocus === activeCanvas ||
    originFocus === document.body ||
    originFocus === document.documentElement ||
    $("#mission")?.contains(originFocus);
  const focusRevision = modal.trailRevision;
  moveDayState.pending = true;
  renderMission();
  let accepted = null;
  const result = await act(
    "task",
    {
      choice,
      expectedChapter: 0,
      expectedStep: model.completedDeliveries,
      expectedStage: model.stage,
    },
    (record) => {
      accepted = record;
    },
  );
  if (token !== moveDayState.token) return;
  moveDayState.pending = false;
  if (
    result === null ||
    state.projectionEpoch !== epoch ||
    state.event.chapter !== 0 ||
    state.event.phase !== "chapter"
  ) {
    if ($("#mission")) renderMission();
    return;
  }
  const receipt =
    accepted &&
    actionReceipt(
      accepted.before,
      accepted.after,
      accepted.action,
      accepted.result,
    );
  if (receipt && receiptMatchesState(accepted.after)) {
    clearTravelToast();
    const points = receipt.deltas.find(
      (item) => item.label === "Points this trip",
    );
    const text =
      model.stage === "deliver"
        ? `${receipt.details[0]} ${
            points ? "+" + points.value + " points. " : ""
          }${state.me.progress[0].step}/${
            model.totalDeliveries
          } deliveries made.`
        : receipt.details.slice(0, model.stage === "route" ? 2 : 1).join(" ");
    if (!moveDayState.journal.some((entry) => entry.id === receipt.id))
      moveDayState.journal = [
        ...moveDayState.journal.slice(-2),
        {
          id: receipt.id,
          title: receipt.title,
          text: text.replace(/the broken highway/gi, "the roadside home"),
        },
      ];
  }
  const currentFocus = document.activeElement;
  const focusHere =
    restoreFocus &&
    !modal.open &&
    modal.trailRevision === focusRevision &&
    isMoveDayFocused() &&
    !currentFocus?.dataset?.peerId &&
    (currentFocus === activeCanvas ||
      currentFocus === document.body ||
      currentFocus === document.documentElement ||
      $("#mission")?.contains(currentFocus));
  renderMission();
  if (focusHere && isMoveDayFocused())
    $("#move-day-result")?.focus({ preventScroll: true });
}
function setMoveDayOverview(overview) {
  moveDayOverview = !!overview;
  if (modal.open) close();
  renderSupplyHUD();
  renderMission();
  updateControlHints();
  activeCanvas?.focus({ preventScroll: true });
}
function moveDayFieldNotes() {
  panel = "field-notes";
  const progress = state.me?.progress?.[0];
  open(
    "Move Day · Field notes",
    `<p>Your chapter score: <strong>${
      progress?.score || 0
    }</strong> · Deliveries: ${
      progress?.step || 0
    }/3</p><p class="small">A delivery helps the roadside home. Finishing your objective also contributes to shared district recovery.</p><div id="move-day-notes" class="stack"></div><hr>${contributionsHTML()}`,
  );
  $("#move-day-notes").append(
    btn("Learning encounters", learning, "primary"),
    btn(
      progress?.challenge ? "✓ Challenge complete" : "Try the harder challenge",
      () => {
        close();
        travel(1, "challenge");
      },
    ),
    btn(progress?.secret ? "✓ Clue discovered" : "Look for a secret", () => {
      close();
      travel(1, "secret");
    }),
    btn("The neighborhood mystery", mystery),
    btn("Inventory & reserves", () => inventory()),
    btn("Rules & scoring", rules),
  );
}
function moveDayCompanionSignature(view) {
  if (!view) return "";
  const model = moveDaySceneModel(view, {
    focusedPeerId: moveDayState.focusedPeerId,
  });
  return JSON.stringify([
    model.teammateCount,
    model.nearbyCount,
    model.teammates.map((p) => [p.id, p.name]),
  ]);
}
function renderMoveDayCompanions() {
  const holder = $("#move-day-companions");
  if (
    !holder ||
    !isMoveDayAvailable() ||
    typeof moveDaySceneModel !== "function"
  )
    return;
  const model = moveDaySceneModel(state, {
    focusedPeerId: moveDayState.focusedPeerId,
  });
  const focusedPeer = holder.contains(document.activeElement)
    ? document.activeElement?.dataset?.peerId
    : null;
  const label = document.createElement("p");
  label.className = "small";
  label.textContent = `${model.nearbyCount || 0} nearby · ${
    (model.teammateCount || 0) + 1
  } connected`;
  holder.replaceChildren(label);
  (model.teammates || []).slice(0, 3).forEach((peer, i) => {
    const b = btn(
      moveDayState.focusedPeerId === peer.id
        ? peer.name
        : `Nearby companion ${i + 1}`,
      () => {
        moveDayState.focusedPeerId =
          moveDayState.focusedPeerId === peer.id ? null : peer.id;
        renderMoveDayCompanions();
        [...holder.querySelectorAll("button")]
          .find((b) => b.dataset.peerId === peer.id)
          ?.focus({ preventScroll: true });
      },
      "quiet",
    );
    b.dataset.peerId = peer.id;
    b.setAttribute(
      "aria-pressed",
      String(moveDayState.focusedPeerId === peer.id),
    );
    holder.append(b);
  });
  if (focusedPeer && !modal.open)
    (
      [...holder.querySelectorAll("button")].find(
        (b) => b.dataset.peerId === focusedPeer,
      ) || activeCanvas
    )?.focus({ preventScroll: true });
}
function moveDaySceneClick(x, y) {
  const model = moveDaySceneModel(state, {
    focusedPeerId: moveDayState.focusedPeerId,
  });
  const hotspot = hitMoveDayHotspot(model, x, y);
  if (!hotspot) return;
  if (hotspot.action === "overview") {
    setMoveDayOverview(true);
    return;
  }
  if (hotspot.action === "learning") {
    moveDayFieldNotes();
    return;
  }
  if (hotspot.action === "objective") {
    if (hotspot.route && state.chapter?.task?.stage === "route")
      selectMoveDayChoice(hotspot.route === "scenic" ? 0 : 1);
    else moveDayPrimary();
  }
}
function isFilterAvailable() {
  return (
    typeof filterState !== "undefined" &&
    !isPresentation &&
    state?.event?.chapter === 1 &&
    (state.event.phase === "chapter" ||
      (state.event.phase === "paused" && state.event.pausedPhase === "chapter"))
  );
}
function isFilterFocused() {
  return isFilterAvailable() && !filterState.overview;
}
function syncFilterState() {
  if (!isFilterAvailable()) return null;
  const epoch = state.projectionEpoch;
  if (filterState.epoch !== epoch)
    filterState = {
      epoch,
      key: "",
      selection: null,
      pending: false,
      token: filterState.token + 1,
      overview: filterState.overview,
      completedHome: null,
      journal: null,
      focusedPeerId: null,
    };
  const key = `${epoch}:${state.me.progress[1].step}:${state.chapter.task?.stage || "complete"}`;
  if (key !== filterState.key) {
    filterState.key = key;
    filterState.selection = null;
  }
  if (filterState.completedHome?.step !== state.me.progress[1].step)
    filterState.completedHome = null;
  return filterSceneModel(state, {
    selectedChoice: filterState.selection,
    completedHome: filterState.completedHome,
    focusedPeerId: filterState.focusedPeerId,
    pending: filterState.pending,
  });
}
function filterNearTarget() {
  const p = state?.me?.position,
    destination = state?.chapter?.task?.target;
  return (
    !!p &&
    !!destination &&
    Math.hypot(p.x - destination.x, p.y - destination.y) < 60
  );
}
function filterSidebarHTML() {
  const model = syncFilterState();
  if (!model) return "";
  const inventory = state.me.inventory?.filters || 0,
    reserve = state.me.progress[1].reserve?.filters || 0;
  return `<div class="filter-sidebar"><span class="chapter-count">CHAPTER 2 · HOME ${Math.min(6, model.stage === "installed" ? model.step : model.step + 1)} OF 6</span><h2>Filter shortage</h2><section class="travel-journal" aria-live="polite" aria-atomic="true"><h3 id="filter-result" tabindex="-1">${esc(filterState.journal?.title || (model.complete ? "Six homes breathing easier." : model.homeName))}</h3><p>${esc(filterState.journal?.text || (model.stage === "decide" ? "The equipment label is your reference." : "A resident needs help restoring airflow."))}</p></section><div class="filter-supply-line"><strong>${inventory} filters carried</strong><span>${reserve} in personal reserve</span></div>${model.evidence && model.stage === "decide" ? `<section class="filter-evidence"><span class="eyebrow">INSPECTED EQUIPMENT</span><p>${esc(model.evidence)}</p></section>` : ""}<div id="filter-actions"></div><div id="filter-companions" class="move-day-companions"></div></div>`;
}
function renderFilterSidebar() {
  const model = syncFilterState(),
    holder = $("#filter-actions");
  if (!model || !holder) return;
  if (model.stage === "decide") {
    const heading = document.createElement("h3");
    heading.textContent = "Choose the installation";
    holder.append(heading);
    const choices = document.createElement("div");
    choices.className = "move-day-choices filter-choices";
    model.options.forEach((option) => {
      const b = btn(
        `${option.id + 1}. ${option.label}`,
        () => selectFilterChoice(option.id),
        `move-day-choice${filterState.selection === option.id ? " selected" : ""}`,
      );
      b.dataset.focusKey = `filter:choice:${option.id}`;
      b.onkeydown = filterControlKeys;
      b.setAttribute(
        "aria-pressed",
        String(filterState.selection === option.id),
      );
      b.disabled = model.paused || filterState.pending;
      choices.append(b);
    });
    holder.append(choices);
  }
  const near = filterNearTarget(),
    traveling = target?.arrival === "activity";
  const label =
    model.stage === "installed"
      ? model.complete
        ? "Open field notes"
        : "Next home"
      : model.complete
        ? "Open field notes"
        : filterState.pending
          ? "Recording…"
          : !near
            ? traveling
              ? "On the way…"
              : `Visit ${model.homeName}`
            : model.stage === "inspect"
              ? "Inspect the unit"
              : "Install this choice";
  const primary = btn(label, filterPrimary, "primary move-day-primary");
  primary.id = "filter-primary";
  primary.onkeydown = filterControlKeys;
  const outcome = $("#filter-result");
  if (outcome) outcome.onkeydown = filterControlKeys;
  primary.dataset.focusKey = "filter:primary";
  primary.disabled =
    model.paused ||
    filterState.pending ||
    (!["installed", "complete"].includes(model.stage) && !near && traveling);
  const controls = document.createElement("div");
  controls.className = "move-day-controls";
  controls.append(primary);
  holder.append(controls);
  const status = document.createElement("p");
  status.className = "small filter-status";
  status.textContent = model.paused
    ? "The expedition is paused."
    : model.stage === "installed"
      ? "Repair recorded. Stay a moment, or continue."
      : model.complete
        ? "Every work order is complete."
        : traveling
          ? "Walking to the resident’s home…"
          : model.stage === "decide"
            ? `Correct installation: ${state.rules?.spatialTaskPoints || 10} points.`
            : "Read the equipment label before choosing.";
  holder.append(status);
  renderFilterCompanions();
}
function filterControlKeys(event) {
  if (!isFilterFocused() || event.ctrlKey || event.metaKey || event.altKey) return;
  const key=event.key.toLowerCase();
  if (key === keys.interact) { event.preventDefault(); return filterPrimary(); }
  if (/^[1-3]$/.test(key)) { event.preventDefault(); selectFilterChoice(Number(key)-1); }
}
function selectFilterChoice(index) {
  const model = syncFilterState();
  if (
    !model ||
    model.paused ||
    filterState.pending ||
    !model.options.some((o) => o.id === index)
  )
    return;
  filterState.selection = index;
  renderMission();
  [...($("#filter-actions")?.querySelectorAll("button") || [])]
    .find((b) => b.dataset.focusKey === `filter:choice:${index}`)
    ?.focus({ preventScroll: true });
}
function filterPrimary() {
  const model = syncFilterState();
  if (!model || model.paused || filterState.pending) return;
  if (model.complete) {
    filterFieldNotes();
    return;
  }
  if (model.stage === "installed") {
    filterState.completedHome = null;
    filterState.journal = null;
    filterState.selection = null;
    renderMission();
  }
  if (!filterNearTarget()) {
    travel(0, "activity");
    renderMission();
    return;
  }
  return submitFilterChoice();
}
async function submitFilterChoice() {
  const model = syncFilterState();
  if (
    !model ||
    model.paused ||
    model.complete ||
    filterState.pending ||
    !filterNearTarget() ||
    model.stage === "installed"
  )
    return;
  const choice = model.stage === "inspect" ? 0 : filterState.selection;
  if (choice === null) {
    toast("Choose an installation first.");
    return;
  }
  const epoch = state.projectionEpoch,
    token = ++filterState.token,
    revision = modal.trailRevision,
    origin = document.activeElement;
  const intent =
    origin === activeCanvas ||
    origin === document.body ||
    origin === document.documentElement ||
    $("#mission")?.contains(origin);
  filterState.pending = true;
  renderMission();
  let accepted = null;
  const result = await act(
    "task",
    {
      choice,
      expectedChapter: 1,
      expectedStep: model.step,
      expectedStage: model.stage,
    },
    (record) => {
      accepted = record;
    },
  );
  if (token !== filterState.token) return;
  filterState.pending = false;
  if (
    result === null ||
    state.projectionEpoch !== epoch ||
    state.event.chapter !== 1 ||
    state.event.phase !== "chapter" ||
    !accepted
  ) {
    if ($("#mission")) renderMission();
    return;
  }
  const after = accepted.after.me?.progress?.[1];
  if (receiptMatchesState(accepted.after)) {
    clearTravelToast();
    if (result.inspected)
      filterState.journal = {
        title: "Equipment inspected.",
        text: "Read the plate, then match your installation.",
      };
    else if (result.correct && after?.step === model.step + 1) {
      filterState.completedHome = {
        epoch,
        step: after.step,
        name: model.homeName,
        evidence: model.evidence,
        choiceLabel: model.options.find((o) => o.id === choice)?.label || "",
      };
      filterState.journal = {
        title: "Airflow restored.",
        text: `${model.homeName} is complete. ${after.step}/6 homes helped · Chapter score ${after.score}.`,
      };
    } else if (result.correct === false)
      filterState.journal = {
        title: "This installation needs another look.",
        text: `The home is not repaired yet. Check the equipment label and try again. Chapter score ${after?.score || 0}.`,
      };
  }
  const current = document.activeElement;
  const restore =
    intent &&
    !modal.open &&
    modal.trailRevision === revision &&
    isFilterFocused() &&
    !current?.dataset?.peerId &&
    (current === activeCanvas ||
      current === document.body ||
      current === document.documentElement ||
      $("#mission")?.contains(current));
  renderMission();
  if (restore) $("#filter-result")?.focus({ preventScroll: true });
}
function setFilterOverview(overview) {
  filterState.overview = !!overview;
  if (modal.open) close();
  renderSupplyHUD();
  renderMission();
  updateControlHints();
  activeCanvas?.focus({ preventScroll: true });
}
function filterFieldNotes() {
  panel = "field-notes";
  const progress = state.me.progress[1];
  open(
    "Filter shortage · Field notes",
    `<p>Homes helped: <strong>${progress.step}/6</strong> · Chapter score: <strong>${progress.score}</strong></p><div id="filter-notes" class="stack"></div><hr>${contributionsHTML()}`,
  );
  $("#filter-notes").append(
    btn("Learning encounters", learning, "primary"),
    btn(
      progress.challenge ? "✓ Challenge complete" : "Try the harder challenge",
      () => {
        close();
        travel(1, "challenge");
      },
    ),
    btn(progress.secret ? "✓ Clue discovered" : "Look for a secret", () => {
      close();
      travel(1, "secret");
    }),
    btn("The neighborhood mystery", mystery),
    btn("Inventory & reserves", () => inventory()),
    btn("Rules & scoring", rules),
  );
}
function filterCompanionSignature(view) {
  if (!view) return "";
  const model = filterSceneModel(view, {
    focusedPeerId: filterState.focusedPeerId,
  });
  return JSON.stringify([
    model.nearbyCount,
    model.teammateCount,
    model.teammates.map((p) => [p.id, p.name]),
  ]);
}
function renderFilterCompanions() {
  const holder = $("#filter-companions");
  if (!holder || !isFilterFocused()) return;
  const model = syncFilterState(),
    focused = holder.contains(document.activeElement)
      ? document.activeElement?.dataset?.peerId
      : null;
  const label = document.createElement("p");
  label.textContent = `${model.nearbyCount} nearby · ${model.teammateCount + 1} connected`;
  holder.replaceChildren(label);
  model.teammates.forEach((peer, i) => {
    const b = btn(
      peer.name || `Nearby companion ${i + 1}`,
      () => {
        filterState.focusedPeerId =
          filterState.focusedPeerId === peer.id ? null : peer.id;
        renderFilterCompanions();
        [...holder.querySelectorAll("button")]
          .find((b) => b.dataset.peerId === peer.id)
          ?.focus({ preventScroll: true });
      },
      "quiet",
    );
    b.dataset.peerId = peer.id;
    b.setAttribute(
      "aria-pressed",
      String(filterState.focusedPeerId === peer.id),
    );
    holder.append(b);
  });
  if (focused && !modal.open)
    (
      [...holder.querySelectorAll("button")].find(
        (b) => b.dataset.peerId === focused,
      ) || activeCanvas
    )?.focus({ preventScroll: true });
}
function filterSceneClick(x, y) {
  const model = syncFilterState();
  if (!model) return;
  const hit = hitFilterHotspot(model, x, y);
  if (!hit) return;
  if (hit.action === "choice") selectFilterChoice(hit.choice);
  else if (hit.action === "objective") filterPrimary();
}
function clearTravelToast() {
  if (typeof travelToastText === "undefined" || !travelToastText) return;
  const notice = $("#toast");
  if (notice?.textContent === travelToastText) {
    notice.style.display = "none";
    clearTimeout(toast.timer);
  }
  travelToastText = null;
}

function sceneAvailable() {
  if (typeof chapterSceneState === "undefined" || isPresentation) return false;
  const event = state?.event,
    phase = event?.phase === "paused" ? event.pausedPhase : event?.phase;
  return (
    !!event &&
    ((phase === "chapter" && event.chapter >= 2 && event.chapter <= 7) ||
      ["finale", "awards", "closed"].includes(phase))
  );
}
function sceneFocused() {
  return sceneAvailable() && !chapterSceneState.overview;
}
function syncChapterSceneState() {
  if (!sceneAvailable()) return null;
  const epoch = state.projectionEpoch,
    chapter = state.event.chapter,
    task = state.chapter?.task;
  if (
    chapterSceneState.epoch !== epoch ||
    chapterSceneState.chapter !== chapter
  )
    chapterSceneState = {
      epoch,
      chapter,
      key: "",
      round: null,
      selection: null,
      pending: false,
      token: chapterSceneState.token + 1,
      overview: false,
      held: null,
      journal: null,
      focusedPeerId: null,
      route: [],
      auto: false,
      autoRound: null,
    };
  const progress = state.me?.progress?.[chapter],
    key = `${epoch}:${chapter}:${progress?.step}:${task?.stage || task?.kind || "complete"}`;
  if (chapterSceneState.key !== key) {
    chapterSceneState.key = key;
    chapterSceneState.selection = null;
    chapterSceneState.route = task?.source ? [task.source] : [];
  }
  if (task?.kind === "targeting" && chapterSceneState.round !== task.round) {
    chapterSceneState.round = task.round;
    chapterSceneState.selection = null;
  }
  if (
    chapterSceneState.held?.step !== progress?.step ||
    !["chapter", "paused"].includes(state.event.phase)
  )
    chapterSceneState.held = null;
  return chapterSceneModel(state, chapterSceneOptions());
}
function chapterSceneOptions() {
  return {
    selection: chapterSceneState.selection,
    route: chapterSceneState.route,
    held: chapterSceneState.held,
    focusedPeerId: chapterSceneState.focusedPeerId,
    pending: chapterSceneState.pending,
    safe,
    now: Date.now() + serverOffset,
  };
}
function sceneNearTarget(shop = false) {
  const destination = shop
      ? state.chapter?.locations?.[1]
      : state.chapter?.task?.target || state.chapter?.locations?.[0],
    p = state.me?.position;
  return (
    !!p &&
    !!destination &&
    Math.hypot(p.x - destination.x, p.y - destination.y) <
      (shop ? 100 : state.chapter?.task?.target ? 60 : 100)
  );
}
function sceneShopAvailable() {
  return (
    state.event.chapter === 6 &&
    state.me.progress[6].step >= 6 &&
    !!state.chapter.rewardShop
  );
}
function sceneAffordableProjects() {
  if (!sceneShopAvailable()) return [];
  const shop=state.chapter.rewardShop;
  return shop.options.flatMap((project,index)=>!shop.uses.includes(project.id)&&shop.balance>=project.cost?[index]:[]);
}
function sceneRewardNeedsSelection(model) {
  const available=sceneAffordableProjects();
  return !model.held && sceneShopAvailable() && sceneNearTarget(true) && available.length>0 && !available.includes(chapterSceneState.selection);
}
function sceneSidebarHTML() {
  const m = syncChapterSceneState();
  if (!m) return "";
  const journal = chapterSceneState.journal,
    shop = state.chapter.rewardShop;
  const resources =
    m.chapter === 2 || m.chapter === 4
      ? ["parts"]
      : m.chapter === 5
        ? ["food"]
        : m.chapter === 7
          ? ["cable"]
          : ["parts", "food", "cable"];
  return `<section class="chapter-scene-sidebar"><span class="chapter-count">CHAPTER ${m.chapter + 1} · ${m.step}/${m.total} ${m.chapter === 5 ? "CYCLES" : "STEPS"}</span><h2>${esc(m.title)}</h2><section class="travel-journal" aria-live="polite" aria-atomic="true"><h3 id="scene-result" tabindex="-1">${esc(journal?.title || (m.completed ? "Chapter complete." : m.siteName))}</h3><p>${esc(journal?.text || (m.completed ? `Your main objective is complete. Chapter score ${m.personalScore}.` : m.story))}</p></section>${`<div class="scene-supplies">${resources.map((resource) => `<span><strong>${state.me.inventory?.[resource] || 0} ${esc(resource)}</strong><small>+ ${state.me.progress[m.chapter].reserve?.[resource] || 0} reserve</small></span>`).join("")}</div>`}${shop ? `<p class="scene-balance"><strong>${shop.balance} tokens</strong> · ${shop.earned} earned</p>` : ""}${m.evidence && !m.held ? `<section class="filter-evidence"><span class="eyebrow">INSPECTED EVIDENCE</span><p>${esc(m.evidence)}</p></section>` : ""}<div id="scene-actions"></div><div id="scene-companions" class="move-day-companions"></div></section>`;
}
function renderChapterSceneSidebar() {
  const m = syncChapterSceneState(),
    holder = $("#scene-actions");
  if (!m || !holder) return;
  const task = state.chapter.task,
    locked = m.paused || chapterSceneState.pending,
    shop = sceneShopAvailable() && !m.held;
  const result = $("#scene-result");
  if (result) result.onkeydown = sceneKeys;
  if (!m.held && (!m.completed || shop)) {
    if (task?.kind === "targeting") {
      const status = document.createElement("p");
      status.id = "scene-clock";
      status.className = "notice scene-clock";
      holder.append(status);
      const controls = document.createElement("div");
      controls.className = "move-day-choices scene-targets";
      (task.targets || []).forEach((t, i) => {
        const b = sceneChoiceButton(
          `${i + 1}. ${t.label}${t.marked ? " · WARNING" : ""}`,
          t.id,
          locked,
        );
        b.dataset.focusKey = `scene:choice:${t.id}`;
        controls.append(b);
      });
      holder.append(controls);
      const label = document.createElement("label");
      label.className = "scene-auto";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "scene-auto";
      input.dataset.focusKey = "scene:auto";
      input.checked = chapterSceneState.auto;
      input.disabled = locked;
      input.onchange = () => {
        chapterSceneState.auto = input.checked;
      };
      label.append(
        input,
        document.createTextNode(
          "Confirm my selected target when the signal opens",
        ),
      );
      holder.append(label);
      const count = document.createElement("p");
      count.className = "small";
      count.textContent = `${task.siteHits}/${task.hitsRequired} resolved here · One action per round`;
      holder.append(count);
    } else if (task?.kind === "routing") {
      const summary = routeSummary(task, chapterSceneState.route);
      const info = document.createElement("p");
      info.className = "scene-route-summary";
      info.textContent = `Required: ${task.requiredNodes.join(", ")} · Cable ${summary.cost}/${task.budget}${summary.invalid ? " · Broken or missing link" : ""}`;
      holder.append(info);
      const nodes = document.createElement("div");
      nodes.className = "scene-node-grid";
      task.nodes.forEach((n) => {
        const b = btn(
          n.label || n.id,
          () => selectSceneNode(n.id),
          chapterSceneState.route.at(-1) === n.id ? "selected" : "",
        );
        b.dataset.focusKey = `scene:node:${n.id}`;
        b.setAttribute(
          "aria-pressed",
          String(chapterSceneState.route.at(-1) === n.id),
        );
        b.disabled = locked;
        b.onkeydown = sceneKeys;
        nodes.append(b);
      });
      holder.append(nodes);
      const path = document.createElement("p");
      path.className = "small scene-path";
      path.textContent = chapterSceneState.route.join(" → ");
      holder.append(path);
      const current = chapterSceneState.route.at(-1),
        links = document.createElement("p");
      links.className = "small scene-links";
      links.textContent =
        "From " +
        current +
        ": " +
        task.edges
          .filter((e) => e.includes(current))
          .map((e) => {
            const other = e.find((n) => n !== current),
              cost = task.edgeCosts.find(
                (c) =>
                  [c.from, c.to].includes(current) &&
                  [c.from, c.to].includes(other),
              )?.cost;
            const broken = task.blockedEdges.some(
              (b) => b.includes(current) && b.includes(other),
            );
            return `${other} (${cost}${broken ? ", broken" : ""})`;
          })
          .join(" · ");
      holder.append(links);
      const reset = btn(
        "Reset path",
        () => {
          if (chapterSceneState.pending) return;
          chapterSceneState.route = [task.source];
          noteSceneRouteEdit();
          renderMission();
          $("#scene-primary")?.focus({ preventScroll: true });
        },
        "quiet",
      );
      reset.disabled = locked;
      holder.append(reset);
    } else if (task?.stage !== "inspect") {
      if (task?.kind === "budget") {
        const budget = document.createElement("p");
        budget.className = "scene-balance";
        budget.textContent = `${task.budget} available · ${task.due} due · ${task.retained} retained`;
        holder.append(budget);
        const clock = document.createElement("p");
        clock.id = "scene-clock";
        clock.className = "notice scene-clock";
        holder.append(clock);
      }
      const choices = document.createElement("div");
      choices.className = "move-day-choices scene-choices";
      const options = shop
        ? state.chapter.rewardShop.options.map(
            (p) => `${p.label} · ${p.cost} tokens`,
          )
        : task?.options || [];
      options.forEach((label, i) => {
        const project = shop ? state.chapter.rewardShop.options[i] : null,
          used = project && state.chapter.rewardShop.uses.includes(project.id),
          unaffordable =
            project && state.chapter.rewardShop.balance < project.cost;
        const b = sceneChoiceButton(
          `${i + 1}. ${used ? "✓ " : ""}${label}`,
          i,
          locked || !!used || !!unaffordable,
        );
        choices.append(b);
      });
      holder.append(choices);
    }
  }
  const controls = document.createElement("div");
  controls.className = "move-day-controls scene-primary-wrap";
  const primary = btn(
    scenePrimaryLabel(m),
    scenePrimary,
    "primary move-day-primary",
  );
  primary.id = "scene-primary";
  primary.dataset.focusKey = "scene:primary";
  primary.onkeydown = sceneKeys;
  primary.disabled = chapterSceneState.pending || (m.paused && !m.completed) || (!(m.paused && m.completed) && sceneRewardNeedsSelection(m));
  controls.append(primary);
  holder.append(controls);
  renderSceneCompanions();
  updateSceneClock();
}
function sceneChoiceButton(label, id, disabled) {
  const b = btn(
    label,
    () => selectSceneChoice(id),
    `move-day-choice${chapterSceneState.selection === id ? " selected" : ""}`,
  );
  b.dataset.focusKey = `scene:choice:${id}`;
  b.setAttribute("aria-pressed", String(chapterSceneState.selection === id));
  b.disabled = disabled;
  b.onkeydown = sceneKeys;
  return b;
}
function scenePrimaryLabel(m) {
  if (chapterSceneState.pending) return "Recording…";
  if (m.completed && m.paused) return "Open field notes";
  if (m.held)
    return m.completed
      ? m.chapter === 6
        ? "Review reward projects"
        : "Open field notes"
      : "Continue to the next stop";
  const task = state.chapter?.task;
  if (m.completed && !sceneShopAvailable()) return "Open field notes";
  const shopping = sceneShopAvailable();
  if (shopping && !sceneAffordableProjects().length) return "Open field notes";
  if (!sceneNearTarget(shopping))
    return target?.arrival === "activity"
      ? "On the way…"
      : shopping
        ? "Visit the night market"
        : `Visit ${m.siteName}`;
  if (shopping) return "Fund this project";
  return task?.stage === "inspect"
    ? "Inspect this site"
    : task?.kind === "targeting"
      ? "Resolve selected target"
      : task?.kind === "routing"
        ? "Connect this route"
        : task?.kind === "budget"
          ? "Record this payment"
          : "Confirm this choice";
}
function selectSceneChoice(index) {
  const m = syncChapterSceneState();
  if (!m || m.paused || m.held || chapterSceneState.pending) return;
  const task = state.chapter?.task;
  const possible = sceneShopAvailable()
    ? state.chapter.rewardShop.options.map((p, i) => ({
        id: i,
        disabled:
          state.chapter.rewardShop.uses.includes(p.id) ||
          state.chapter.rewardShop.balance < p.cost,
      }))
    : task?.kind === "targeting"
      ? task.targets
      : (task?.options || []).map((_, i) => ({ id: i }));
  if (!possible?.some((p) => p.id === index && !p.disabled)) return;
  chapterSceneState.selection = index;
  renderMission();
  [...($("#scene-actions")?.querySelectorAll("button") || [])]
    .find((b) => b.dataset.focusKey === `scene:choice:${index}`)
    ?.focus({ preventScroll: true });
}
function noteSceneRouteEdit() {
  if (chapterSceneState.journal) chapterSceneState.journal = { title:"Route updated.", text:"Review the links, required relays and cable budget before connecting." };
}
function selectSceneNode(id) {
  const m = syncChapterSceneState();
  if (
    !m ||
    m.paused ||
    m.held ||
    chapterSceneState.pending ||
    !state.chapter.task?.nodes?.some((n) => n.id === id)
  )
    return;
  chapterSceneState.route.push(id);
  noteSceneRouteEdit();
  renderMission();
  [...($("#scene-actions")?.querySelectorAll("button") || [])]
    .find((b) => b.dataset.focusKey === `scene:node:${id}`)
    ?.focus({ preventScroll: true });
}
async function contributeFinale() {
  if (
    contributeFinale.pending ||
    state.event.phase !== "finale" ||
    state.event.paused ||
    state.event.finale?.contributors?.includes(state.me.id)
  )
    return;
  const epoch = state.projectionEpoch,
    revision = modal.trailRevision;
  contributeFinale.pending = true;
  renderMission();
  const result = await act("finale");
  contributeFinale.pending = false;
  if (
    result !== null &&
    state.projectionEpoch === epoch &&
    state.event.phase === "finale" &&
    modal.trailRevision === revision &&
    state.event.finale?.contributors?.includes(state.me.id)
  )
    toast(
      `Repair ${state.event.finale.contributors.indexOf(state.me.id) + 1} is yours. Your marker is lit in the neighborhood.`,
    );
  if ($("#mission")) renderMission();
}
function scenePrimary() {
  const m = syncChapterSceneState();
  if (!m || chapterSceneState.pending) return;
  if (m.completed && m.paused && m.phase === "chapter") {
    sceneFieldNotes();
    return;
  }
  if (m.paused) return;
  if (m.phase === "finale") {
    const b = $("#finale-action button");
    if (b && !b.disabled) return b.onclick();
    return;
  }
  if (["awards", "closed"].includes(m.phase)) return;
  if (m.held) {
    chapterSceneState.held = null;
    chapterSceneState.journal = null;
    renderMission();
    if (m.completed && !sceneShopAvailable()) {
      sceneFieldNotes();
      return;
    }
    return;
  }
  if (m.completed && !sceneShopAvailable()) {
    sceneFieldNotes();
    return;
  }
  const shop = sceneShopAvailable();
  if (shop && !sceneAffordableProjects().length) { sceneFieldNotes(); return; }
  if (!sceneNearTarget(shop)) {
    if (shop) {
      const l = state.chapter.locations[1];
      setDestination(l.x, l.y, "activity");
      travelToastText = "Walking to the night market.";
      toast(travelToastText);
      activeCanvas?.focus();
    } else travel(0, "activity");
    renderMission();
    return;
  }
  const task = state.chapter.task;
  if (task?.kind === "routing")
    return submitSceneAction("task", { path: [...chapterSceneState.route] });
  const choice = task?.stage === "inspect" ? 0 : chapterSceneState.selection;
  if (shop && !sceneAffordableProjects().includes(choice)) { toast("Choose an available reward project first."); return; }
  if (choice === null) {
    toast(
      task?.kind === "targeting"
        ? "Select a warning-marked target first."
        : "Choose an option first.",
    );
    return;
  }
  if (task?.kind === "targeting") {
    if (
      task.actedThisRound ||
      Date.now() + serverOffset < task.actionAllowedAt
    ) {
      toast(
        task.actedThisRound
          ? "Your action is recorded for this round."
          : "Wait for the action signal.",
      );
      return;
    }
    return submitSceneAction("task", { choice, expectedRound: task.round });
  }
  if (task?.kind === "budget" && Date.now() + serverOffset < task.opensAt) {
    toast("This payment cycle has not opened yet.");
    return;
  }
  return submitSceneAction(shop && m.completed ? "rewardRedeem" : "task", {
    choice,
  });
}
async function submitSceneAction(type, fields) {
  const m = syncChapterSceneState();
  if (
    !m ||
    m.paused ||
    m.held ||
    chapterSceneState.pending ||
    !sceneNearTarget(sceneShopAvailable())
  )
    return;
  const task = state.chapter.task,
    token = ++chapterSceneState.token,
    epoch = state.projectionEpoch,
    chapter = state.event.chapter,
    revision = modal.trailRevision,
    route = [...chapterSceneState.route];
  const origin = document.activeElement,
    intent =
      origin === activeCanvas ||
      origin === document.body ||
      origin === document.documentElement ||
      $("#mission")?.contains(origin);
  chapterSceneState.pending = true;
  if (task?.kind === "targeting")
    chapterSceneState.autoRound = `${chapter}:${task.step}:${task.round}`;
  renderMission();
  let accepted = null;
  const result = await act(
    type,
    {
      ...fields,
      expectedChapter: chapter,
      ...(type === "task"
        ? { expectedStep: task.step, expectedStage: task.stage || null }
        : {}),
    },
    (record) => {
      accepted = record;
    },
  );
  if (token !== chapterSceneState.token) return;
  chapterSceneState.pending = false;
  if (
    result === null ||
    !accepted ||
    state.projectionEpoch !== epoch ||
    state.event.chapter !== chapter ||
    state.event.phase !== "chapter"
  ) {
    if ($("#mission")) renderMission();
    return;
  }
  if (receiptMatchesState(accepted.after)) {
    clearTravelToast();
    const after = accepted.after.me.progress[chapter],
      receipt = actionReceipt(
        accepted.before,
        accepted.after,
        accepted.action,
        accepted.result,
      );
    if (result.inspected)
      chapterSceneState.journal = {
        title: "Evidence inspected.",
        text: "Read the details before choosing your next step.",
      };
    else {
      const advanced = after.step > m.step;
      let title =
        receipt?.title ||
        (result.correct
          ? "Action recorded."
          : "That choice needs another look.");
      let text =
        (receipt?.details || []).slice(0, 2).join(" ") ||
        `Chapter score ${after.score}. ${result.correct ? "Your action is saved." : "The current site is still unresolved."}`;
      if (task?.stage === "decide" && [2, 3, 6].includes(chapter)) {
        const prior = accepted.before.me.progress[chapter];
        const changes = ["parts", "food", "cable"]
          .map((item) => {
            const delta =
              (accepted.after.me.inventory?.[item] || 0) +
              (after.reserve?.[item] || 0) -
              (accepted.before.me.inventory?.[item] || 0) -
              (prior.reserve?.[item] || 0);
            return delta ? `${item} ${delta > 0 ? "+" : ""}${delta}` : null;
          })
          .filter(Boolean);
        title = result.correct
          ? {
              2: "Contact checked.",
              3: "Recovery action recorded.",
              6: "Job complete.",
            }[chapter]
          : "This choice needs another look.";
        text = `${result.correct ? "+" + (state.rules.spatialTaskPoints || 10) + " task points. " : ""}Chapter score ${after.score}.${chapter === 6 && result.correct ? " +" + (after.rewardEarned - prior.rewardEarned) + " reward tokens." : ""}${changes.length ? " Supply change: " + changes.join(", ") + "." : ""}${!result.correct ? " Read the evidence and try again." : ""}`;
      } else if (task?.kind === "routing") {
        title = result.correct
          ? "Home connected."
          : "This route needs another look.";
        text = `${result.correct ? "+" + (state.rules.taskPoints || 20) + " task points. " : ""}Chapter score ${after.score}. ${receipt?.details?.[0] || ""}`;
      } else if (task?.kind === "budget") {
        title = result.correct
          ? "On-time payment recorded."
          : "Payment recorded · no on-time points.";
        text = `${receipt?.details?.slice(0, 2).join(" ") || ""}${result.correct ? " +" + (state.rules.taskPoints || 20) + " task points." : ""} Chapter score ${after.score}.`;
      } else if (task?.kind === "targeting" && advanced) {
        title = "Site cleared.";
        text = `${m.siteName} is clear. +${state.rules.taskPoints || 20} task points. Chapter score ${after.score}.`;
      } else if (type === "rewardRedeem" || task?.kind === "rewards") {
        title = "Project funded.";
        text = `${result.message || receipt?.details?.[0] || ""} ${after.rewardBalance} tokens remain. Chapter score ${after.score}.`;
      }

      if (task?.stage !== "decide") {
        const prior = accepted.before.me.progress[chapter];
        const changes = ["parts", "food", "cable"]
          .map((item) => {
            const delta =
              (accepted.after.me.inventory?.[item] || 0) +
              (after.reserve?.[item] || 0) -
              (accepted.before.me.inventory?.[item] || 0) -
              (prior.reserve?.[item] || 0);
            return delta ? `${item} ${delta > 0 ? "+" : ""}${delta}` : null;
          })
          .filter(Boolean);
        if (changes.length)
          text += " Supply change: " + changes.join(", ") + ".";
      }
      chapterSceneState.journal = { title, text };
      if (advanced || type === "rewardRedeem") {
        chapterSceneState.selection = null;
        chapterSceneState.held = {
          epoch,
          chapter,
          step: after.step,
          siteName: m.siteName,
          task: structuredClone(task),
          route,
          success: result.correct === true || type === "rewardRedeem",
          title,
          text,
        };
      }
      if (task?.kind === "targeting" && !advanced)
        chapterSceneState.journal = {
          title: result.correct ? "Outbreak resolved." : "That was a decoy.",
          text: `${after.siteHits}/${task.hitsRequired} at this site. Wait for the next round. Chapter score ${after.score}.`,
        };
    }
  }
  const current = document.activeElement,
    restore =
      intent &&
      !modal.open &&
      modal.trailRevision === revision &&
      sceneFocused() &&
      !current?.dataset?.peerId &&
      (current === activeCanvas ||
        current === document.body ||
        current === document.documentElement ||
        $("#mission")?.contains(current));
  renderMission();
  if (restore) $("#scene-result")?.focus({ preventScroll: true });
}
function updateSceneClock() {
  if (!sceneFocused()) return;
  const task = state.chapter?.task,
    clock = $("#scene-clock"),
    button = $("#scene-primary"),
    m = syncChapterSceneState();
  if (!m || m.held || m.completed) return;
  const now = Date.now() + serverOffset;
  if (clock && task?.kind === "targeting")
    clock.textContent = m.paused
      ? "Paused"
      : task.actedThisRound
        ? `Action recorded · next round in ${Math.max(0, Math.ceil((task.nextRoundAt - now) / 1000))}s`
        : now < task.actionAllowedAt
          ? `Prepare · signal in ${Math.max(0, Math.ceil((task.actionAllowedAt - now) / 1000))}s`
          : `Signal open · ${Math.max(0, Math.ceil((task.nextRoundAt - now) / 1000))}s left`;
  if (clock && task?.kind === "budget")
    clock.textContent = m.paused
      ? "Paused"
      : now < task.opensAt
        ? `Next cycle opens in ${Math.ceil((task.opensAt - now) / 1000)}s`
        : now <= task.dueAt
          ? `Payment due in ${Math.ceil((task.dueAt - now) / 1000)}s`
          : "Deadline passed · late payments earn no on-time points";
  if (button)
    button.disabled =
      m.paused ||
      chapterSceneState.pending ||
      (!sceneNearTarget(sceneShopAvailable()) &&
        target?.arrival === "activity") ||
      (sceneNearTarget() &&
        task?.kind === "targeting" &&
        (task.actedThisRound || now < task.actionAllowedAt)) ||
      (sceneNearTarget() && task?.kind === "budget" && now < task.opensAt) ||
      sceneRewardNeedsSelection(m);
}
function chapterSceneTick() {
  if (!sceneFocused()) return;
  const oldRound = chapterSceneState.round,
    m = syncChapterSceneState();
  if (!m) return;
  if (oldRound !== chapterSceneState.round && $("#scene-actions"))
    renderMission();
  updateSceneClock();
  const task = state.chapter?.task;
  if (
    task?.kind === "targeting" &&
    !m.held &&
    !modal.open &&
    !m.paused &&
    sceneNearTarget() &&
    chapterSceneState.auto &&
    chapterSceneState.selection !== null &&
    !chapterSceneState.pending &&
    !task.actedThisRound &&
    Date.now() + serverOffset >= task.actionAllowedAt &&
    chapterSceneState.autoRound !==
      `${state.event.chapter}:${task.step}:${task.round}`
  )
    scenePrimary();
}
function sceneKeys(event) {
  if (
    !sceneFocused() ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName)
  )
    return;
  const key = event.key.toLowerCase(),
    task = state.chapter?.task;
  if (key === keys.interact || (task?.kind === "targeting" && key === " ")) {
    event.preventDefault();
    return scenePrimary();
  }
  if (/^[1-3]$/.test(key)) {
    event.preventDefault();
    const id =
      task?.kind === "targeting"
        ? task.targets[Number(key) - 1]?.id
        : Number(key) - 1;
    selectSceneChoice(id);
  } else if (task?.kind === "targeting" && key.startsWith("arrow")) {
    event.preventDefault();
    const ids = task.targets.map((t) => t.id),
      index = ids.indexOf(chapterSceneState.selection),
      delta = ["arrowright", "arrowdown"].includes(key) ? 1 : ids.length - 1;
    selectSceneChoice(ids[(index + delta + ids.length) % ids.length]);
  }
}
function setChapterOverview(value) {
  chapterSceneState.overview = !!value;
  if (modal.open) close();
  renderSupplyHUD();
  renderMission();
  updateControlHints();
  activeCanvas?.focus({ preventScroll: true });
}
function sceneFieldNotes() {
  const phase =
    state.event.phase === "paused"
      ? state.event.pausedPhase
      : state.event.phase;
  if (["finale", "awards", "closed"].includes(phase)) {
    panel = "field-notes";
    open(
      "The neighborhood · Field notes",
      `<p>${esc(state.event.finale?.ending || "Every neighbor can contribute one final repair.")}</p>${contributionsHTML()}<div id="scene-notes" class="stack"></div>`,
    );
    $("#scene-notes").append(
      btn("Map and chapter history", map),
      btn("Meet the neighbors", () => neighbors()),
      btn("Rules & scoring", rules),
    );
    return;
  }
  panel = "field-notes";
  const c = state.event.chapter,
    p = state.me.progress[c];
  open(
    `${CHAPTER_SCENE_TITLES[c] || "The neighborhood"} · Field notes`,
    `<p>Chapter score: <strong>${p.score}</strong> · Main progress ${p.step}/${state.chapter.taskCount}</p><div id="scene-notes" class="stack"></div><hr>${contributionsHTML()}`,
  );
  $("#scene-notes").append(
    btn("Learning encounters", learning, "primary"),
    btn(
      p.challenge ? "✓ Challenge complete" : "Try the harder challenge",
      () => {
        close();
        travel(1, "challenge");
      },
    ),
    btn(p.secret ? "✓ Clue discovered" : "Look for a secret", () => {
      close();
      travel(1, "secret");
    }),
    btn("The neighborhood mystery", mystery),
    btn("Inventory & reserves", () => inventory()),
    btn("Rules & scoring", rules),
  );
}
function sceneCompanionSignature(view) {
  if (!view) return "";
  const m = chapterSceneModel(view, {
    focusedPeerId: chapterSceneState.focusedPeerId,
  });
  return JSON.stringify([
    m.nearbyCount,
    m.teammateCount,
    m.teammates.map((p) => [p.id, p.name]),
  ]);
}
function renderSceneCompanions() {
  const holder = $("#scene-companions");
  if (!holder || !sceneFocused()) return;
  const m = syncChapterSceneState(),
    focused = holder.contains(document.activeElement)
      ? document.activeElement?.dataset?.peerId
      : null;
  const label = document.createElement("p");
  label.textContent = `${m.nearbyCount} nearby · ${m.teammateCount + 1} connected`;
  holder.replaceChildren(label);
  m.teammates.forEach((peer, i) => {
    const b = btn(
      peer.name || `Nearby companion ${i + 1}`,
      () => {
        chapterSceneState.focusedPeerId =
          chapterSceneState.focusedPeerId === peer.id ? null : peer.id;
        renderSceneCompanions();
        [...holder.querySelectorAll("button")]
          .find((b) => b.dataset.peerId === peer.id)
          ?.focus({ preventScroll: true });
      },
      "quiet",
    );
    b.dataset.peerId = peer.id;
    b.setAttribute(
      "aria-pressed",
      String(chapterSceneState.focusedPeerId === peer.id),
    );
    holder.append(b);
  });
  if (focused && !modal.open)
    (
      [...holder.querySelectorAll("button")].find(
        (b) => b.dataset.peerId === focused,
      ) || activeCanvas
    )?.focus({ preventScroll: true });
}
function sceneClick(x, y) {
  const m = syncChapterSceneState();
  if (!m) return;
  const hit = hitChapterHotspot(m, x, y);
  if (!hit) return;
  if (hit.action === "choice") selectSceneChoice(hit.choice);
  else if (hit.action === "node") selectSceneNode(hit.node);
  else if (hit.action === "objective") scenePrimary();
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
    `<p>Explore together at your own pace. Every action works with a keyboard or a mouse / trackpad.</p><table class="compact-table"><tr><th>Action</th><th>Keyboard</th><th>Pointer</th></tr><tr><td>Walk</td><td>${esc(
      movementKeys(),
    )} or arrow keys while the map is focused</td><td>Click a destination on the map</td></tr><tr><td>Visit an objective</td><td>Tab to its button, then Enter; ${esc(
      keyLabel("interact"),
    )} interacts nearby</td><td>Click the objective button</td></tr><tr><td>Choose an action</td><td>Tab and Enter, or a numbered choice</td><td>Click a choice, then Confirm</td></tr><tr><td>Close a menu</td><td>Escape</td><td>Click ×</td></tr></table><p class="notice">${
      ["draft", "lobby"].includes(state.event.phase)
        ? "Start with the five practice steps in the sidebar."
        : "Follow the current chapter in the sidebar."
    } Help (${esc(
      keyLabel("help"),
    )}) stays available throughout the game. Settings changes controls, text size, sound, and visuals.</p><div id="intro-start"></div>`,
  );
  $("#intro-start").append(btn("Let’s explore", close, "primary"));
}
function renderMission() {
  const mission = $("#mission");
  const focused = mission.contains(document.activeElement)
    ? document.activeElement
    : null;
  const focusedText = focused?.textContent;
  const focusedKey = focused?.dataset?.focusKey;
  const focusedIndex = focused
    ? [...mission.querySelectorAll("button")].indexOf(focused)
    : -1;
  const previousPhase = mission.dataset.phase;
  const e = state.event || {},
    me = state.me || {},
    ch = state.chapter,
    progress = me.progress?.[e.chapter],
    displayPhase =
      e.phase === "paused" &&
      ["countdown", "chapter", "brag", "finale"].includes(e.pausedPhase)
        ? e.pausedPhase
        : e.phase;
  $("#phase-label").textContent = (
    e.paused ? "Paused" : e.phase || "Lobby"
  ).replaceAll("_", " ");
  let html = "";
  if (e.broadcast)
    html += (isMoveDayFocused() || isFilterFocused() || sceneFocused())
      ? `<details class="move-day-broadcast"><summary>Message from the host</summary><p>${esc(
          e.broadcast,
        )}</p></details>`
      : `<div class="notice">${esc(e.broadcast)}</div>`;
  if (displayPhase === "lobby" || displayPhase === "draft") {
    html += `<span class="chapter-count">BEFORE THE ADVENTURE</span><h2>Welcome to<br>Bragging Square.</h2><p>The AI has put the neighborhood on “permanent optimization.” Meet your neighbors and get ready to put things right.</p>`;
    if (!isPresentation) {
      const done = ["move", "interact", "collect", "answer", "help"].filter(tutorialDone).length;
      html += `<div class="practice-progress"><strong>${done} / 5 practice steps</strong><span>${me.ready ? "Ready for the trail" : "Practice freely. No points or supplies are at risk."}</span></div><h3>Your first five steps</h3><div id="tutorial-actions"></div><hr><div id="ready-action"></div>`;
    } else
      html +=
        '<div class="notice">Open your private invitation on a laptop or desktop. Choose a character, practice, and mark yourself ready.</div>';
  } else if (displayPhase === "countdown") {
    html +=
      '<span class="chapter-count">HERE WE GO</span><h2>The trail<br>starts here.</h2><p>Your neighbors are setting out with you. The Moving Depot is our first stop.</p><div class="notice">Watch the shared clock. The first chapter opens for everyone together; these ten seconds are part of its five minutes.</div>';
  } else if (displayPhase === "finale") {
    html += `<span class="chapter-count">THE NEIGHBORHOOD FINALE</span><h2>Bring the<br>lights home.</h2><p>One last repair. One home at a time. Every neighbor gets a turn.</p><div class="progress-track"><div class="progress-fill" style="width:${Math.min(
      100,
      (100 * (e.finale?.contributors?.length || 0)) / (e.finale?.target || 1),
    )}%"></div></div>${
      e.finale?.ending
        ? `<div class="notice" role="status">${esc(e.finale.ending)}</div>`
        : `<p class="small">${
            e.finale?.contributors?.length || 0
          } ${(e.finale?.contributors?.length || 0) === 1 ? "neighbor has" : "neighbors have"} contributed toward ${
            e.finale?.target || 1
          } ${(e.finale?.target || 1) === 1 ? "repair" : "repairs"}.</p>`
    }<p class="small">Award results are locked. This moment belongs to everyone.</p><div id="finale-action"></div>`;
  } else if (["awards", "closed"].includes(displayPhase)) {
    html +=
      '<span class="chapter-count">HUMANS: STILL PRETTY GOOD</span><h2>The end of<br>the trail.</h2>' +
      (e.archive?.finaleRecorded === false
        ? `<div class="notice" role="status">Archived chapter awards. The finale outcome was not retained in this archive.</div>`
        : e.finale?.ending ? `<div class="notice" role="status">${esc(e.finale.ending)}</div>` : "") +
      "<p>For the fixers, the thinkers, and the people who stopped to help.</p>" +
      awardsHTML();
  } else if (sceneFocused()) {
    html += sceneSidebarHTML();
  } else if (isFilterFocused()) {
    html += filterSidebarHTML();
  } else if (isMoveDayFocused()) {
    html += moveDaySidebarHTML();
  } else {
    html += `<span class="chapter-count">CHAPTER ${
      Number(e.chapter) + 1
    } / 08 ${
      e.ranked?.[e.chapter] === false ? "· UNRANKED" : ""
    }</span><h2>${esc(
      ch?.title || districts[e.chapter]?.[0] || "The adventure",
    )}</h2><p>${esc(
      ch?.objective ||
        FIELD_NOTES[e.chapter] ||
        "Help your neighbors restore the district.",
    )}</p>`;
    if (displayPhase === "brag" || displayPhase === "brag_break") {
      html +=
        '<div class="phase-banner"><strong>Meet back at the square.</strong><p class="small" style="margin:8px 0 0">Supplies and scoring are frozen. Share the choice you made, then see where the trail goes next.</p></div>' +
        verifiedHighlightHTML() +
        standingsHTML() +
        awardsHTML() +
        nextChapterHTML();
    } else if (!isPresentation) {
      html += `<div class="stat-row"><span>Your chapter score</span><strong>${
        progress?.score || 0
      }</strong></div><div class="stat-row"><span>Objective progress</span><strong>${
        progress?.step || 0
      } / ${
        ch?.taskCount || ch?.task?.totalSteps || 3
      }</strong></div><div class="progress-track"><div class="progress-fill" style="width:${
        progress?.complete
          ? 100
          : Math.min(
              100,
              (100 * (progress?.step || 0)) /
                (ch?.taskCount || ch?.task?.totalSteps || 3),
            )
      }%"></div></div>${
        e.chapter === 0 ? deliveryTrailHTML(ch?.task, progress) : ""
      }<div id="chapter-actions"></div><div class="secondary-heading">FIELD NOTES & EXPLORATION</div><div id="secondary-actions" class="secondary-actions"></div>`;
    }
    html += "<hr><h3>Neighborhood restoration</h3>" + contributionsHTML();
  }
  $("#mission").innerHTML = html;
  mission.classList.toggle("move-day-mission", isMoveDayFocused() || isFilterFocused() || sceneFocused());
  mission.classList.toggle("filter-mission", isFilterFocused() || sceneFocused());
  mission.classList.toggle("chapter-scene-mission", sceneFocused());
  app
    .querySelector?.(".game")
    ?.classList.toggle("move-day-game", isMoveDayFocused() || isFilterFocused() || sceneFocused());
  if (sceneFocused() && $("#scene-actions")) renderChapterSceneSidebar();
  else if (isFilterFocused()) renderFilterSidebar();
  else if (isMoveDayFocused()) renderMoveDaySidebar();
  updateControlHints();
  mission.dataset.phase = `${e.phase}:${displayPhase}:${e.chapter}`;
  if (previousPhase !== mission.dataset.phase) mission.scrollTop = 0;
  $("#map-label").textContent = (e.archive?.finaleRecorded === false ? "ARCHIVED RESULTS" : null) || ({countdown:"COUNTDOWN PREPARATIONS",brag:"CHAPTER BREAK",finale:"BRING THE LIGHTS HOME",awards:"NEIGHBORHOOD AWARDS",closed:"THE TRAIL IS COMPLETE"}[displayPhase]) || (sceneFocused() ? (CHAPTER_SCENE_TITLES[e.chapter] || "THE NEIGHBORHOOD").toUpperCase() : isFilterFocused() ? "FILTER SHORTAGE · THE HOME VISIT" : isMoveDayFocused()
    ? "MOVE DAY · THE CROSSING"
    : e.finale?.contributors?.includes(me.id)
      ? "YOUR REPAIR · AMBER MARKER"
      : (
          ch?.task?.target?.name ||
          ch?.title ||
          "Bragging Square"
        ).toUpperCase());
  if ($("#tutorial-actions")) renderTutorial();
  if ($("#chapter-actions")) {
    const n = $("#chapter-actions");
    n.append(
      btn(
        progress?.complete
          ? "✓ Main objective complete"
          : ch?.task?.target
            ? stageLabel(ch.task) + " →"
            : "Go to main objective →",
        () => travel(0, "activity"),
        "primary task-primary",
      ),
    );
    if (progress?.complete)
      n.querySelectorAll("button").forEach((b) => (b.disabled = true));
    if (!progress?.complete && ch?.task?.target) {
      const destination = document.createElement("p");
      destination.className = "task-destination";
      destination.textContent = "Destination: " + ch.task.target.name;
      n.append(destination);
    }
    const secondary = $("#secondary-actions") || n;
    secondary.append(
      btn(
        "Learning encounters",
        learning,
        progress?.complete ? "primary" : "quiet",
      ),
      btn(
        progress?.challenge
          ? "✓ Challenge complete"
          : "Try the harder challenge",
        () => travel(1, "challenge"),
        "quiet",
      ),
      btn(
        progress?.secret ? "✓ Clue discovered" : "Look for a secret",
        () => travel(1, "secret"),
        "quiet",
      ),
      btn(
        me.mystery ? "✓ Mystery solved" : "The neighborhood mystery",
        mystery,
        "quiet",
      ),
    );
    if (ch?.rewardShop)
      secondary.append(
        btn("Rewards: " + ch.rewardShop.balance + " tokens", () =>
          travel(1, "rewards"),
        ),
      );
    if (e.paused) {
      [n, secondary].forEach((group) =>
        group.querySelectorAll("button").forEach((b) => (b.disabled = true)),
      );
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
        contributeFinale,
        "primary",
      ),
    );
  const finaleButton = $("#finale-action button");
  if (finaleButton) {
    const contributed = e.finale?.contributors?.includes(me.id);
    if (contributed) finaleButton.textContent = "✓ Your home is restored";
    finaleButton.disabled = !!e.paused || !!contributed || !!contributeFinale.pending;
  }
  if (focused && !modal.open) {
    const buttons = [...mission.querySelectorAll("button")];
    const replacement =
      previousPhase === mission.dataset.phase
        ? (sceneFocused() && focused.id === "scene-result" && $("#scene-result")) || (isFilterFocused() && focused.id === "filter-result" && $("#filter-result")) || (isMoveDayFocused() &&
            focused.id === "move-day-result" &&
            $("#move-day-result")) ||
          buttons.find(
            (b) =>
              focusedKey && b.dataset.focusKey === focusedKey && !b.disabled,
          ) ||
          (!isMoveDayFocused() && !isFilterFocused() && !sceneFocused() &&
            (buttons.find(
              (b) => b.textContent === focusedText && !b.disabled,
            ) ||
              buttons[focusedIndex]))
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
  return `<section class="notice"><span class="eyebrow">UP NEXT · CHAPTER ${
    next.index + 1
  }</span><h3>${esc(next.title)}</h3>${
    next.objective ? `<p class="small">${esc(next.objective)}</p>` : ""
  }<p class="small">Start at ${esc(next.locations[0].name)}. Then explore ${esc(
    next.locations[1].name,
  )} for a challenge and a hidden clue. The next chapter opens when this break ends.</p></section>`;
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
  let pending = false;
  for (const [i, project] of shop.options.entries()) {
    const used = shop.uses.includes(project.id);
    const b = btn(
      `${used ? "✓ " : ""}${project.label} · ${project.cost} tokens — ${
        project.outcome
      }`,
      async () => {
        if (pending) return;
        pending = true;
        b.disabled = true;
        const revision = modal.trailRevision;
        let accepted = null;
        const r = await act(
          "rewardRedeem",
          { choice: i, expectedChapter: chapterIndex },
          (record) => {
            accepted = record;
          },
        );
        pending = false;
        if (modal.trailRevision !== revision || !modal.open) return;
        b.disabled = false;
        if (r !== null) {
          if (presentAcceptedAction(accepted, "rewards")) return;
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
    `<p class="small">${
      restoration.completed
    } completed objectives · AI control ${
      100 - restoration.percent
    }%</p><div class="progress-track" aria-label="Neighborhood restored ${
      restoration.percent
    }%"><div class="progress-fill" style="width:${
      restoration.percent
    }%"></div></div><p class="small muted">Completed objectives restore the district’s homes. Mint foundations show shared progress; warm windows mark a fully restored district.</p>` +
    districts
      .map(
        (d, i) =>
          `<div class="stat-row"><span>${i + 1}. ${esc(d[1])}</span><strong>${
            typeof c[i] === "object" ? c[i]?.count || 0 : c[i] || 0
          }</strong></div>`,
      )
      .join("") +
    (state.rules?.rewards?.projects || [])
      .filter((p) => state.event.rewardProjects?.[p.id])
      .map(
        (p) =>
          `<p class="small">${esc(p.label)}: ${
            state.event.rewardProjects[p.id]
          } funded</p>`,
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
              `<li><span class="rank">${i + 1}</span><span>${esc(
                x.category || x.title || x.name,
              )}<br><strong>${esc(
                x.winnerName ||
                  x.winner?.name ||
                  x.playerName ||
                  x.name ||
                  state.players?.find((p) => p.id === x.playerId)?.name ||
                  x.playerId ||
                  x.winner ||
                  "Unawarded",
              )}</strong></span></li>`,
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
          let pending = false;
          ["Repair parts", "A robot compliment"].forEach((v, i) =>
            $("#practice-answers").append(
              btn(v, async () => {
                if (pending) return;
                if (i === 0) {
                  pending = true;
                  const revision = modal.trailRevision;
                  const r = await act("tutorial", {
                    step: "answer",
                    choice: 0,
                  });
                  pending = false;
                  if (modal.trailRevision !== revision || !modal.open) return;
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
          let pending = false;
          $("#practice-action").append(
            btn(
              s === "help"
                ? "Request help"
                : s === "collect"
                  ? "Collect practice parcel"
                  : "Say hello",
              async () => {
                if (pending) return;
                pending = true;
                const revision = modal.trailRevision;
                if (s === "help") {
                  const helped = await act("help", { preset: 0 });
                  if (
                    helped === null ||
                    modal.trailRevision !== revision ||
                    !modal.open
                  ) {
                    pending = false;
                    return;
                  }
                }
                const r = await act("tutorial", { step: s });
                pending = false;
                if (
                  r === null ||
                  modal.trailRevision !== revision ||
                  !modal.open
                )
                  return;
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
  if (sceneFocused() && kind !== "activity") setChapterOverview(true);
  if (isFilterFocused() && kind !== "activity") setFilterOverview(true);
  if (isMoveDayFocused() && kind !== "activity") setMoveDayOverview(true);
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
  travelToastText = isMoveDayFocused()
      ? `Heading to ${kind === "activity" && state.chapter.task?.stage === "deliver" ? "the roadside home" : l.name}.`
      : isFilterFocused() ? `Visiting ${l.name}.` : `Walking to ${l.name}. You can also use the keyboard.`;
  toast(travelToastText);
  activeCanvas.focus();
}
function showActivity(kind) {
  clearTravelToast();
  if (kind === "activity" && sceneFocused()) {renderMission();if(!modal.open)$("#scene-primary")?.focus({preventScroll:true});return;}
  if (kind === "activity" && isFilterFocused()) {
    renderMission();
    if (!modal.open) $("#filter-primary")?.focus({ preventScroll: true });
    return;
  }
  if (kind === "activity" && isMoveDayFocused()) {
    renderMission();
    if (!modal.open) $("#move-day-primary")?.focus({ preventScroll: true });
    return;
  }
  if (kind === "rewards") {
    rewardsShop();
    return;
  }
  const chapterIndex = state.event.chapter;
  if (kind === "secret") {
    panel = "secret";
    open(
      "Something the AI missed",
      `<p>${esc(
        state.chapter?.secretHint ||
          "A curious detail is tucked near this location.",
      )}</p><div id="secret-action"></div>`,
    );
    let pending = false;
    $("#secret-action").append(
      btn(
        "Inspect this spot",
        async () => {
          if (pending) return;
          pending = true;
          const revision = modal.trailRevision;
          const confirm = $("#secret-action").children[0];
          confirm.disabled = true;
          const r = await act("secret", { expectedChapter: chapterIndex });
          pending = false;
          if (modal.trailRevision !== revision || !modal.open) return;
          confirm.disabled = false;
          if (r !== null) {
            close();
            toast(
              typeof r === "string"
                ? r
                : r.clue || r.message || "A clue is saved in your journal.",
            );
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
    `${
      task.kind === "rewards"
        ? `<div class="notice">${
            c.rewardShop?.balance || 0
          } reward tokens available · ${
            c.rewardShop?.earned || 0
          } earned. Choose a neighborhood repair to finish your main objective. Tokens are nontradable; repairs add no award points.</div>`
        : ""
    }${
      task.kind === "budget"
        ? `<div class="notice">Fictional cycle ${
            (prog?.step || 0) + 1
          } of 3<br>Income ${task.income} + retained ${task.retained} = ${
            task.budget
          }<br>Payment due: ${
            task.due
          }. This budget cannot be traded.<br><span id="budget-clock"></span></div>`
        : ""
    }${
      chapterIndex === 0 && task.kind === "delivery"
        ? deliveryPanelHTML(deliveryModel(state))
        : ""
    }<span class="eyebrow">${
      chapterIndex === 0 && task.kind === "delivery"
        ? esc(stageLabel(task))
        : esc(task.kind || "NEIGHBORHOOD TASK") +
          " · " +
          (kind === "challenge"
            ? "OPTIONAL CHALLENGE"
            : "STEP " +
              ((prog?.step || 0) + 1) +
              " OF " +
              (c.taskCount || task.totalSteps || 3))
    }</span>${
      task.evidence
        ? `<section class="evidence-card" aria-label="Evidence from your inspection"><span class="eyebrow">YOUR INSPECTION</span><p>${esc(
            task.evidence,
          )}</p></section>`
        : ""
    }<h3 id="activity-prompt" tabindex="-1" style="margin-top:18px">${esc(
      chapterIndex === 0 && task.kind === "delivery"
        ? deliveryPrompt(task)
        : task.prompt,
    )}</h3>${
      chapterIndex === 0 && task.kind === "delivery"
        ? ""
        : '<p class="small muted">Choose an action, then confirm.</p>'
    }<div class="choice-list" id="task-choices"></div><div class="row" id="task-confirm"></div>`,
  );
  selection = null;
  const delivery =
    chapterIndex === 0 && kind === "activity" ? deliveryModel(state) : null;
  task.options.forEach((o, i) => {
    const label =
      delivery?.stage === "load"
        ? delivery.plans[i]?.label
        : delivery?.stage === "route"
          ? delivery.routes[i]?.label
          : null;
    const choice = btn(
      `${i + 1}. ${label || (typeof o === "string" ? o : o.label || o.text)}`,
      () => choose(i),
      "choice",
    );
    choice.trailLabel = choice.textContent;
    const fact = deliveryChoiceDetail(delivery, i);
    if (fact) {
      const detail = document.createElement("span");
      detail.className = "choice-detail";
      detail.textContent = fact;
      choice.append(detail);
    }
    $("#task-choices").append(choice);
  });
  let pending = false;
  const confirm = btn(
    "Confirm action",
    async () => {
      if (pending) return;
      if (selection === null) {
        toast("Choose an action first.");
        return;
      }
      pending = true;
      confirm.disabled = true;
      confirm.trailPending = true;
      confirm.textContent = "Recording…";
      const revision = modal.trailRevision;
      let accepted = null;
      const r = await act(
        kind === "challenge" ? "challenge" : "task",
        {
          choice: selection,
          expectedChapter: chapterIndex,
          expectedStep: task.step,
          expectedStage: task.stage || null,
        },
        (record) => {
          accepted = record;
        },
      );
      pending = false;
      confirm.trailPending = false;
      if (modal.trailRevision !== revision || !modal.open) return;
      confirm.disabled =
        !!state.event.paused ||
        (task.kind === "budget" &&
          Date.now() + serverOffset < state.chapter.task?.opensAt);
      confirm.textContent = "Confirm action";
      if (r === null) return;
      if (presentAcceptedAction(accepted, kind)) return;
      if (r.message) toast(r.message);
      if (
        state.me.progress?.[state.event.chapter]?.complete ||
        kind === "challenge"
      )
        close();
      else if (
        state.chapter.task?.target &&
        Math.hypot(
          state.me.position.x - state.chapter.task.target.x,
          state.me.position.y - state.chapter.task.target.y,
        ) >= 60
      ) {
        close();
        travel(0, "activity");
      } else showActivity(kind);
    },
    "primary",
  );
  confirm.disabled =
    !!state.event.paused ||
    (task.kind === "budget" && Date.now() + serverOffset < task.opensAt);
  $("#task-confirm").append(confirm);
  $("#activity-prompt")?.focus({ preventScroll: true });
}
function deliveryPanelHTML(model) {
  if (!model) return "";
  return `<section class="cargo-panel"><div class="cargo-heading"><span class="eyebrow">TRIP ${
    model.deliveryNumber
  } / ${model.totalDeliveries}</span><div class="cart-slots" aria-label="${
    model.slots
  } of ${model.maxSlots} cart slots packed">${Array.from(
    { length: model.maxSlots },
    (_, i) =>
      `<span class="${
        i < model.slots ? "filled" : ""
      }" aria-hidden="true"></span>`,
  ).join("")}<strong>${model.slots}/${
    model.maxSlots
  } slots</strong></div></div><div class="cargo-manifest"><span>${
    model.loaded
      ? Object.entries(model.loaded)
          .map(([kind, qty]) => `${qty} ${esc(kind)}`)
          .join(" + ")
      : "Cart empty"
  } · separate from ${
    model.storageLimit
  }-item storage</span><details><summary>Personal reserve</summary><span>${Object.entries(
    model.reserve,
  )
    .map(([kind, qty]) => `${qty} ${esc(kind)}`)
    .join(" · ")}</span></details></div></section>`;
}
function deliveryPrompt(task) {
  return (
    {
      load: "What will you take?",
      route: "Which crossing will you use?",
      travel: "Check the crossing.",
      deliver: "Unload at the highway.",
    }[task?.stage] ||
    task?.prompt ||
    "Choose an action."
  );
}
function deliveryChoiceDetail(model, index) {
  if (!model) return "";
  if (model.stage === "load") {
    const plan = model.plans[index];
    return plan
      ? `${Object.entries(plan.cargo)
          .map(([kind, qty]) => `${qty} ${kind}`)
          .join(" + ")} · ${plan.slots}/${model.maxSlots} slots · ${
          plan.safe.points
        } points via paved route${
          plan.available ? "" : " · Supplies unavailable"
        }`
      : "";
  }
  if (model.stage === "route") {
    const route = model.routes[index];
    return route
      ? `${route.value} useful value · ${route.points} delivery points · ${
          route.damageValue
            ? `loses ${route.damageValue} cargo value`
            : "cargo protected"
        }`
      : "";
  }
  return "";
}
function presentAcceptedAction(accepted, kind = "activity") {
  if (!accepted) return false;
  const receipt = actionReceipt(
    accepted.before,
    accepted.after,
    accepted.action,
    accepted.result,
  );
  if (!receipt || receipt.stage === "inspect") return false;
  if (!receiptMatchesState(accepted.after)) {
    close();
    toast(
      "Your action is recorded. The field panel shows your latest supplies and score.",
    );
    return true;
  }
  return showActionReceipt(receipt, {
    epoch: accepted.after.projectionEpoch,
    chapter: accepted.after.event.chapter,
    phase: accepted.after.event.phase,
    kind,
  });
}
function receiptMatchesState(after) {
  const chapter = after?.event?.chapter;
  return (
    after?.projectionEpoch === state?.projectionEpoch &&
    after?.me?.id === state?.me?.id &&
    JSON.stringify([after?.me?.progress?.[chapter], after?.me?.inventory]) ===
      JSON.stringify([state?.me?.progress?.[chapter], state?.me?.inventory])
  );
}
function receiptCurrent(context) {
  return (
    state?.projectionEpoch === context.epoch &&
    state?.event?.chapter === context.chapter &&
    state?.event?.phase === context.phase &&
    context.phase === "chapter"
  );
}
function showActionReceipt(receipt, context) {
  if (!receiptCurrent(context)) return false;
  panel = "receipt";
  const allTotals = ["load", "route", "travel", "inspect"].includes(
    receipt.stage,
  )
    ? []
    : receipt.deltas;
  const totals = allTotals.filter(
    (delta) => !/^(Stored|Reserve) /.test(delta.label),
  );
  const supplies = allTotals.filter((delta) =>
    /^(Stored|Reserve) /.test(delta.label),
  );
  const label = (text) =>
    text === "Score now" ? "Chapter score" : text.replace(/ now$/, "");
  open(
    "Field report",
    `<section class="action-receipt"><span class="eyebrow">${
      receipt.stage === "challenge"
        ? "OPTIONAL CHALLENGE"
        : receipt.stage === "redeem"
          ? "NEIGHBORHOOD PROJECT"
          : receipt.completed
            ? "YOUR OBJECTIVE IS COMPLETE"
            : "EXPEDITION UPDATE"
    }</span><h3>${esc(receipt.title)}</h3>${
      allTotals.length
        ? '<p class="small receipt-caption">After this action</p>'
        : ""
    }<div class="receipt-stats">${totals
      .map(
        (delta) =>
          `<div><strong>${esc(delta.value)}</strong><span>${esc(
            label(delta.label),
          )}</span></div>`,
      )
      .join("")}</div>${
      supplies.length
        ? `<div class="receipt-supplies">${supplies
            .map(
              (delta) =>
                `<span><strong>${esc(delta.value)}</strong> ${esc(
                  label(delta.label),
                )}</span>`,
            )
            .join("")}</div>`
        : ""
    }${receipt.details
      .map((detail) => `<p>${esc(detail)}</p>`)
      .join("")}<div id="receipt-next"></div></section>`,
  );
  const next = btn(
    context.kind === "rewards"
      ? "Back to rewards"
      : receipt.completed
        ? "Back to the neighborhood"
        : "Continue →",
    () => {
      if (!receiptCurrent(context)) {
        close();
        return;
      }
      close();
      if (context.kind === "rewards") rewardsShop();
      else if (context.kind === "challenge") {
        if (!state.me.progress?.[context.chapter]?.challenge)
          travel(1, "challenge");
      } else if (!state.me.progress?.[context.chapter]?.complete)
        travel(0, "activity");
    },
    "primary",
  );
  $("#receipt-next").append(next);
  next.focus({ preventScroll: true });
  return true;
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
  status.textContent = `Selected: ${
    $("#task-choices").children[i].trailLabel ||
    $("#task-choices").children[i].textContent
  }. Confirm when ready.`;
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
      btn(
        `${
          answer
            ? (answer.correct
                ? `✓ Correct · ${state.rules.quizPoints} points`
                : "Answered · 0 points") + " · "
            : ""
        }Encounter ${i + 1}: ${q.prompt}`,
        () => quiz(i),
      ),
    );
  });
}
function quiz(index, result = null) {
  const chapterIndex = state.event.chapter;
  const q = state.chapter.questions[index],
    a = state.me.progress?.[state.event.chapter]?.quiz?.[index];
  panel = "quiz";
  if (a?.correct || result?.correct) {
    const earned = a?.correct ? state.rules.quizPoints : 0;
    const answerChoice = a?.correct ? a.choice : result.choice;
    const next = state.chapter.questions.findIndex(
      (_, i) => i !== index && !state.me.progress?.[chapterIndex]?.quiz?.[i],
    );
    open(
      `Human intelligence · ${index + 1} of 2`,
      `<h3>${
        a?.correct ? "✓ Correct" : "✓ Correct practice answer"
      }</h3><p><strong>${earned} points earned.</strong>${
        a?.correct
          ? " This encounter is complete."
          : " Your first answer was incorrect; this practice retry adds no points."
      }</p><p>${esc(q.prompt)}</p><p class="notice">Your correct answer: ${esc(
        q.options[answerChoice],
      )}</p><p>${esc(
        a?.explanation || result.explanation,
      )}</p><p class="small">Learning points add to your chapter score; objective progress tracks the main task.</p><div id="quiz-next"></div>`,
    );
    const nextButton = btn(
      next >= 0 ? "Next encounter" : "Back to encounters",
      () => (next >= 0 ? quiz(next) : learning()),
      "primary",
    );
    $("#quiz-next").append(nextButton);
    nextButton.focus({ preventScroll: true });
    return;
  }
  open(
    `Human intelligence · ${index + 1} of 2`,
    `<h3>${esc(q.prompt)}</h3>${
      a
        ? `<div class="notice">First answer: ${
            a.correct ? "correct" : "incorrect"
          }. ${a.correct ? state.rules.quizPoints : 0} points earned. ${esc(
            a.explanation,
          )}</div><p class="small">Retries do not change these points. Learning points add to your chapter score; objective progress tracks the main task.</p>`
        : '<p class="small muted">Your first confirmed answer counts. Take a moment.</p>'
    }<div class="choice-list" id="task-choices"></div><div id="quiz-confirm"></div>`,
  );
  selection = null;
  q.options.forEach((o, i) =>
    $("#task-choices").append(btn(`${i + 1}. ${o}`, () => choose(i), "choice")),
  );
  let pending = false;
  $("#quiz-confirm").append(
    btn(
      a ? "Try again, unscored" : "Confirm answer",
      async () => {
        if (pending) return;
        if (selection === null) {
          toast("Choose an answer first.");
          return;
        }
        const choice = selection;
        pending = true;
        const revision = modal.trailRevision;
        const confirm = $("#quiz-confirm").children[0];
        confirm.disabled = true;
        const r = await act("quiz", {
          index,
          choice,
          expectedChapter: chapterIndex,
        });
        pending = false;
        if (modal.trailRevision !== revision || !modal.open) return;
        confirm.disabled = false;
        if (r !== null) {
          quiz(index, { ...r, choice });
          if (!r.correct && r.explanation)
            toast(
              `${r.correct ? "Correct." : "Not quite."} ${
                r.first
                  ? `${
                      r.correct ? state.rules.quizPoints : 0
                    } points earned. First answer recorded.`
                  : "Unscored retry. Your first answer and its points are unchanged."
              } ${r.explanation}`,
            );
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
          `<div class="inventory-item"><strong>${esc(
            k,
          )}</strong><span>${v} units ${
            typeof values[k] === "number" ? `· ${values[k]} value each` : ""
          }</span></div>`,
      )
      .join("") +
    reserveHTML() +
    '<div class="row" id="inventory-tools" style="margin-top:20px"></div>';
  $("#inventory-tools").append(
    btn("Trade with a neighbor", () => neighbors(), "primary"),
    btn("View the rules", rules),
  );
}
function neighborListSignature(view) {
  return JSON.stringify({
    chapter: view?.event?.chapter,
    peers: (view?.players || [])
      .filter((p) => p.id !== view.me?.id)
      .map((p) => [p.id, p.name, p.help ?? null]),
  });
}
function neighbors(refresh = false) {
  const chapterIndex = state.event.chapter;
  panel = "neighbors";
  if (!refresh) open("Good neighbors, good odds");
  body.innerHTML =
    '<h3>Your open trades</h3><div id="trade-list"></div><p class="small">Help with an unfinished task, offer a fair trade, or send a little encouragement.</p><div class="row" id="emotes"></div><h3 style="margin-top:22px">Ask for help</h3><div class="row" id="help-requests"></div><h3 style="margin-top:22px">Your neighbors</h3><div id="neighbor-list"></div>';
  if (!refresh) body.scrollTop = 0;
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
      d.innerHTML = `<strong>${esc(p.name)}${
        p.help !== null && p.help !== undefined
          ? '<br><span class="badge">Asked for help</span>'
          : ""
      }</strong>`;
      const emote = document.createElement("span");
      emote.className = "neighbor-emote small";
      emote.dataset.emotePeer = p.id;
      d.append(emote);
      const r = document.createElement("div");
      r.className = "row";
      const assistButton = btn("Help", async () => {
        const revision = modal.trailRevision;
        const v = await act("assist", {
          target: p.id,
          expectedChapter: chapterIndex,
        });
        if (v !== null && modal.open && modal.trailRevision === revision)
          toast(
            "Assist registered. It counts when the unfinished task is completed.",
          );
      });
      assistButton.dataset.focusKey = `neighbor:${p.id}:assist`;
      const tradeButton = btn("Trade", () => trade(p));
      tradeButton.dataset.focusKey = `neighbor:${p.id}:trade`;
      r.append(assistButton, tradeButton);
      d.append(r);
      $("#neighbor-list").append(d);
    });
  (state.trades || []).forEach((t) => {
    const d = document.createElement("div");
    d.className = "card";
    d.style.padding = "14px";
    const name = (id) =>
      id === state.me?.id
        ? "You"
        : state.players?.find((p) => p.id === id)?.name || "Another neighbor";
    d.innerHTML = `<p class="small">${esc(name(t.from))} ${t.from === state.me?.id ? "give" : "gives"}: <strong>${t.give.qty} ${esc(t.give.item)}</strong><br>${esc(name(t.to))} ${t.to === state.me?.id ? "give" : "gives"}: <strong>${t.receive.qty} ${esc(t.receive.item)}</strong></p><p class="small">Confirmed: ${t.confirmed?.length || 0} of 2</p>`;
    const confirmButton = btn(
      "Confirm current offer",
      () =>
        act("tradeConfirm", { tradeId: t.id, expectedChapter: chapterIndex }),
      "primary",
    );
    confirmButton.dataset.focusKey = `trade:${t.id}:confirm`;
    const cancelButton = btn(
      "Cancel",
      () => act("tradeCancel", { tradeId: t.id }),
      "quiet",
    );
    cancelButton.dataset.focusKey = `trade:${t.id}:cancel`;
    d.append(confirmButton, cancelButton);
    $("#trade-list").append(d);
  });
  if (!state.trades?.length)
    $("#trade-list").innerHTML =
      '<p class="small muted">No open trades. Choose Trade beside a neighbor below to make an offer.</p>';
  refreshNeighborEmotes();
}
function refreshNeighborEmotes() {
  if (panel !== "neighbors" || !modal.open) return;
  const list = $("#neighbor-list");
  if (!list) return;
  const now = Date.now() + serverOffset;
  for (const label of list.querySelectorAll("span")) {
    if (!label.dataset.emotePeer) continue;
    const player = state.players?.find((p) => p.id === label.dataset.emotePeer);
    const emote = player?.emote;
    const text =
      emote && emote.until > now
        ? state.rules?.emotes?.[emote.index] || ""
        : "";
    if (label.textContent !== text) label.textContent = text;
  }
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
      )}</select></label><label>Quantity<input id="receive-qty" type="number" min="1" max="3" value="1" required></label></div><button id="trade-submit" class="primary">Propose this trade</button></form>`,
  );
  let pending = false;
  $("#trade-form").onsubmit = async (e) => {
    e.preventDefault();
    if (pending) return;
    pending = true;
    const revision = modal.trailRevision;
    const submit = $("#trade-submit");
    submit.disabled = true;
    const r = await act("tradeOffer", {
      target: p.id,
      expectedChapter: chapterIndex,
      give: { item: $("#give-item").value, qty: Number($("#give-qty").value) },
      receive: {
        item: $("#receive-item").value,
        qty: Number($("#receive-qty").value),
      },
    });
    pending = false;
    if (modal.trailRevision !== revision || !modal.open) return;
    submit.disabled = false;
    if (r !== null) neighbors();
  };
}
function map() {
  panel = "map";
  open(
    "One shared neighborhood",
    `<p class="small">Eight districts around Bragging Square. The active chapter’s locations are open to everyone at once.</p><p class="small muted">Unplayed means no objective, learning, clue, or assist progress is recorded; moving and socializing do not count as chapter progress. Complete means the main objective is finished.</p><div class="chapter-map" id="map-districts"></div>`,
  );
  if (sceneAvailable()) $("#map-districts").append(btn("Explore the neighborhood overview",()=>setChapterOverview(true)),btn("Return to the chapter scene",()=>setChapterOverview(false),"primary"));
  if (isFilterAvailable()) $("#map-districts").append(
    btn("Explore the neighborhood overview", () => setFilterOverview(true)),
    btn("Return to Filter shortage", () => setFilterOverview(false), "primary"),
  );
  if (isMoveDayAvailable())
    $("#map-districts").append(
      btn("Explore the neighborhood overview", () => setMoveDayOverview(true)),
      btn("Return to Move Day", () => setMoveDayOverview(false), "primary"),
    );
  districts.forEach((d, i) => {
    const status = chapterMapStatus(state.event, state.me?.progress?.[i], i);
    const b = btn(
      `${i + 1}. ${d[0]}${status.position === "current" ? " · ACTIVE" : ""}`,
      () => {
        const liveStatus = chapterMapStatus(
          state.event,
          state.me?.progress?.[i],
          i,
        );
        if (liveStatus.position !== "current") {
          toast(
            liveStatus.position === "past"
              ? `That chapter has ended. ${liveStatus.label}.`
              : "That district opens in its chapter.",
          );
          return;
        }
        close();
        travel(0, "activity");
      },
      status.position === "current" ? "primary" : "",
    );
    const places = document.createElement("span");
    places.className = "map-places";
    places.textContent = `${d[1]} · ${d[2]}`;
    const progress = document.createElement("span");
    progress.className = "map-places";
    progress.textContent = status.label;
    b.append(places, progress);
    $("#map-districts").append(b);
  });
}
function mystery() {
  const chapterIndex = state.event.chapter;
  panel = "mystery";
  open(
    "The neighborhood mystery",
    `<p>Eight districts. Eight overlooked clues. The AI missed a very human message.</p><p class="small">Your discovered clues:</p><div class="mystery">${districts
      .map((_, i) =>
        esc(state.me.clues?.find((c) => c.chapter === i)?.letter || "_"),
      )
      .join(
        " ",
      )}</div><form id="mystery-form"><label>Your answer<input id="mystery-answer" autocomplete="off" maxlength="64" required></label><p class="small">Type your answer or click your discovered letters. Both submit the same answer.</p><div id="mystery-letters" class="row" role="group" aria-label="Discovered clue letters"></div><div id="mystery-edit" class="row" style="margin:16px 0"></div><p id="mystery-entry-status" class="small" role="status" aria-live="polite"></p><button id="mystery-submit" class="primary">Reveal the message</button></form>`,
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
  let pending = false;
  $("#mystery-form").onsubmit = async (e) => {
    e.preventDefault();
    if (pending) return;
    pending = true;
    const revision = modal.trailRevision;
    const submit = $("#mystery-submit");
    submit.disabled = true;
    const r = await act("mystery", {
      answer: input.value,
      expectedChapter: chapterIndex,
    });
    pending = false;
    if (modal.trailRevision !== revision || !modal.open) return;
    submit.disabled = false;
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
    `<div class="notice">Help does not pause the shared clock.</div><table class="compact-table"><tr><th>Action</th><th>Keyboard</th><th>Mouse / trackpad</th></tr><tr><td>Move</td><td>${esc(
      movementKeys(),
    )} or arrows</td><td>Click a destination</td></tr><tr><td>Interact</td><td>${esc(
      keyLabel("interact"),
    )} or Enter</td><td>Objective button</td></tr><tr><td>Choose</td><td>1–4, Tab + Enter</td><td>Click then confirm</td></tr><tr><td>Inventory / map</td><td>${esc(
      keyLabel("inventory"),
    )} / ${esc(
      keyLabel("map"),
    )}</td><td>Bottom buttons</td></tr><tr><td>Close</td><td>Escape</td><td>× button</td></tr></table><p class="small" style="margin-top:18px">Focus the map to use movement keys. In menus, Tab moves between controls. Your character passes through other players. Nothing requires sound or rapid clicking.</p><div class="row" id="help-buttons"></div>`,
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
  let pending = false;
  $("#settings-save").append(
    btn(
      "Save settings",
      async () => {
        if (pending) return;
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
        pending = true;
        const revision = modal.trailRevision;
        const result = await act("setup", {
          character: state.me.character,
          palette: state.me.palette,
          insects,
          settings: serverSettings(settings),
        });
        pending = false;
        if (result !== null && commitVisualIntent(intent, insects)) {
          updateControlHints();
          if (modal.open && modal.trailRevision === revision) close();
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
    if (sceneFocused()) setChapterOverview(true);
    if (isFilterFocused()) setFilterOverview(true);
    if (isMoveDayFocused()) setMoveDayOverview(true);
    const next = clipMove(pos, {
      x: Math.max(30, Math.min(1170, pos.x + vector[0] * 35)),
      y: Math.max(30, Math.min(770, pos.y + vector[1] * 35)),
    });
    target = { ...next, path: [next] };
  } else if (k === "escape" && sceneAvailable() && chapterSceneState.overview) {
    e.preventDefault();setChapterOverview(false);
  } else if (k === "escape" && isFilterAvailable() && filterState.overview) {
    e.preventDefault();setFilterOverview(false);
  } else if (k === "escape" && isMoveDayAvailable() && moveDayOverview) {
    e.preventDefault();
    setMoveDayOverview(false);
  } else if (k === keys.interact || k === "enter") {
    e.preventDefault();
    if (sceneFocused()) { scenePrimary(); return; }
    if (isFilterFocused()) { filterPrimary(); return; }
    if (isMoveDayFocused()) {
      moveDayPrimary();
      return;
    }
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
  } else if (sceneFocused() && (/^[1-3]$/.test(k) || k === " ")) {
    sceneKeys(e);
  } else if (isFilterFocused() && /^[1-3]$/.test(k)) {
    e.preventDefault();selectFilterChoice(Number(k)-1);
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
  const displayPhase = state?.event?.phase === "paused" ? state.event.pausedPhase : state?.event?.phase;
  if (["countdown", "brag"].includes(displayPhase)) drawEventScene(activeCtx, state, {mode:displayPhase === "brag" ? "break" : "countdown"});
  else if (isPresentation && ["draft","lobby"].includes(displayPhase)) drawEventScene(activeCtx, state, {mode:"gathering"});
  else if (isPresentation && ((displayPhase === "chapter" && state.event.chapter >= 2) || ["finale","awards","closed"].includes(displayPhase))) drawChapterScene(activeCtx, state, {presentation:true,safe:true,now:Date.now()+serverOffset});
  else if (sceneFocused()) drawChapterScene(activeCtx, state, chapterSceneOptions());
  else if (isFilterFocused()) drawFilterScene(activeCtx, state, { selectedChoice:filterState.selection, completedHome:filterState.completedHome, focusedPeerId:filterState.focusedPeerId, pending:filterState.pending });
  else if (isMoveDayFocused())
    drawMoveDayScene(activeCtx, state, {
      focusedPeerId: moveDayState.focusedPeerId,
    });
  else drawMap(activeCtx, true);
  if (target && connected && !modal.open && !isPresentation) {
    const p = state.me.position;
    const frozen =
      state.event.paused ||
      !["draft", "lobby", "chapter", "finale"].includes(state.event.phase);
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
        : e.phase === "closed"
          ? "ENDED"
          : e.phase === "awards" ? "RESULTS" : "LOBBY";
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
  rect(ctx, x - 18, y + 23, 36, 6, "#263f3b");
  rect(ctx, x - 4, y + 9, 8, 18, type === 2 ? "#b6b59c" : "#796e53");
  if (type === 1) {
    // A narrow spruce with stepped boughs; the same bounded shadow as an oak.
    rect(ctx, x - 3, y - 15, 6, 7, "#87a278");
    rect(ctx, x - 7, y - 9, 14, 8, "#668468");
    rect(ctx, x - 11, y - 2, 22, 8, "#4e755b");
    rect(ctx, x - 15, y + 5, 30, 10, "#3d6556");
    rect(ctx, x - 11, y + 6, 9, 3, "#668468");
  } else if (type === 2) {
    // Light-barked fruit tree, with separate rounded clusters.
    rect(ctx, x - 12, y - 11, 24, 22, "#658267");
    rect(ctx, x - 17, y - 4, 34, 12, "#658267");
    rect(ctx, x - 8, y - 15, 16, 7, "#8da474");
    rect(ctx, x - 14, y - 5, 9, 6, "#8da474");
    for (const [dx, dy] of [[-9, 2], [7, -6], [6, 7]]) rect(ctx, x + dx, y + dy, 3, 3, "#d4ab65");
    rect(ctx, x - 3, y + 17, 5, 2, "#68776a");
  } else {
    rect(ctx, x - 14, y - 7, 28, 23, "#3d6556");
    rect(ctx, x - 10, y - 15, 20, 12, "#668468");
    rect(ctx, x - 17, y, 7, 13, "#668468");
    rect(ctx, x - 8, y - 12, 8, 6, "#94a774");
  }
}
function drawFrontWalks(ctx, scenery) {
  for (const r of [...scenery.walks, ...scenery.thresholds])
    rect(ctx, r.x, r.y, r.width, r.height, "#cbbf9d");
  // Small inset pavers keep the threshold legible above the foundation shadow.
  for (const r of scenery.thresholds) rect(ctx, r.x + 1, r.y, r.width - 2, 3, "#e3d7b8");
}
function yardProp(ctx, prop) {
  const { x, y, width: w, kind } = prop;
  const p = (dx, dy, width, height, ink) => rect(ctx, x + dx, y + dy, width, height, ink);
  const wood = "#9b8057", pale = "#d1bc87", dark = "#344f49";
  if (["herb-bed", "flower-bed", "planters", "produce"].includes(kind)) {
    p(0, 0, w, 14, wood); p(2, 2, w - 4, 10, "#685b42");
    for (let n = 4; n < w - 4; n += 8) {
      p(n, 3, 5, 3, "#90a36c"); p(n + 1, 8, 4, 3, "#6b8c5c");
      if (kind === "flower-bed" || kind === "produce") p(n + 1, 2, 3, 2, "#ddb477");
    }
  } else if (["parcels", "barrels", "rain-barrels", "cable-spools"].includes(kind)) {
    const barrel = kind.includes("barrel");
    for (const dx of [2, 16, 29]) {
      p(dx, 2, 11, 11, kind === "rain-barrels" ? "#7b9990" : wood);
      p(dx + 1, 3, 9, 2, pale); p(dx + 1, 10, 9, 2, barrel ? dark : pale);
      if (!barrel) p(dx + 4, 3, 2, 9, kind === "cable-spools" ? dark : pale);
    }
  } else if (kind === "handcart" || kind === "bicycle") {
    p(5, 9, 7, 5, dark); p(w - 12, 9, 7, 5, dark);
    p(8, 5, w - 17, 5, kind === "handcart" ? wood : "#a1b2a4");
    p(3, 1, 3, 9, pale); p(1, 1, 7, 2, pale);
    if (kind === "bicycle") { p(w - 11, 2, 3, 8, pale); p(w - 14, 1, 8, 3, dark); }
  } else if (kind === "laundry") {
    p(1, 0, 2, 14, wood); p(w - 3, 0, 2, 14, wood); p(3, 1, w - 6, 1, pale);
    for (let dx = 7; dx < w - 6; dx += 9) p(dx, 3, 6, 8, dx % 2 ? "#d4c8a6" : "#87a99b");
  } else if (kind === "noticeboard") {
    p(3, 0, w - 6, 10, wood); p(5, 2, w - 10, 6, pale);
    p(7, 10, 3, 4, dark); p(w - 10, 10, 3, 4, dark);
    for (let dx = 9; dx < w - 8; dx += 8) p(dx, 3, 4, 3, "#eee0b7");
  } else if (kind === "bench" || kind === "picnic-table") {
    p(3, 2, w - 6, 3, wood); p(1, 7, w - 2, 4, pale);
    p(6, 11, 3, 3, dark); p(w - 9, 11, 3, 3, dark);
    if (kind === "picnic-table") p(7, 0, w - 14, 5, wood);
  } else {
    p(2, 1, w - 4, 12, "#8e9e8d"); p(4, 3, w - 8, 8, dark);
    for (let dx = 6; dx < w - 5; dx += 5) p(dx, 4, 2, 6, kind === "solar-panel" ? "#799caa" : "#b4bda4");
  }
}
function building(ctx, x, y, w, h, color, index, lit, recovery = 0) {
  // Each landmark has its own eaves, roof pitch and siding. Keep the
  // thresholds on the walkable map even when the upper stories step back.
  const [inset, eaves, profile, siding, roofing] = [
    [0, 21, "monitor", "#977754", "#4d5756"],     // freight shed
    [8, 30, "shed", "#819292", "#4a666d"],       // highway works
    [0, 18, "sawtooth", "#82938b", "#47676a"],
    [8, 22, "vent", "#86918c", "#56626c"],
    [5, 22, "gable", "#bc9d79", "#695752"],
    [0, 15, "tower", "#c0aa86", "#4a6365"],
    [7, 23, "hip", "#b29d82", "#6a615b"],
    [3, 29, "gable", "#97947e", "#675b50"],
    [5, 1, "parapet", "#a57f6f", "#574d4d"],
    [3, 23, "shed", "#7b998d", "#415f58"],
    [0, 25, "false front", "#a2815d", "#69513f"], // frontier trading post
    [10, 29, "hip", "#b3a58a", "#425e66"],       // payment kiosk
    [1, 17, "marquee", "#939099", "#504b60"],
    [4, 31, "canopy", "#ac9064", "#805c4c"],
    [1, 13, "vent", "#83939a", "#47596b"],
    [10, 12, "tower", "#77868c", "#3d505c"],
  ][index];
  const wall = lit ? color : siding, roof = roofing;
  const edge = lit ? "#e0d1a9" : "#b9b19a";
  const light = lit ? "#ffd588" : "#405b5b";
  const left = x + inset, width = w - 2 * inset, top = y + eaves;
  rect(ctx, left + 5, top + 6, width, h - eaves, "#29433e");
  rect(ctx, left, top, width, h - eaves, wall);
  const strip = (offset, rise, height) =>
    rect(ctx, left - 3 + offset, top - rise, width + 6 - 2 * offset, height, roof);
  if (["gable", "hip", "canopy"].includes(profile)) {
    const tiers = profile === "gable" ? 7 : 5;
    for (let n = 0; n < tiers; n++) strip(n * 5, 4 + n * 4, 4);
  } else if (profile === "shed" || profile === "sawtooth") {
    for (let n = 0; n < width; n += 6) {
      const rise = 6 + 3 * (profile === "shed" ? Math.floor(n / 16) : Math.floor(n / 6) % 5);
      rect(ctx, left + n, top - rise, Math.min(6,width-n), rise, roof);
    }
  } else {
    strip(0, 7, 8);
    if (profile === "false front" || profile === "marquee") {
      strip(4, 24, 18); strip(12, 29, 6);
      rect(ctx, left + 8, top - 20, width - 16, 9, edge);
    } else if (profile === "tower" || profile === "monitor") {
      const span = profile === "tower" ? 20 : width - 32;
      rect(ctx, x + (w-span)/2, top - 20, span, 14, wall);
      rect(ctx, x + (w-span)/2 - 2, top - 23, span + 4, 4, roof);
    } else if (profile === "vent") {
      rect(ctx, left + 12, top - 21, 14, 15, roof);
      rect(ctx, left + 9, top - 22, 20, 4, edge);
    }
  }
  rect(ctx, left - 2, top, width + 4, 3, edge);
  rect(ctx, left, y + h - 4, width, 4, "#40554b");
  if (recovery > 0) rect(ctx, left, y + h - 4, Math.round(width * recovery), 3, "#b9d9b0");
  function detail(px, py, pw, ph, ink) {
    const dx = left + Math.round((px - x) * width / w);
    const dy = top + Math.round((py - y) * (h - eaves) / h);
    const dw = Math.max(1, Math.round(pw * width / w));
    const dh = Math.max(1, Math.round(ph * (h - eaves) / h));
    // Paint the doorway last so shutters and service counters never hide it.
    rect(ctx, dx, dy, dw, dh, ink);
  }
  for (const wx of [10, 63]) {
    detail( x + wx, y + 20, 17, 19, "#263f48");
    detail( x + wx + 2, y + 22, 13, 15, light);
    detail( x + wx + 8, y + 22, 2, 15, "#263f48");
  }
  const kind = Math.floor(index / 2);
  if (kind === 0) {
    // Freight depot: loading bay, stacked parcels and a highway maintenance stripe.
    detail( x + 31, y + 18, 28, 19, "#35505a");
    for (let n = 0; n < 4; n++)
      detail( x + 33, y + 20 + n * 4, 24, 1, "#9ca58d");
    for (const [cx, cy] of [
      [9, 44],
      [23, 48],
      [65, 45],
    ]) {
      detail( x + cx, y + cy, 13, 12, "#b89460");
      detail( x + cx + 5, y + cy, 3, 12, "#ddc387");
    }
    if (index % 2)
      for (let n = 0; n < 5; n++)
        detail( x + 8 + n * 16, y + 12, 10, 4, "#e9a667");
  } else if (kind === 1) {
    // Ductwork and filter grilles.
    detail( x + 32, y + 15, 26, 21, "#243f46");
    for (let n = 0; n < 5; n++) detail( x + 35 + n * 4, y + 18, 2, 15, edge);
    detail( x + 7, y + 44, 20, 5, "#abb8a8");
    detail( x + 21, y + 44, 6, 16, "#abb8a8");
  } else if (kind === 2) {
    // Civic archive: shallow pillars and a lit verification terminal.
    for (const px of [3, 29, 58, 84]) detail( x + px, y + 15, 3, 44, edge);
    detail( x + 37, y + 14, 16, 20, "#203b43");
    detail( x + 40, y + 18, 10, 9, lit ? "#b9d9b0" : "#e9a667");
  } else if (kind === 3) {
    // Weather damage is visible until the shared district repair advances.
    detail( x + 35, y + 14, 20, 21, "#ddd3b2");
    for (let n = 0; n < 3; n++)
      detail( x + 39, y + 19 + n * 5, 12, 2, "#617978");
    if (!lit)
      for (const [cx, cy] of [
        [12, 21],
        [17, 26],
        [22, 31],
        [67, 47],
        [72, 52],
      ])
        detail( x + cx, y + cy, 9, 3, "#304b4b");
  } else if (kind === 4) {
    // Apartment balconies / service HQ. No insect imagery in the scenery.
    detail( x + 5, y + 39, 26, 4, roof);
    detail( x + 59, y + 39, 26, 4, roof);
    detail( x + 35, y + 17, 20, 17, "#263f48");
    detail( x + 39, y + 21, 4, 4, "#e9a667");
    detail( x + 47, y + 21, 4, 4, "#b9d9b0");
  } else if (kind === 5) {
    // Trading desk and the payment cycle terminal.
    detail( x + 7, y + 12, 76, 8, "#a59777");
    for (let n = 0; n < 5; n++)
      detail( x + 9 + n * 15, y + 12, 8, 8, "#d9c28c");
    detail( x + 34, y + 23, 22, 12, "#203b43");
    detail( x + 38, y + 27, 14, 3, lit ? "#b9d9b0" : "#e9a667");
  } else if (kind === 6) {
    // Market stalls and an arcade marquee, contained inside the facade.
    for (let n = 0; n < 6; n++)
      detail( x + 6 + n * 13, y + 11, 12, 9, n % 2 ? "#c5a469" : "#688d81");
    detail( x + 34, y + 24, 22, 11, "#263f48");
    detail( x + 42, y + 26, 6, 7, "#e9c477");
  } else {
    // Network exchange / AI headquarters: visible server racks and cable trunk.
    for (const rx of [8, 62]) {
      detail( x + rx, y + 16, 20, 29, "#203b43");
      for (let n = 0; n < 4; n++) {
        detail( x + rx + 3, y + 19 + n * 6, 12, 2, "#778f8c");
        detail(
          x + rx + 16,
          y + 19 + n * 6,
          2,
          2,
          lit ? "#b9d9b0" : "#e9a667",
        );
      }
    }
    detail( x + 33, y + 14, 3, 23, "#c4b88f");
    detail( x + 33, y + 14, 25, 3, "#c4b88f");
  }
  if (!lit) {
    // An amber lock plate identifies occupied infrastructure, without animation.
    detail( x + 73, y + 51, 10, 9, "#203b43");
    detail( x + 76, y + 53, 4, 5, "#e9a667");
  }
  // Keep the center doorway separate from every facade detail.
  rect(ctx, x + 37, y + h - 25, 16, 25, "#1c373e");
  rect(ctx, x + 49, y + h - 14, 2, 2, "#e9c477");
}
function drawRoads(ctx) {
  const eastWest = ROAD_BANDS.filter(r => r.width > r.height);
  const northSouth = ROAD_BANDS.filter(r => r.height > r.width);
  const asphalt = "#454e50", curb = "#a7a394", paint = "#d9be78";
  for (const r of ROAD_BANDS) rect(ctx, r.x, r.y, r.width, r.height, curb);
  // Lay both carriageways after all curbs so intersections share one surface.
  for (const r of eastWest) rect(ctx, r.x, r.y + 3, r.width, r.height - 6, asphalt);
  for (const r of northSouth) rect(ctx, r.x + 3, r.y, r.width - 6, r.height, asphalt);
  for (const h of eastWest) {
    for (const v of northSouth) {
      rect(ctx, v.x, h.y, v.width, h.height, asphalt);
      // Short stop bars on the side street approaches leave the intersection open.
      rect(ctx, v.x + 5, h.y - 7, v.width / 2 - 8, 3, "#ded7bd");
      rect(ctx, v.x + v.width / 2 + 3, h.y + h.height + 4, v.width / 2 - 8, 3, "#ded7bd");
    }
    for (let x = 6; x + 13 <= h.width; x += 37)
      if (!northSouth.some(v => x + 13 > v.x - 8 && x < v.x + v.width + 8))
        rect(ctx, x, h.y + h.height / 2 - 1, 13, 2, paint);
  }
  for (const v of northSouth)
    for (let y = 6; y + 13 <= v.height; y += 37)
      if (!eastWest.some(h => y + 13 > h.y - 12 && y < h.y + h.height + 12))
        rect(ctx, v.x + v.width / 2 - 1, y, 2, 13, paint);
}
function drawMap(ctx, live) {
  ctx.clearRect(0, 0, 1200, 800);
  rect(ctx, 0, 0, 1200, 800, "#304b4b");
  const restoration = restorationProgress(state?.event);
  // District grounds are painted first. Roads remain continuous clear corridors.
  cells.forEach(([col, row], i) => {
    const recovered = restoration.districts[i],
      active = live && state?.event?.chapter === i;
    rect(
      ctx,
      [0, 415, 830][col],
      [0, 258, 510][row],
      [375, 375, 370][col],
      [230, 212, 290][row],
      recovered >= 1
        ? "#657c61"
        : recovered > 0
          ? "#435c55"
          : active
            ? "#556f55"
            : "#4b644e",
    );
  });
  // Sparse tufts use the same world grid across lot boundaries.
  for (let y = 12; y < 800; y += 34)
    for (let x = 8; x < 1200; x += 41) {
      const offset = (x * 7 + y * 3) % 27;
      if (offset % 3 === 0) {
        rect(ctx, x + offset, y, 4, 2, "#617959");
        rect(ctx, x + offset + 3, y - 2, 2, 3, "#617959");
      }
    }
  drawRoads(ctx);
  cells.forEach(([col, row], i) => {
    const x = col * 415 + 34,
      y = row * 260 + 35,
      active = live && state?.event?.chapter === i;
    const districtRestored = restoration.districts[i];
    const lit = districtRestored >= 1;
    const a = DOORS[i * 2],
      b = DOORS[i * 2 + 1];
    building(
      ctx,
      a[0] - 45,
      a[1] - 85,
      90,
      65,
      ["#dfc799", "#b6c7a6", "#c4b8a8", "#d5b495"][i % 4],
      i * 2,
      lit,
      districtRestored,
    );
    building(
      ctx,
      b[0] - 45,
      b[1] - 85,
      90,
      65,
      ["#c9d2b2", "#e0c29d", "#b6c7bd", "#ccc1a6"][i % 4],
      i * 2 + 1,
      lit,
      districtRestored,
    );
    const scenery = districtScenery(a, b, i);
    drawFrontWalks(ctx, scenery);
    scenery.props.forEach(prop => yardProp(ctx, prop));
    if (i === 0) {
      // The two inspectable crossings are landmarks, not additional collisions.
      rect(ctx, 224, 60, 12, 104, "#8c9987");
      rect(ctx, 224, 164, 12, 66, "#8c9987");
      rect(ctx, 166, 156, 128, 8, "#8c9987");
      rect(ctx, 220, 52, 20, 16, "#b7b49a");
      for (let n = 0; n < 3; n++) rect(ctx, 222, 54 + n * 5, 16, 2, "#526c67");
      rect(ctx, 219, 55, 2, 12, "#d4b777");
      rect(ctx, 239, 55, 2, 12, "#d4b777");
      for (const [rx, ry] of [
        [220, 155],
        [230, 160],
        [235, 154],
      ]) {
        rect(ctx, rx, ry, 8, 5, "#4c5c58");
        rect(ctx, rx + 1, ry, 5, 2, "#9a9a7e");
      }
    }
    scenery.trees.forEach(([tx, ty, kind]) => tree(ctx, tx, ty, kind));
    [a, b].forEach((door, site) => {
      const label = SITE_LABELS[i][site];
      const width = label.length * 9 + 12;
      rect(ctx, door[0] - width / 2, door[1] + 24, width, 21, "#203a40");
      ctx.font = "bold 15px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = site === 0 ? "#f3e6bc" : "#c6ddc1";
      ctx.fillText(label, door[0], door[1] + 40);
    });
  });
  // The central square remains open, with no collisions between players.
  rect(ctx, 433, 314, 330, 150, "#ddd1a8");
  for (let x = 440; x < 760; x += 20)
    for (let y = 320; y < 460; y += 20) rect(ctx, x, y, 18, 18, "#d0c29a");
  rect(ctx, 563, 355, 70, 66, "#6d9790");
  rect(ctx, 570, 362, 56, 52, "#a6c9b6");
  rect(ctx, 579, 372, 38, 32, "#78aba1");
  rect(ctx, 592, 360, 12, 37, "#d7e4c9");
  rect(ctx, 584, 353, 28, 12, "#e9e6c9");
  rect(ctx, 587, 396, 24, 5, "#4a7c78");
  SQUARE_TREES.forEach(([x, y], i) => {
    // Set the plaza trees in contained beds, clear of benches, fountain and signs.
    rect(ctx, x - 21, y + 17, 42, 16, "#8b8060");
    rect(ctx, x - 18, y + 19, 36, 11, "#aeb68a");
    tree(ctx, x, y, i % 2);
  });
  rect(ctx, 485, 438, 38, 8, "#967148");
  rect(ctx, 490, 446, 5, 8, "#574f3e");
  rect(ctx, 513, 446, 5, 8, "#574f3e");
  rect(ctx, 677, 438, 38, 8, "#967148");
  ctx.textAlign = "center";
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "#35544c";
  ctx.fillText("BRAGGING SQUARE", 600, 462);
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
    rect(ctx, 575, 428, 53, 15, "#af8960");
    for (let n = 0; n < 5; n++) rect(ctx, 577 + n * 10, 422, 6, 6, palette[n]);
  }
  if (live) {
    drawRepairs(ctx);
    const loc = [
      state?.chapter?.task?.target || state?.chapter?.locations?.[0],
      state?.chapter?.locations?.[1],
    ].filter(Boolean);
    if (
      state?.event?.chapter === 0 &&
      state.me?.progress?.[0]?.delivery?.loaded &&
      state.me?.position
    ) {
      const p = state.me.position;
      rect(ctx, p.x - 25, p.y + 5, 21, 13, "#997d55");
      rect(ctx, p.x - 23, p.y + 2, 7, 10, "#cbb17a");
      rect(ctx, p.x - 14, p.y + 4, 8, 8, "#b9d2a3");
      rect(ctx, p.x - 23, p.y + 17, 5, 4, "#20343c");
      rect(ctx, p.x - 10, p.y + 17, 5, 4, "#20343c");
    }
    const crowd = overviewCrowd(state, { presentation: isPresentation });
    crowd.players.forEach((p) => {
      const pos = p.position;
      if (p.id === crowd.selfId) {
        ctx.strokeStyle = "#fff6ce";
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x - 12, pos.y + 6, 24, 9);
      }
      rect(ctx, pos.x - 9, pos.y + 6, 18, 5, "#698768");
      drawAvatar(ctx, pos.x, pos.y, p.character || 0, p.palette || 0, 1.5);
    });
    loc.forEach((l, i) => {
      rect(ctx, l.x - 13, l.y - 65, 26, 24, i ? "#b9e5a5" : "#ed825e");
      ctx.fillStyle = "#142b35";
      ctx.font = "bold 13px monospace";
      ctx.fillText(i ? "?" : "!", l.x, l.y - 48);
      rect(ctx, l.x - 3, l.y - 41, 6, 5, i ? "#b9e5a5" : "#ed825e");
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
    if (generation === hostGeneration) toast(e.message);
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
    `<main class="host-shell"><div class="host-welcome"><canvas id="host-scene" width="1200" height="800" aria-hidden="true"></canvas><div><div class="eyebrow safe">NEIGHBORHOOD FIELD STATION</div><h1>${esc(
      e.name || "Second Nature Trail",
    )}</h1><p>Keep the group together. Every control below changes the shared event.</p></div></div><div class="host-stats">${[
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
      )}</div><div class="host-grid"><section class="card"><span class="eyebrow">EVENT STATE</span><h2 id="host-phase" style="margin-top:14px">${esc(
      e.phase || "draft",
    )} ${
      e.paused ? "· paused" : ""
    }</h2><p id="host-context" class="small">Chapter ${
      Number(e.chapter ?? -1) + 1
    } of 8. Control owner: ${esc(
      e.controlOwner || raw.controlOwner || "See operator log",
    )}.</p><div class="host-actions" id="host-actions"></div><hr><form id="broadcast-form"><label>Message to all players<input id="broadcast" maxlength="200" required></label><button>Broadcast message</button></form></section><section class="card"><h2>Operator log</h2><div class="log" id="host-log">${
      (raw.audit || raw.log || e.audit || [])
        .slice(-20)
        .reverse()
        .map(
          (a) =>
            `<div>${esc(
              new Date(a.at || a.time || Date.now()).toLocaleTimeString(),
            )} · ${esc(
              a.operatorId || a.operator || a.actor || "operator",
            )} · ${esc(a.type || a.action)} · ${esc(a.reason || "")}</div>`,
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
            `<p>${esc(e.name || "Second Nature Trail")} · ${
              ps.length
            } players · current phase ${esc(e.phase)}</p>${
              type === "shorten"
                ? `<label>Seconds remaining after this change<input id="host-seconds" type="number" min="1" step="1" max="${Math.max(
                    1,
                    Math.ceil((e.remainingMs || 0) / 1000),
                  )}" value="30" required></label>`
                : ""
            }${
              type === "advance"
                ? `<p class="notice">Ends this phase now. During a chapter, current results stay ranked and the chapter award settles. Use Skip chapter only for an unranked recovery.</p>`
                : ""
            }<label>Reason<input id="host-reason" value="${esc(
              label,
            )}" required></label><div id="host-confirm"></div>`,
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
        `<p class="notice">${
          raw.rules?.contentApproved
            ? "Content marked approved in the frozen ruleset."
            : "Draft content: SN owner approval is still required before release."
        }</p><p class="small">Content fingerprint: <code style="overflow-wrap:anywhere">${esc(
          raw.contentHash || "Unavailable",
        )}</code></p>${rulesHTML(raw)}`,
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
    d.innerHTML = `<strong>${esc(
      p.name,
    )}</strong><span class="small host-player-status">${hostPlayerStatus(
      p,
    )}</span>`;
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
  return `${connection} · ${
    p.ready ? "Ready" : p.setup ? "Practicing" : "Setup incomplete"
  }`;
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
          `<li><span class="rank">${i + 1}</span><span>${esc(p.name)}${
            p.eligible === false
              ? '<br><span class="small muted">Already awarded</span>'
              : ""
          }</span><span class="score">${p.score}</span></li>`,
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
              `${
                context.world?.[index]?.title || `Chapter ${index + 1}`
              }: ${value}`,
          )
          .join("; ");
  const groups = [
    [
      "Supplies",
      [
        [
          "Storage",
          `${r.storageLimit} tradable items. Starting allocation: ${list(
            r.allocation,
          )}.`,
        ],
        ["Published item values", list(r.values)],
        [
          "Delivery cart",
          `${r.cargoSlots} slots per load. Slot weights: ${list(
            r.cargoWeights,
          )}.`,
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
          `${
            r.rewards.perJob
          } nontradable tokens per completed rewards job. After all ${
            r.spatialTaskCount
          } jobs, redeem at least one project to complete the objective; the redemption adds no score. Each project can be funded once per player: ${r.rewards.projects
            .map((p) => `${p.label}, ${p.cost} tokens`)
            .join(
              "; ",
            )}. Remaining tokens may fund another affordable project.`,
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
          `${context.chapter?.title || "Current chapter"}: ${
            context.chapter?.taskCount ?? "loading"
          } main-objective steps.`,
        ],
      ],
    ],
    [
      "Timing",
      [
        [
          "Chapter and break",
          `${r.chapterMs / 60000} minutes of play, then ${
            r.breakMs / 60000
          } minutes of bragging. The opening ${
            r.countdownMs / 1000
          }-second countdown is included in chapter one's play window.`,
        ],
        [
          "Target rounds",
          `One attempt per ${
            r.targetRoundMs / 1000
          }-second round, starting with a ${
            r.targetTelegraphMs / 1000
          }-second preparation signal. Optional automatic confirmation submits only the target you selected, with the same timing and limits.`,
        ],
        [
          "Payment cycles",
          `${r.budgetIncomes.length} cycles of ${
            r.budgetCycleMs / 1000
          } seconds, measured from the chapter opening. A cycle cannot be paid early. Its full payment must arrive before the deadline.`,
        ],
        [
          "Payment amounts",
          `Cycle income: ${r.budgetIncomes.join(
            " / ",
          )}. Amount due: ${r.budgetDues.join(
            " / ",
          )}. Retained budget carries forward; the optional decoration costs ${
            r.optionalExpense
          }. This budget cannot be traded.`,
        ],
        [
          "Finale",
          `${
            r.finaleMs / 60000
          } minutes. Award inputs are frozen before it begins; finale contributions cannot change prizes.`,
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
          `<h3 style="margin-top:20px">${esc(
            title,
          )}</h3><table class="compact-table">${rows
            .map(
              ([label, value]) =>
                `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`,
            )
            .join("")}</table>`,
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
      )}</table><h3 style="margin-top:20px">Published tie breakers</h3><p class="small">${esc(
      r.ties,
    )}</p><h3>When no one qualifies</h3><p class="small">${esc(
      r.fallback,
    )}</p><div class="notice">${esc(r.fiction)}</div>`
  );
}

function targeting(task) {
  panel = "targeting";
  open(
    "Outbreak response",
    `<div class="eyebrow">TARGET SELECTION MODE · ARROWS SELECT · SPACE ACTS</div><h3 style="margin-top:16px">${esc(
      task.prompt ||
        "Resolve the marked outbreak. Leave friendly neighbors alone.",
    )}</h3><p class="small">One deliberate action per round. No rapid clicking. Your choice of visuals does not change the targets.</p><div class="row spread"><span id="round-label" class="badge">Round ${
      Number(task.round) + 1
    }</span><span id="round-timer" class="small"></span></div><div id="targets" class="target-grid" style="margin:18px 0"></div><p id="site-progress" class="notice"></p><label class="row"><input id="auto-target" type="checkbox">Confirm my selected target automatically when the signal opens</label><div id="target-confirm"></div><p id="target-status" class="notice"></p>`,
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
    $("#site-progress").textContent = `${
      task.target?.name || "Current site"
    } · ${task.siteHits || 0} / ${
      task.hitsRequired || 1
    } outbreaks resolved here`;
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
  const revision = modal.trailRevision;
  let accepted = null;
  const r = await act(
    "task",
    {
      choice: selection,
      expectedChapter: shown.chapter,
      expectedStep: shown.step,
      expectedStage: shown.stage || null,
      expectedRound: shown.round,
    },
    (record) => {
      accepted = record;
    },
  );
  targetRequestPending = false;
  if (modal.trailRevision !== revision || !modal.open) return;
  if (r !== null) {
    if (presentAcceptedAction(accepted)) return;
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
    `<div class="notice">Required relays: ${
      (task.requiredNodes || []).map(esc).join(", ") || "None"
    }. Cable budget: ${
      task.budget ?? "unlimited"
    } units.</div><div class="eyebrow">ROUTE PLANNING · NO DRAGGING REQUIRED</div><h3 style="margin-top:16px">Connect ${esc(
      task.destination,
    )} to the exchange.</h3><p class="small">Build a path by selecting connected nodes. Broken links cannot carry the signal. Start at the exchange and finish at the home.</p><canvas id="routing-canvas" width="540" height="250" style="width:100%;border:2px solid var(--ink);background:#dce6cf" aria-label="Network diagram; the same connections are described by the node buttons below"></canvas><p class="small">Broken links: ${
      (task.blockedEdges || [])
        .map((e) => e.map(esc).join(" ↔ "))
        .join("; ") || "None"
    }. Dashed lines show these breaks.</p><div id="route-nodes" class="choice-list"></div><p id="route-path" class="notice"></p><div class="row" id="route-actions"></div>`,
  );
  drawRouting(task);
  let pending = false;
  const submit = btn(
    "Connect this route",
    async () => {
      if (pending) return;
      pending = true;
      submit.disabled = true;
      const revision = modal.trailRevision;
      let accepted = null;
      const r = await act(
        "task",
        {
          path: [...routePath],
          expectedChapter: chapterIndex,
          expectedStep: task.step,
          expectedStage: task.stage || null,
        },
        (record) => {
          accepted = record;
        },
      );
      pending = false;
      if (modal.trailRevision !== revision || !modal.open) return;
      submit.disabled = false;
      if (r === null) return;
      if (presentAcceptedAction(accepted)) return;
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
    },
    "primary",
  );
  $("#route-actions").append(
    submit,
    btn(
      "Reset path",
      () => {
        if (pending) return;
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
  $("#route-path").textContent = `${routePath.join(" → ")} · Cost ${
    summary.cost
  } / ${task.budget ?? "unlimited"}${
    summary.invalid ? " · Contains a missing or broken link" : ""
  }${
    summary.missing.length
      ? " · Still needs " + summary.missing.join(", ")
      : " · Required relays included"
  }`;
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
  refreshNeighborEmotes();
  chapterSceneTick();
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
      $("#round-timer").textContent = `Next round in ${Math.max(
        0,
        Math.ceil((task.nextRoundAt - Date.now() - serverOffset) / 1000),
      )}s`;
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
    audioContext.resume()?.catch(() => {});
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
  const hostArt = $("#host-scene");
  if (hostArt?.getContext) drawEventScene(hostArt.getContext("2d"), raw, { mode: "operator" });
  const context = $("#host-context");
  if (context)
    context.textContent = `Chapter ${
      Number(e.chapter ?? -1) + 1
    } of 8. Control owner: ${
      e.controlOwner || raw.controlOwner || "No operator action yet"
    }.`;
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
            `<div>${esc(new Date(a.at).toLocaleTimeString())} · ${esc(
              a.operatorId,
            )} · ${esc(a.type)} · ${esc(a.reason)}</div>`,
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
      door = DOORS[district * 2];
    const x = door[0] - 27 + (slot % 7) * 8,
      y = door[1] + 49 + Math.floor(slot / 7) * 9;
    rect(ctx, x, y, 6, 6, id === state.me?.id ? "#fff2ab" : "#b9e5a5");
    rect(ctx, x + 2, y + 1, 1, 4, "#43755b");
    rect(ctx, x + 1, y + 3, 4, 1, "#43755b");
    if (id === state.me?.id) {
      ctx.strokeStyle = "#142b35";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, 10, 10);
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
    if ($("#task-confirm button"))
      $("#task-confirm button").disabled =
        waiting ||
        !!state.event.paused ||
        !!$("#task-confirm button").trailPending;
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
    focusKey = active?.dataset?.focusKey,
    index = buttons.indexOf(active);
  update();
  if (index < 0) return;
  const next = [...body.querySelectorAll("button")];
  const replacement = focusKey
    ? next.find((b) => b.dataset.focusKey === focusKey)
    : next.find((b) => b.textContent === text) || next[index];
  (replacement || $("#close-modal"))?.focus({ preventScroll: true });
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
  const phase = state?.event?.phase === "paused" ? state.event.pausedPhase : state?.event?.phase;
  const nextDistrict = state?.world?.find((district)=>district.index===state.event.chapter+1)?.title || "The neighborhood finale";
  const endingHint = state?.event?.archive?.finaleRecorded === false ? "Archived chapter awards · Finale outcome not retained" : phase === "countdown" ? "Countdown preparations · Walking and chapter actions resume when the chapter opens" : phase === "brag" ? `Chapter break · Scores are frozen · Next: ${nextDistrict}` : phase === "awards" ? "Results are recorded · Map reviews your chapters · Neighbors stays available" : phase === "closed" ? "Trail complete · Review awards and chapter history" : phase === "finale" && sceneFocused() ? (state.event.paused ? "The finale is paused · Your saved repair is safe" : state.event.finale?.contributors?.includes(state.me?.id) ? "Your home is restored · Review shared progress and chapter history" : `Restore a home beside the scene · ${keyLabel("interact")} contributes · Map opens the neighborhood`) : null;
  if (hint)
    hint.textContent = endingHint || ((isMoveDayFocused() || isFilterFocused() || sceneFocused())
      ? `Choose beside the scene · ${keyLabel(
          "interact",
        )} continues · ${movementKeys()} / arrows switch to free walking`
      : `Click to walk · ${movementKeys()} / arrows to move · ${keyLabel(
          "interact",
        )} to interact`);
  if ($("#field-notes-menu"))
    $("#field-notes-menu").hidden = !isMoveDayAvailable() && !isFilterAvailable() && !sceneAvailable();
  if ($("#move-day-return")) {
    $("#move-day-return").hidden = sceneAvailable() ? sceneFocused() : isFilterAvailable() ? isFilterFocused() : !isMoveDayAvailable() || isMoveDayFocused();
    $("#move-day-return").textContent = sceneAvailable() ? "Return to chapter scene" : isFilterAvailable() ? "Return to Filter shortage" : "Return to Move Day";
  }
  activeCanvas?.setAttribute(
    "aria-label",
    endingHint ? `Neighborhood ${phase} illustration. ${endingHint}. Tab reaches the event report and menus.` : sceneFocused() ? `Chapter scene. Tab reaches all choices. ${keyLabel("interact")} continues. Movement keys switch to the neighborhood overview.` : isFilterFocused() ? `Filter shortage home visit. Tab reaches inspection and installation choices. Number keys select a choice. ${keyLabel("interact")} continues. Movement keys switch to the neighborhood overview.` : isMoveDayFocused()
      ? `Move Day delivery scene. Tab reaches cargo and route choices. ${keyLabel(
          "interact",
        )} continues the current stage. Movement keys switch to the neighborhood overview.`
      : `Shared neighborhood. Move with arrow keys or ${movementKeys()}, or click a destination. Press ${keyLabel(
          "interact",
        )} to interact. Tab reaches all menus.`,
  );
}
function verifiedHighlightHTML() {
  const chapter = state.event.chapter;
  if (state.event.ranked?.[chapter] === false)
    return '<div class="notice">This chapter was skipped and is unranked. No chapter prize is allocated.</div>';
  const award = state.event.awards?.find((a) => a.chapter === chapter);
  if (!award) return "";
  if (!award.playerId)
    return `<div class="notice">Chapter prize unawarded: ${esc(
      award.reason,
    )}.</div>`;
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
  return `<section class="notice" aria-label="Recorded chapter highlight"><strong>Chapter prize: ${esc(
    award.name,
  )}</strong><p class="small" style="margin:8px 0 0">Recorded result: ${
    award.metric
  } ${labels[chapter]}.${
    chapter === 5 ? ` Retained fictional budget: ${award.secondary}.` : ""
  }</p></section>`;
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
