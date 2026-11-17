import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { Engine } from "../engine.mjs";
import {
  FIELD_NOTES,
  DELIVERY_STAGES,
  stageLabel,
} from "../public/trail-visuals.mjs";

const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const section = (start, end) =>
  source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start)),
  );

// Run the same mission renderer and escaping helper used by the browser.
// Minimal nodes supply only DOM operations needed by the finale/results paths.
function renderSurface(state, isPresentation = false) {
  const mission = {
    innerHTML: "",
    dataset: {},
    contains: () => false,
    querySelectorAll: () => [],
  };
  const nodes = new Map([
    ["#mission", mission],
    ["#phase-label", {}],
    ["#map-label", {}],
  ]);
  const actions = () => ({
    children: [],
    append(...items) {
      this.children.push(...items);
    },
    prepend() {},
    querySelectorAll() {
      return this.children.filter(
        (child) => typeof child.onclick === "function",
      );
    },
  });
  const finaleActions = actions(),
    chapterActions = actions(),
    secondaryActions = actions();
  const context = vm.createContext({
    state,
    isPresentation,
    FIELD_NOTES,
    DELIVERY_STAGES,
    stageLabel,
    $: (selector) => {
      if (
        selector === "#finale-action" &&
        mission.innerHTML.includes('id="finale-action"')
      )
        return finaleActions;
      if (selector === "#finale-action button")
        return finaleActions.children[0] || null;
      if (
        selector === "#chapter-actions" &&
        mission.innerHTML.includes('id="chapter-actions"')
      )
        return chapterActions;
      if (
        selector === "#secondary-actions" &&
        mission.innerHTML.includes('id="secondary-actions"')
      )
        return secondaryActions;
      return nodes.get(selector) || null;
    },
    document: { activeElement: null, createElement: () => ({}) },
    modal: { open: false },
    btn: (textContent, onclick) => ({ textContent, onclick, disabled: false }),
    learning() {},
    mystery() {},
    travel() {},
    contributionsHTML: () => "restoration",
    verifiedHighlightHTML: () => "verified highlight",
    standingsHTML: () => "standings",
    nextChapterHTML: () => "next chapter",
  });
  vm.runInContext(section("const esc =", "const btn ="), context);
  vm.runInContext(
    section("function awardsHTML()", "function tutorialDone("),
    context,
  );
  vm.runInContext(
    section("function deliveryTrailHTML(", "function firstUseControls("),
    context,
  );
  vm.runInContext(
    section("function renderMission()", "function nextChapterHTML()"),
    context,
  );
  vm.runInContext("renderMission()", context);
  return {
    html: mission.innerHTML,
    finaleButton: finaleActions.children[0],
    chapterButtons: [
      ...chapterActions.querySelectorAll("button"),
      ...secondaryActions.querySelectorAll("button"),
    ],
    label: nodes.get("#phase-label").textContent,
  };
}
const render = (state, presentation) => renderSurface(state, presentation).html;

function finaleFixture(phase = "finale") {
  let time = 1000000;
  const engine = new Engine({ now: () => time });
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
    requestId: "lobby",
    reason: "UI regression",
  });
  engine.host("operator", {
    type: "start",
    requestId: "start",
    reason: "UI regression",
  });
  const boundary = () => {
    time = engine.state.deadline;
    engine.tick();
  };
  for (let i = 0; engine.state.phase !== phase && i < 20; i++) boundary();
  assert.equal(engine.state.phase, phase);
  assert.equal(engine.state.finale.ending, null);
  return {
    engine,
    boundary,
    elapse: (ms) => {
      time += ms;
      engine.tick();
    },
  };
}

for (const success of [false, true]) {
  test(`${success ? "successful" : "unmet-target"} finale ending stays visible through awards and closed`, () => {
    const { engine, boundary } = finaleFixture();
    if (success)
      engine.dispatch("neighbor", { type: "finale", requestId: "repair" });
    else assert.equal(engine.state.finale.contributors.length, 0);
    boundary();
    assert.equal(engine.state.phase, "awards");
    const ending = engine.state.finale.ending;
    assert.match(
      ending,
      success ? /labeling extension cords/ : /reboot a toaster/,
    );
    for (const phase of ["awards", "closed"]) {
      assert.equal(engine.state.phase, phase);
      for (const presentation of [false, true]) {
        const state = presentation
          ? { event: engine.event(), players: [] }
          : engine.view("neighbor");
        const html = render(state, presentation);
        assert.ok(
          html.includes(`<div class="notice" role="status">${ending}</div>`),
        );
        assert.equal(
          (html.match(/<li>/g) || []).length,
          15,
          "Ending must not replace awards",
        );
        assert.ok(
          html.indexOf(ending) < html.indexOf('<ol class="leaderboard">'),
        );
        assert.ok(
          !html.includes("A neighborhood<br>restored."),
          "Results heading must not contradict fallback",
        );
      }
      if (phase === "awards") boundary();
    }
  });
}

test("results escape authoritative ending text and do not invent an absent ending", () => {
  for (const phase of ["awards", "closed"]) {
    const event = {
      phase,
      chapter: 7,
      awards: [],
      finale: { ending: '<img src=x onerror="alert(1)"> & neighbors' },
    };
    const html = render({ event });
    assert.ok(!html.includes("<img"));
    assert.ok(
      html.includes(
        "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; neighbors",
      ),
    );
    event.finale.ending = null;
    const absent = render({ event });
    assert.ok(!absent.includes('role="status"'));
    assert.ok(absent.includes("The end of<br>the trail."));
    delete event.finale;
    assert.equal(render({ event }), absent);
  }
});

for (const phase of ["countdown", "chapter", "brag", "finale"]) {
  test(`paused ${phase} keeps its display context and frozen authority`, () => {
    const { engine, elapse } = finaleFixture(phase);
    const awards = structuredClone(engine.state.awards);
    const standings = engine.view("neighbor").standings;
    const remaining = engine.event().remainingMs;
    engine.host("operator", {
      type: "pause",
      requestId: "pause",
      reason: "Display context regression",
    });
    elapse(12000);
    for (const view of [
      engine.view("neighbor"),
      engine.actionView("neighbor"),
      engine.presentation(),
      engine.hostView(),
    ]) {
      assert.equal(view.event.phase, "paused");
      assert.equal(view.event.paused, true);
      assert.equal(view.event.pausedPhase, phase);
      assert.equal(view.event.remainingMs, remaining);
      assert.equal(view.event.deadline, null);
    }
    for (const presentation of [false, true]) {
      const view = presentation
        ? engine.presentation()
        : engine.view("neighbor");
      const rendered = renderSurface(view, presentation);
      assert.equal(rendered.label, "Paused");
      assert.match(
        rendered.html,
        {
          countdown: /The trail<br>starts here/,
          chapter: /CHAPTER 1 \/ 08/,
          brag: /Bragging rights/,
          finale: /Bring the<br>lights home/,
        }[phase],
      );
      if (phase !== "chapter")
        assert.ok(!rendered.html.includes('id="chapter-actions"'));
      if (phase === "chapter" && !presentation) {
        assert.ok(rendered.chapterButtons.length > 0);
        assert.ok(rendered.chapterButtons.every((button) => button.disabled));
      }
      if (phase === "finale") {
        if (presentation) assert.equal(rendered.finaleButton, undefined);
        else assert.equal(rendered.finaleButton.disabled, true);
      }
      if (phase === "brag") assert.deepEqual(view.standings, standings);
    }
    if (phase === "finale") {
      assert.throws(
        () =>
          engine.dispatch("neighbor", {
            type: "finale",
            requestId: "paused-repair",
          }),
        /Finale is not active/,
      );
      assert.equal(engine.state.finale.contributors.length, 0);
    }
    assert.deepEqual(engine.state.awards, awards);
    engine.host("operator", {
      type: "resume",
      requestId: "resume",
      reason: "Display context regression",
    });
    assert.equal(engine.event().phase, phase);
    assert.equal(engine.event().pausedPhase, null);
    assert.equal(engine.event().remainingMs, remaining);
    if (phase === "finale")
      assert.equal(
        renderSurface(engine.view("neighbor")).finaleButton.disabled,
        false,
      );
  });
}

test("paused-phase projection only exposes supported display phases", () => {
  const { engine } = finaleFixture();
  engine.host("operator", {
    type: "pause",
    requestId: "pause",
    reason: "Projection allowlist",
  });
  engine.state.pause.phase = "unexpected-internal-value";
  assert.equal(engine.event().pausedPhase, null);
  assert.equal(engine.event().phase, "paused");
});

test("frame labels a closed event ENDED while paused clocks remain fixed", () => {
  const timer = {};
  const context = vm.createContext({
    state: { event: { phase: "closed", deadline: null, paused: false } },
    activeCanvas: { isConnected: true },
    activeCtx: {},
    target: null,
    measureFrame() {},
    drawMap() {},
    requestAnimationFrame() {},
    serverOffset: 0,
    $: (selector) => (selector === "#timer" ? timer : null),
  });
  vm.runInContext(section("function frame(", "function rect("), context);
  vm.runInContext("frame(100)", context);
  assert.equal(timer.textContent, "ENDED");
  context.state.event = { phase: "lobby", deadline: null, paused: false };
  vm.runInContext("frame(200)", context);
  assert.equal(timer.textContent, "LOBBY");
  context.state.event = {
    phase: "paused",
    pausedPhase: "finale",
    deadline: null,
    paused: true,
    remainingMs: 123000,
  };
  vm.runInContext("frame(999999)", context);
  assert.equal(timer.textContent, "02:03");
});
