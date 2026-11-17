import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import {
  moveDaySceneModel,
  hitMoveDayHotspot,
} from "../public/move-day-scene.mjs";
import { clipMove } from "../public/world.mjs";
import { Engine } from "../engine.mjs";
import { CHAPTERS } from "../content.mjs";
import { createProjection, reduceProjection } from "../public/projection.mjs";
import {
  deliveryModel,
  deliveryReceipt,
  actionReceipt,
} from "../public/trail-feedback.mjs";
import {
  fitWorld,
  DELIVERY_STAGES,
  stageLabel,
} from "../public/trail-visuals.mjs";

const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
function section(start, end) {
  const first = source.indexOf(start),
    last = source.indexOf(end, first);
  assert(first >= 0 && last > first, `Missing actual client section: ${start}`);
  return source.slice(first, last);
}

// The browser adapter is deliberately small: actions and projections below are
// real app functions, while native layout/painting remain a separate visual check.
function fixture(chapter = 0, configure = () => {}) {
  let now = 100000,
    version = 0,
    requestId = 0;
  const engine = new Engine({ now: () => now });
  engine.addPlayer("neighbor", "Neighbor");
  engine.dispatch("neighbor", {
    type: "setup",
    requestId: "setup",
    character: 0,
    palette: 0,
    insects: false,
  });
  engine.host("operator", {
    type: "lobby",
    reason: "Isolated UI fixture",
    requestId: "lobby",
  });
  engine.host("operator", {
    type: "start",
    reason: "Isolated UI fixture",
    requestId: "start",
  });
  now = engine.state.deadline;
  engine.tick();
  engine.state.chapter = chapter;
  configure(engine);
  const ids = new Map(),
    requests = [],
    travels = [];
  const document = { activeElement: null };
  let body;
  class Element {
    constructor(tag = "div") {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.style = {};
      this.dataset = {};
      this.attributes = {};
      this.disabled = false;
      this.classList = { toggle() {}, add() {}, remove() {} };
    }
    replaceChildren(...nodes) {
      this.children = [];
      this.append(...nodes);
    }
    append(...nodes) {
      this.children.push(...nodes);
      nodes.forEach((n) => {
        if (n && typeof n === "object") {
          n.parentElement = this;
          if (n.id) ids.set("#" + n.id, n);
        }
      });
    }
    prepend(node) {
      this.children.unshift(node);
      node.parentElement = this;
      if (node.id) ids.set("#" + node.id, node);
    }
    after(node) {
      if (node.id) ids.set("#" + node.id, node);
    }
    set innerHTML(html) {
      this.html = html;
      this.children = [];
      if (this === body)
        for (const key of [...ids.keys()])
          if (!persistent.has(key)) ids.delete(key);
      for (const match of html.matchAll(/id="([^"]+)"/g)) {
        const node = new Element();
        node.id = match[1];
        ids.set("#" + node.id, node);
        this.append(node);
      }
    }
    get innerHTML() {
      return this.html || "";
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [
        ...(selector === "button" && child.tagName === "BUTTON" ? [child] : []),
        ...(child.querySelectorAll?.(selector) || []),
      ]);
    }
    contains(node) {
      return (
        node === this || this.children.some((child) => child.contains?.(node))
      );
    }
    focus() {
      document.activeElement = this;
    }
  }
  document.createElement = (tag) => new Element(tag);
  body = new Element();
  const persistent = new Set([
    "#toast",
    "#modal-title",
    "#close-modal",
    "#supply-hud",
    "#mission",
    "#phase-label",
    "#map-label",
  ]);
  for (const id of persistent)
    ids.set(id, new Element(id === "#close-modal" ? "button" : "div"));
  const modal = {
    open: false,
    trailRevision: 0,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    addEventListener() {},
  };
  const canvas = new Element("canvas");
  const context = vm.createContext({
    document,
    body,
    modal,
    activeCanvas: canvas,
    $: (selector) =>
      selector.endsWith(" button")
        ? ids.get(selector.slice(0, -7))?.querySelectorAll("button")[0]
        : ids.get(selector) || null,
    projection: createProjection(),
    reduceProjection,
    moveDaySceneModel,
    hitMoveDayHotspot,
    clipMove,
    moveDayOverview: false,
    moveDayState: {
      epoch: null,
      key: "",
      selection: null,
      pending: false,
      token: 0,
      journal: [],
      focusedPeerId: null,
    },
    app: { querySelector: () => null },
    deliveryModel,
    deliveryReceipt,
    actionReceipt,
    fitWorld,
    DELIVERY_STAGES,
    stageLabel,
    structuredClone,
    state: null,
    target: null,
    panel: "",
    selection: null,
    connected: true,
    authorizationLost: false,
    streamGeneration: 1,
    currentPhase: "chapter",
    currentChapter: chapter,
    missionSignature: "",
    forceSafe: true,
    safe: true,
    isPresentation: false,
    serverOffset: 0,
    prefs: {},
    keys: {},
    defaultKeys: {},
    movementSequence: 0,
    settingsSequence: 0,
    crypto: { randomUUID: () => `request-${++requestId}` },
    startAudio() {},
    soundEffect() {},
    updateConnection() {},
    updateControlHints() {},
    normalizedSettings: (settings) => settings,
    setTimeout: () => 0,
    clearTimeout() {},
    api: (_path, action) =>
      new Promise((resolve, reject) =>
        requests.push({ action, resolve, reject }),
      ),
    travel: (...args) => travels.push(args),
    rewardsShop() {},
    targeting() {},
    routing() {},
    loseAuthorization() {},
    showSignInRequired() {},
  });
  vm.runInContext(section("const esc =", "async function api("), context);
  vm.runInContext(
    section("async function act(", "function applyPrefs()"),
    context,
  );
  vm.runInContext(section("function accept(", "function game("), context);
  vm.runInContext(
    section("function sizeWorldCanvas(", "function firstUseControls("),
    context,
  );
  vm.runInContext(
    section("function showActivity(", "function learning("),
    context,
  );
  vm.runInContext(
    section("function renderMission(", "function nextChapterHTML("),
    context,
  );
  vm.runInContext(
    section("function worldKeys(", 'modal.addEventListener("keydown"'),
    context,
  );
  const actualRender = context.renderMission;
  context.renderMission = () => {
    if (context.isMoveDayFocused()) actualRender();
  };
  const stamp = (state, epoch = "trail-ui") => ({
    ...state,
    projectionEpoch: epoch,
    projectionVersion: ++version,
  });
  const send = (mutate = () => {}, epoch = "trail-ui") => {
    const next = engine.view("neighbor");
    mutate(next);
    context.accept(stamp(next, epoch), "full", true);
  };
  engine.get("neighbor").position = {
    ...engine.view("neighbor").chapter.locations[0],
  };
  send();
  canvas.focus();
  return {
    engine,
    context,
    document,
    body,
    ids,
    modal,
    canvas,
    requests,
    travels,
    send,
    confirm: () => ids.get("#task-confirm")?.querySelectorAll("button")[0],
    choose(index) {
      ids.get("#task-choices").children[index].onclick();
    },
    resolve(index = requests.length - 1, modify = (value) => value) {
      const pending = requests[index];
      const current = engine.view("neighbor").chapter;
      const target = ["challenge", "rewardRedeem"].includes(pending.action.type)
        ? current.locations[1]
        : current.task.target || current.locations[0];
      engine.get("neighbor").position = { x: target.x, y: target.y };
      now += 3100;
      const result = engine.dispatch("neighbor", pending.action);
      pending.resolve(
        modify({ result, patch: stamp(engine.actionView("neighbor")) }),
      );
    },
  };
}

test("focused cargo choices and journal use accepted actions and prevent double confirmation", async () => {
  const f = fixture();
  f.context.selectMoveDayChoice(2);
  assert.equal(f.context.moveDayState.selection, 2);
  const button = f.ids.get("#move-day-primary");
  const pending = button.onclick();
  assert.equal(f.context.moveDayState.pending, true);
  await f.context.submitMoveDayChoice();
  assert.equal(f.requests.length, 1);
  f.resolve();
  await pending;
  assert.equal(f.context.state.me.progress[0].delivery.loaded.cable, 2);
  assert.equal(f.context.moveDayState.journal.length, 1);
  assert.equal(f.context.moveDayState.selection, null);
  assert.equal(f.modal.open, false);
  assert.match(f.ids.get("#mission").innerHTML, /Cart packed/);
  assert.equal(f.document.activeElement, f.ids.get("#move-day-result"));
});
test("peer movement and joins preserve inline selection and keyboard focus", () => {
  const f = fixture();
  f.context.selectMoveDayChoice(1);
  const focus = f.document.activeElement;
  f.send((view) =>
    view.players.push({
      id: "peer",
      name: "Peer",
      position: { x: 100, y: 200 },
    }),
  );
  assert.equal(f.context.moveDayState.selection, 1);
  assert.equal(f.document.activeElement, focus);
  f.send((view) =>
    view.players.push({
      id: "peer",
      name: "Peer",
      position: { x: 700, y: 200 },
    }),
  );
  assert.equal(f.document.activeElement, focus);
});
test("an accepted action cannot reopen focused view or steal a notes dialog focus", async () => {
  const f = fixture();
  f.context.selectMoveDayChoice(0);
  const pending = f.context.submitMoveDayChoice();
  f.context.setMoveDayOverview(true);
  f.context.panel = "help";
  f.context.open("Help", '<p id="help-copy">Help</p>');
  f.ids.get("#help-copy").focus();
  const focus = f.document.activeElement;
  f.resolve();
  await pending;
  assert.equal(f.context.moveDayOverview, true);
  assert.equal(f.context.panel, "help");
  assert.equal(f.document.activeElement, focus);
  assert.equal(f.modal.open, true);
});
test("paused play rejects inline submissions and epoch replacement rejects pending journal", async () => {
  const f = fixture();
  f.context.selectMoveDayChoice(0);
  f.send((view) => {
    view.event.phase = "paused";
    view.event.paused = true;
    view.event.pausedPhase = "chapter";
  });
  await f.context.submitMoveDayChoice();
  assert.equal(f.requests.length, 0);
  assert.equal(f.ids.get("#move-day-primary").disabled, true);
  f.send();
  f.context.selectMoveDayChoice(0);
  const pending = f.context.submitMoveDayChoice();
  f.send(() => {}, "new-process");
  f.resolve();
  await pending;
  assert.equal(f.context.moveDayState.journal.length, 0);
  assert.equal(f.context.moveDayState.pending, false);
});
test("scene route hotspots select a choice without treating picture coordinates as world movement", async () => {
  const f = fixture();
  f.context.selectMoveDayChoice(0);
  const p = f.context.submitMoveDayChoice();
  f.resolve();
  await p;
  f.context.moveDaySceneClick(640, 376);
  assert.equal(f.context.moveDayState.selection, 0);
  assert.equal(f.travels.length, 0);
  f.context.moveDaySceneClick(896, 676);
  assert.equal(f.context.moveDayState.selection, 1);
  assert.equal(f.requests.length, 1);
});
test("three focused deliveries keep accepted route, score and personal completion authoritative", async () => {
  const f = fixture();
  for (let trip = 0; trip < 3; trip++) {
    for (const [stage, choice] of [
      ["load", 2],
      ["route", 0],
      ["travel", 0],
      ["deliver", 0],
    ]) {
      const task = f.engine.view("neighbor").chapter.task;
      f.engine.get("neighbor").position = {
        x: task.target.x,
        y: task.target.y,
      };
      f.send();
      assert.equal(f.context.state.chapter.task.stage, stage);
      if (stage === "load" || stage === "route")
        f.context.selectMoveDayChoice(choice);
      const pending = f.context.submitMoveDayChoice();
      f.resolve();
      await pending;
      assert.equal(f.modal.open, false);
      assert.equal(f.context.moveDayOverview, false);
    }
    assert.equal(f.context.state.me.progress[0].step, trip + 1);
    assert.equal(moveDaySceneModel(f.context.state).homeRestored, true);
  }
  assert.equal(f.context.state.me.progress[0].score, 60);
  assert.equal(f.context.state.me.progress[0].complete, true);
  assert.match(f.ids.get("#mission").innerHTML, /DELIVERIES COMPLETE/);
  assert.equal(
    f.context.moveDayState.journal.length,
    3,
    "journal remains bounded",
  );
});
test("nearby roster changes update companion controls without resetting cargo choice", () => {
  const f = fixture();
  f.context.selectMoveDayChoice(2);
  const focused = f.document.activeElement;
  f.send((view) =>
    view.players.push({
      id: "peer",
      name: "Peer",
      position: { x: 160, y: 160 },
    }),
  );
  assert.equal(
    f.ids.get("#move-day-companions").querySelectorAll("button").length,
    1,
  );
  assert.equal(f.document.activeElement, focused);
  f.send((view) =>
    view.players.push({
      id: "peer",
      name: "Peer",
      position: { x: 1100, y: 700 },
    }),
  );
  assert.equal(
    f.ids.get("#move-day-companions").querySelectorAll("button").length,
    0,
  );
  assert.equal(f.context.moveDayState.selection, 2);
  assert.equal(f.document.activeElement, focused);
});
test("free movement switches to the real overview and Escape restores the focused scene", () => {
  const f = fixture();
  f.context.keys = { up: "w", left: "a", down: "s", right: "d", interact: "e" };
  const p = { ...f.context.state.me.position };
  f.context.worldKeys({ key: "ArrowRight", preventDefault() {} });
  assert.equal(f.context.moveDayOverview, true);
  assert.equal(f.context.target.x, p.x + 35);
  assert.equal(f.context.target.y, p.y);
  f.context.worldKeys({ key: "Escape", preventDefault() {} });
  assert.equal(f.context.moveDayOverview, false);
  assert.equal(f.document.activeElement, f.canvas);
});
test("a task response projected into a later phase cannot publish an active-stage journal", async () => {
  const f = fixture();
  f.context.selectMoveDayChoice(0);
  const pending = f.context.submitMoveDayChoice();
  f.resolve(undefined, (value) => {
    value.patch.event.phase = "brag";
    return value;
  });
  await pending;
  assert.equal(f.context.moveDayState.journal.length, 0);
  assert.equal(f.modal.open, false);
});
test("accepted inline confirmation restores intent when DOM replacement drops focus to the page", async () => {
  const f = fixture();
  f.context.selectMoveDayChoice(0);
  f.document.body = { tagName: "BODY" };
  const pending = f.context.submitMoveDayChoice();
  f.document.activeElement = f.document.body;
  f.resolve();
  await pending;
  assert.equal(f.document.activeElement, f.ids.get("#move-day-result"));
});
test("Safari-style pointer activation without button focus still announces its accepted journal", async () => {
  const f = fixture();
  f.context.selectMoveDayChoice(0);
  f.document.documentElement = { tagName: "HTML" };
  f.document.activeElement = f.document.documentElement;
  const pending = f.context.submitMoveDayChoice();
  f.resolve();
  await pending;
  assert.equal(f.document.activeElement, f.ids.get("#move-day-result"));
});
test("a shared district completion preserves the focused journal and accepted local selection", async () => {
  const f = fixture();
  f.context.selectMoveDayChoice(0);
  const pending = f.context.submitMoveDayChoice();
  f.resolve();
  await pending;
  f.send((view) => {
    view.event.contributions[0] = 1;
  });
  assert.equal(f.document.activeElement, f.ids.get("#move-day-result"));
  f.context.selectMoveDayChoice(1);
  f.send((view) => {
    view.event.contributions[0] = 2;
  });
  assert.equal(f.context.moveDayState.selection, 1);
  assert.equal(
    f.document.activeElement.dataset.focusKey,
    "move-day:route:choice:1",
  );
});
