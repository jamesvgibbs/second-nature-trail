import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
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
    append(...nodes) {
      this.children.push(...nodes);
      nodes.forEach((n) => {
        if (n && typeof n === "object") n.parentElement = this;
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

test("world fitting preserves world proportions within wide and compact viewports", () => {
  for (const [width, height] of [
    [1135, 674],
    [750, 530],
    [480, 700],
    [1200, 800],
  ]) {
    const fitted = fitWorld(width, height);
    assert(fitted.width <= width && fitted.height <= height);
    assert.equal(fitted.width / fitted.height, 1.5);
    assert(
      Math.abs(fitted.width - width) < 0.001 ||
        Math.abs(fitted.height - height) < 0.001,
    );
  }
});

test("actual delivery Confirm rejects repeated activation while pending and focuses its saved receipt", async () => {
  const f = fixture();
  f.context.showActivity("activity");
  f.choose(2);
  const confirm = f.confirm(),
    pending = confirm.onclick();
  assert.equal(confirm.disabled, true);
  await confirm.onclick();
  assert.equal(f.requests.length, 1);
  f.context.selection = 0; // A changed selection cannot rewrite the submitted load.
  f.resolve();
  await pending;
  assert.equal(f.engine.get("neighbor").progress[0].delivery.loaded.cable, 2);
  assert.equal(f.context.panel, "receipt");
  assert.match(f.body.innerHTML, /Cart packed/);
  assert.match(f.body.innerHTML, /Supplies are used when you deliver/);
  const next = f.ids.get("#receipt-next").children[0];
  assert.equal(f.document.activeElement, next);
  assert.equal(
    f.travels.length,
    0,
    "The player can read the receipt before moving again",
  );
  next.onclick();
  assert.equal(f.modal.open, false);
  assert.equal(f.travels.length, 1);
});

test("same-phase SSE preserves an action selection and an open receipt without stealing focus", async () => {
  const f = fixture();
  f.context.showActivity("activity");
  f.choose(1);
  const selected = f.document.activeElement,
    html = f.body.innerHTML;
  f.send((view) => {
    view.players.push({ id: "peer", name: "New neighbor" });
  });
  assert.equal(f.context.selection, 1);
  assert.equal(f.document.activeElement, selected);
  assert.equal(f.body.innerHTML, html);
  const pending = f.confirm().onclick();
  f.resolve();
  await pending;
  const next = f.document.activeElement,
    receipt = f.body.innerHTML;
  f.send((view) => {
    view.event.broadcast = "Keep going, neighbors";
  });
  assert.equal(f.body.innerHTML, receipt);
  assert.equal(f.document.activeElement, next);
  assert.equal(f.context.panel, "receipt");
});

test("closing or replacing a pending activity does not reopen a receipt or steal Help focus", async () => {
  for (const replacement of [false, true]) {
    const f = fixture();
    f.context.showActivity("activity");
    f.choose(0);
    const pending = f.confirm().onclick();
    f.context.close();
    if (replacement) {
      f.context.panel = "help";
      f.context.open(
        "Help",
        '<p id="help-copy">The event clock continues.</p>',
      );
      f.ids.get("#help-copy").focus();
    }
    const focused = f.document.activeElement;
    f.resolve();
    await pending;
    assert.equal(
      f.engine.get("neighbor").progress[0].delivery.stage,
      "route",
      "Accepted progress is still saved",
    );
    assert.equal(f.context.panel, replacement ? "help" : "");
    assert.equal(f.modal.open, replacement);
    assert.equal(f.document.activeElement, focused);
    assert.equal(f.ids.has("#receipt-next"), false);
  }
});

test("late accepted response cannot create a receipt after phase, chapter, epoch or stream changes", async () => {
  for (const changed of ["paused", "brag", "chapter", "epoch", "stream"]) {
    const f = fixture();
    f.context.showActivity("activity");
    f.choose(0);
    const pending = f.confirm().onclick();
    if (changed === "stream") f.context.streamGeneration++;
    else
      f.send(
        (view) => {
          if (changed === "chapter") view.event.chapter = 1;
          else if (changed !== "epoch") view.event.phase = changed;
        },
        changed === "epoch" ? "restarted" : "trail-ui",
      );
    f.resolve();
    await pending;
    assert.equal(f.context.panel === "receipt", false, changed);
    assert.equal(f.ids.has("#receipt-next"), false, changed);
    assert.equal(f.travels.length, 0, changed);
  }
});

test("receipt continuation is inert after authoritative context changes", async () => {
  for (const changed of ["paused", "brag", "chapter", "epoch"]) {
    const f = fixture();
    f.context.showActivity("activity");
    f.choose(0);
    const pending = f.confirm().onclick();
    f.resolve();
    await pending;
    const next = f.ids.get("#receipt-next").children[0];
    f.send(
      (view) => {
        if (changed === "chapter") view.event.chapter = 1;
        else if (changed !== "epoch") view.event.phase = changed;
      },
      changed === "epoch" ? "restarted" : "trail-ui",
    );
    assert.equal(
      f.modal.open,
      false,
      `An old receipt must disappear immediately after ${changed}`,
    );
    next.onclick();
    assert.equal(f.modal.open, false, changed);
    assert.equal(f.travels.length, 0, changed);
  }
});

test("a new projection epoch keeps unrelated Help open and its existing focus", () => {
  const f = fixture();
  f.context.panel = "help";
  f.context.open("Help", '<p id="help-copy">The event clock continues.</p>');
  f.ids.get("#help-copy").focus();
  const focused = f.document.activeElement,
    html = f.body.innerHTML;
  f.send(() => {}, "restarted");
  assert.equal(f.modal.open, true);
  assert.equal(f.context.panel, "help");
  assert.equal(f.document.activeElement, focused);
  assert.equal(f.body.innerHTML, html);
});

test("rejected action retains selection, restores Confirm and cannot produce a saved receipt", async () => {
  const f = fixture();
  f.context.showActivity("activity");
  f.choose(1);
  const confirm = f.confirm(),
    pending = confirm.onclick();
  f.requests[0].reject(new Error("Not enough supplies for this load"));
  await pending;
  assert.equal(confirm.disabled, false);
  assert.equal(confirm.textContent, "Confirm action");
  assert.equal(f.context.selection, 1);
  assert.equal(f.context.panel, "activity");
  assert.equal(f.ids.has("#receipt-next"), false);
  assert.match(
    f.ids.get("#dialog-feedback").textContent,
    /Not enough supplies/,
  );
  assert.equal(f.engine.get("neighbor").progress[0].delivery.stage, "load");
});

test("receipt outcome and details are escaped inside the stable Field report dialog", () => {
  const f = fixture(),
    payload = '<img src=x onerror="bad()">';
  f.context.showActionReceipt(
    {
      title: payload,
      completed: false,
      deltas: [{ label: payload, value: payload }],
      details: [payload],
    },
    { epoch: "trail-ui", chapter: 0, phase: "chapter" },
  );
  assert.equal(f.ids.get("#modal-title").textContent, "Field report");
  assert.equal(f.body.innerHTML.includes("<img"), false);
  assert(f.body.innerHTML.includes("&lt;img"));
});

test("newer personal SSE totals cannot be replaced by an older HTTP receipt, while peer-only updates retain it", async () => {
  for (const personalChange of [false, true]) {
    const f = fixture();
    f.context.showActivity("activity");
    f.choose(2);
    const pending = f.confirm().onclick();
    f.resolve(0, (response) => {
      const newer = structuredClone(response.patch);
      newer.projectionVersion++;
      if (personalChange)
        newer.me.progress[0].score += 5; // An independently accepted assist projection.
      else newer.event.broadcast = "A neighbor joined the journey";
      f.context.accept(newer, "patch");
      return response;
    });
    await pending;
    assert.equal(f.context.state.me.progress[0].score, personalChange ? 5 : 0);
    if (personalChange) {
      assert.equal(f.context.panel === "receipt", false);
      assert.equal(f.modal.open, false);
    } else {
      assert.equal(f.context.panel, "receipt");
      assert.match(f.body.innerHTML, /Cart packed/);
    }
  }
});

test("later personal updates preserve a historical receipt and focus while updating live supplies", async () => {
  const f = fixture();
  for (const [stage, choice] of [2, 0, 0, 0].entries()) {
    f.context.showActivity("activity");
    f.choose(choice);
    const pending = f.confirm().onclick();
    f.resolve();
    await pending;
    if (stage < 3) f.ids.get("#receipt-next").children[0].onclick();
  }
  assert.equal(f.context.panel, "receipt");
  const receipt = f.body.innerHTML,
    focused = f.document.activeElement;
  assert.match(receipt, /After this action/);
  assert.doesNotMatch(
    receipt,
    /Score now|Current chapter score|Stored cable now/,
  );
  f.send((view) => {
    view.me.progress[0].score += 5;
    view.me.inventory.cable++;
  });
  assert.equal(f.context.state.me.progress[0].score, 25);
  assert.equal(f.body.innerHTML, receipt);
  assert.equal(f.document.activeElement, focused);
  assert.match(f.ids.get("#supply-hud").innerHTML, />11<small>/);
});

test("actual three-trip UI loop consumes only on delivery and ends without an extra task", async () => {
  const f = fixture();
  for (let trip = 0; trip < 3; trip++) {
    for (const choice of [2, 0, 0, 0]) {
      f.context.showActivity("activity");
      f.choose(choice);
      const previousStage = f.context.state.chapter.task.stage;
      const beforeInventory = JSON.stringify(f.context.state.me.inventory);
      const pending = f.confirm().onclick();
      f.resolve();
      await pending;
      assert.equal(f.context.panel, "receipt");
      if (previousStage !== "deliver")
        assert.equal(
          JSON.stringify(f.context.state.me.inventory),
          beforeInventory,
        );
      const next = f.ids.get("#receipt-next").children[0];
      const travelCount = f.travels.length;
      next.onclick();
      if (trip === 2 && previousStage === "deliver") {
        assert.equal(next.textContent, "Back to the neighborhood");
        assert.equal(f.travels.length, travelCount);
      }
    }
  }
  const progress = f.engine.get("neighbor").progress[0];
  assert.equal(progress.complete, true);
  assert.equal(progress.score, 60);
  assert.equal(progress.step, 3);
  assert.equal(progress.reserve.cable, 3);
  assert.equal(f.engine.state.contributions[0], 1);
});

test("spatial encounter exposes inspected evidence and keeps wrong-decision retry at the same site", async () => {
  const f = fixture(1);
  f.context.showActivity("activity");
  f.choose(0);
  let pending = f.confirm().onclick();
  f.resolve();
  await pending;
  if (f.context.panel === "receipt") {
    f.ids.get("#receipt-next").children[0].onclick();
    f.context.showActivity("activity");
  }
  assert.equal(f.engine.get("neighbor").progress[1].inspected, true);
  assert.match(f.body.innerHTML, /YOUR INSPECTION/);
  const correct = CHAPTERS[1].tasks[0].answer;
  f.choose((correct + 1) % CHAPTERS[1].tasks[0].options.length);
  pending = f.confirm().onclick();
  f.resolve();
  await pending;
  assert.equal(f.context.panel, "receipt");
  assert.match(f.body.innerHTML, /This site still needs help/);
  assert.equal(f.engine.get("neighbor").progress[1].step, 0);
  f.ids.get("#receipt-next").children[0].onclick();
  assert.deepEqual(f.travels.at(-1), [0, "activity"]);
  f.context.showActivity("activity");
  f.choose(correct);
  pending = f.confirm().onclick();
  f.resolve();
  await pending;
  assert.equal(f.context.panel, "receipt");
  assert.match(f.body.innerHTML, /Work completed/);
  assert.equal(f.engine.get("neighbor").progress[1].step, 1);
  assert.equal(f.engine.get("neighbor").progress[1].score, 10);
});

test("optional challenge failure returns to its challenge, while success returns to the neighborhood", async () => {
  const f = fixture(1, (engine) => {
    const progress = engine.get("neighbor").progress[1];
    progress.complete = true;
    progress.step = 6;
    progress.score = 60;
  });
  const challenge = CHAPTERS[1].challenge;
  f.context.showActivity("challenge");
  f.choose((challenge.answer + 1) % challenge.options.length);
  let pending = f.confirm().onclick();
  f.resolve();
  await pending;
  assert.equal(f.context.panel, "receipt");
  assert.match(f.body.innerHTML, /Try another approach/);
  f.ids.get("#receipt-next").children[0].onclick();
  assert.deepEqual(f.travels.at(-1), [1, "challenge"]);
  f.context.showActivity("challenge");
  f.choose(challenge.answer);
  pending = f.confirm().onclick();
  f.resolve();
  await pending;
  assert.match(f.body.innerHTML, /Challenge complete/);
  const count = f.travels.length;
  f.ids.get("#receipt-next").children[0].onclick();
  assert.equal(f.travels.length, count);
  assert.equal(f.engine.get("neighbor").progress[1].challenge, true);
  assert.equal(f.engine.get("neighbor").progress[1].score, 65);
});

test("fictional payment receipt displays the recorded cycle and retained budget", async () => {
  const f = fixture(5);
  f.context.showActivity("activity");
  f.choose(0);
  const pending = f.confirm().onclick();
  f.resolve();
  await pending;
  const cycle = f.engine.get("neighbor").progress[5].cycles[0];
  assert.equal(f.context.panel, "receipt");
  assert.match(f.body.innerHTML, /Payment made on time/);
  assert(
    f.body.innerHTML.includes(
      `Paid ${cycle.payment}; spent ${cycle.expense}; kept ${cycle.retained}`,
    ),
  );
  assert.equal(f.engine.get("neighbor").progress[5].score, 20);
});
