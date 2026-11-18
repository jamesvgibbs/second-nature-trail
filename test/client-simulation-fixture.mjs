import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { Engine } from "../engine.mjs";
import { overviewCrowd } from "../public/crowd-view.mjs";
import {
  routeSummary,
  clientPreferences,
  serverPreferences,
  writeSafeOverride,
} from "../public/helpers.mjs";
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
export function fixture(chapter = 0, configure = () => {}) {
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
  const intervals = [];
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
      this.value = "";
      this.classList = { toggle() {}, add() {}, remove() {} };
    }
    replaceChildren(...nodes) {
      this.children = [];
      this.append(...nodes);
    }
    getContext() {
      return new Proxy(
        { measureText: (text) => ({ width: String(text).length * 8 }) },
        { get: (o, k) => o[k] || (() => {}) },
      );
    }
    closest(tag) {
      return this.tagName === tag.toUpperCase()
        ? this
        : this.parentElement?.closest(tag);
    }
    toggleAttribute(key, enabled) {
      this[key] = enabled;
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
        ...(child.tagName === selector.toUpperCase() ? [child] : []),
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
  document.createTextNode = (text) => ({ textContent: text });
  document.createElement = (tag) => new Element(tag);
  body = new Element();
  document.body = new Element();
  document.documentElement = {
    style: {
      setProperty(k, v) {
        this[k] = v;
      },
    },
  };
  const storage = new Map();
  const persistent = new Set([
    "#toast",
    "#modal-title",
    "#close-modal",
    "#supply-hud",
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
    addEventListener(name, action) {
      this[name] = action;
    },
  };
  const canvas = new Element("canvas");
  const context = vm.createContext({
    document,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    setInterval: (callback) => {
      intervals.push(callback);
    },
    overviewCrowd,
    routeSummary,
    serverSettings: serverPreferences,
    writeSafeOverride,
    localStorage: {
      setItem: (k, v) => storage.set(k, v),
      getItem: (k) => storage.get(k),
      removeItem: (k) => storage.delete(k),
    },
    visualIntentGeneration: 0,
    latestVisualIntentInsects: false,
    persistReplacement() {},
    routePath: [],
    autoTargetEnabled: false,
    autoTargetRound: null,
    presentedTarget: null,
    targetRequestPending: false,
    districts: CHAPTERS.map((c) => [c.title]),
    body,
    modal,
    activeCanvas: canvas,
    $: (selector) =>
      selector.endsWith(" button")
        ? ids.get(selector.slice(0, -7))?.querySelectorAll("button")[0]
        : ids.get(selector) || null,
    projection: createProjection(),
    reduceProjection,
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
    // This fixture covers the retained overview/modal controls; focused scene has its own adapter tests.
    moveDayOverview: true,
    isMoveDayFocused: () => false,
    serverOffset: 0,
    prefs: {},
    keys: {
      up: "w",
      left: "a",
      down: "s",
      right: "d",
      interact: "e",
      inventory: "i",
      map: "m",
      help: "h",
    },
    defaultKeys: {
      up: "w",
      left: "a",
      down: "s",
      right: "d",
      interact: "e",
      inventory: "i",
      map: "m",
      help: "h",
    },
    movementSequence: 0,
    settingsSequence: 0,
    crypto: { randomUUID: () => `request-${++requestId}` },
    startAudio() {},
    soundEffect() {},
    updateConnection() {},
    updateControlHints() {},
    normalizedSettings: clientPreferences,
    setTimeout: () => 0,
    clearTimeout() {},
    api: (_path, action) =>
      new Promise((resolve, reject) =>
        requests.push({ action, resolve, reject }),
      ),
    travel: (...args) => travels.push(args),
    movementKeys: () => "WASD",
    rules() {},
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
    section("function tutorialDone(", "function travel("),
    context,
  );
  vm.runInContext(section("function learning(", "function map("), context);
  vm.runInContext(section("function mystery(", "function help("), context);
  vm.runInContext(
    section("function rewardsShop(", "function contributionsHTML("),
    context,
  );
  vm.runInContext(
    section("function preservePanelFocus(", "function keyLabel("),
    context,
  );
  vm.runInContext(
    section("function targeting(", "let audioContext ="),
    context,
  );
  vm.runInContext(section("function rect(", "function drawAvatar("), context);
  const budgetStart = source.indexOf(
    "setInterval(",
    source.indexOf("function drawRepairs("),
  );
  vm.runInContext(
    source.slice(
      budgetStart,
      source.indexOf("async function presentation(", budgetStart),
    ),
    context,
  );
  vm.runInContext(
    section("function settingsFields(", "function accept("),
    context,
  );
  vm.runInContext(section("function applyPrefs(", "function topbar("), context);
  vm.runInContext(
    section("function settings()", "function worldKeys("),
    context,
  );
  vm.runInContext(
    section("function noteVisualIntent(", "async function persistReplacement("),
    context,
  );
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
  send();
  return {
    engine,
    persistent,
    context,
    document,
    body,
    ids,
    modal,
    canvas,
    requests,
    travels,
    send,
    interval() {
      intervals.forEach((f) => f());
    },
    time(value) {
      now = value;
      engine.tick();
      send();
    },
    now: () => now,
    peer(id, type, fields = {}) {
      const result = engine.dispatch(id, {
        type,
        requestId: `peer-${++requestId}`,
        expectedChapter: engine.state.chapter,
        ...fields,
      });
      send();
      return result;
    },
    confirm: () => ids.get("#task-confirm")?.querySelectorAll("button")[0],
    choose(index) {
      ids.get("#task-choices").children[index].onclick();
    },
    resolve(index = requests.length - 1, modify = (value) => value) {
      const pending = requests[index];
      const current = engine.view("neighbor").chapter;
      const target = ["challenge", "rewardRedeem", "secret"].includes(
        pending.action.type,
      )
        ? current.locations[1]
        : current.task.target || current.locations[0];
      engine.get("neighbor").position = { x: target.x, y: target.y };
      now += 3100;
      try {
        const result = engine.dispatch("neighbor", pending.action);
        pending.resolve(
          modify({ result, patch: stamp(engine.actionView("neighbor")) }),
        );
      } catch (error) {
        pending.reject(error);
      }
    },
  };
}
