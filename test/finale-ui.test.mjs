import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { Engine } from "../engine.mjs";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

// Run the same mission renderer and escaping helper used by the browser.
// Minimal nodes supply only DOM operations needed by the finale/results paths.
function render(state, isPresentation = false) {
  const mission = {
    innerHTML: "", dataset: {}, contains: () => false,
    querySelectorAll: () => [],
  };
  const nodes = new Map([
    ["#mission", mission], ["#phase-label", {}], ["#map-label", {}],
  ]);
  const context = vm.createContext({
    state, isPresentation,
    $: (selector) => nodes.get(selector) || null,
    document: { activeElement: null },
    modal: { open: false },
  });
  vm.runInContext(section("const esc =", "const btn ="), context);
  vm.runInContext(section("function awardsHTML()", "function tutorialDone("), context);
  vm.runInContext(section("function renderMission()", "function nextChapterHTML()"), context);
  vm.runInContext("renderMission()", context);
  return mission.innerHTML;
}

function finaleFixture() {
  let time = 1000000;
  const engine = new Engine({ now: () => time });
  engine.addPlayer("neighbor", "Neighbor");
  engine.dispatch("neighbor", {
    type: "setup", requestId: "setup", character: 0, palette: 0, insects: false,
  });
  engine.host("operator", { type: "lobby", requestId: "lobby", reason: "UI regression" });
  engine.host("operator", { type: "start", requestId: "start", reason: "UI regression" });
  const boundary = () => { time = engine.state.deadline; engine.tick(); };
  for (let i = 0; engine.state.phase !== "finale" && i < 20; i++) boundary();
  assert.equal(engine.state.phase, "finale");
  assert.equal(engine.state.finale.ending, null);
  return { engine, boundary };
}

for (const success of [false, true]) {
  test(`${success ? "successful" : "unmet-target"} finale ending stays visible through awards and closed`, () => {
    const { engine, boundary } = finaleFixture();
    if (success) engine.dispatch("neighbor", { type: "finale", requestId: "repair" });
    else assert.equal(engine.state.finale.contributors.length, 0);
    boundary();
    assert.equal(engine.state.phase, "awards");
    const ending = engine.state.finale.ending;
    assert.match(ending, success ? /labeling extension cords/ : /reboot a toaster/);
    for (const phase of ["awards", "closed"]) {
      assert.equal(engine.state.phase, phase);
      for (const presentation of [false, true]) {
        const state = presentation ? { event: engine.event(), players: [] } : engine.view("neighbor");
        const html = render(state, presentation);
        assert.ok(html.includes(`<div class="notice" role="status">${ending}</div>`));
        assert.equal((html.match(/<li>/g) || []).length, 15, "Ending must not replace awards");
        assert.ok(html.indexOf(ending) < html.indexOf('<ol class="leaderboard">'));
        assert.ok(!html.includes("A neighborhood<br>restored."), "Results heading must not contradict fallback");
      }
      if (phase === "awards") boundary();
    }
  });
}

test("results escape authoritative ending text and do not invent an absent ending", () => {
  for (const phase of ["awards", "closed"]) {
    const event = { phase, chapter: 7, awards: [], finale: { ending: '<img src=x onerror="alert(1)"> & neighbors' } };
    const html = render({ event });
    assert.ok(!html.includes("<img"));
    assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; neighbors"));
    event.finale.ending = null;
    const absent = render({ event });
    assert.ok(!absent.includes('role="status"'));
    assert.ok(absent.includes("The end of<br>the trail."));
    delete event.finale;
    assert.equal(render({ event }), absent);
  }
});
