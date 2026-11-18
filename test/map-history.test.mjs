import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { Engine } from "../engine.mjs";
import { chapterMapStatus } from "../public/helpers.mjs";

function untouched() {
  const engine = new Engine();
  engine.addPlayer("late", "Late neighbor");
  return engine.view("late").me.progress[0];
}
const event = { phase: "chapter", chapter: 3, ranked: Array(8).fill(true) };

test("late-player untouched prior chapters remain visibly unplayed and zero despite allocated reserves", () => {
  const progress = untouched(), before = structuredClone(progress);
  assert.ok(progress.reserve.parts > 0);
  assert.deepEqual(chapterMapStatus(event, progress, 0), {
    position: "past", status: "Unplayed", score: 0, unranked: false, label: "Unplayed · 0 points",
  });
  assert.deepEqual(progress, before);
});

test("partial records include zero-score learning, secrets, attempts, inspections, assistance and loaded cargo", () => {
  const cases = [
    { quiz: [{ correct: false, choice: 0 }, null] },
    { quiz: [{ correct: true, choice: 0 }, null], score: 10 },
    { secret: true }, { mistakes: 1 }, { inspected: true }, { lastTaskAt: 0 },
    { targetRound: 0 }, { siteHits: 1 }, { pendingAssist: "helper" },
    { assists: ["recipient"], score: 5 }, { cycles: [{ onTime: false }] },
    { delivery: { stage: "route", loaded: "connection", route: null, visited: false } },
    { rewardEarned: 2 },
  ];
  for (const change of cases) {
    const result = chapterMapStatus(event, { ...untouched(), ...change }, 0);
    assert.equal(result.status, "Partial", JSON.stringify(change));
    assert.equal(result.score, change.score || 0);
  }
});

test("completed and skipped chapters report saved scores without granting completion or counting excluded scores", () => {
  assert.equal(chapterMapStatus(event, { ...untouched(), complete: true, score: 70 }, 0).label, "Complete · 70 points");
  const skipped = { ...event, ranked: [false, ...Array(7).fill(true)] };
  assert.equal(chapterMapStatus(skipped, { ...untouched(), step: 1, score: 10 }, 0).label, "Skipped · Unranked · Partial · 10 points (not counted)");
  assert.equal(chapterMapStatus(skipped, untouched(), 0).status, "Unplayed");
});

test("current, future, countdown and paused/finished chapter labels remain distinct", () => {
  assert.equal(chapterMapStatus(event, untouched(), 3).label, "Active · Unplayed · 0 points");
  assert.equal(chapterMapStatus(event, untouched(), 4).label, "Upcoming");
  assert.equal(chapterMapStatus({ ...event, phase: "countdown" }, untouched(), 3).label, "Starting");
  assert.equal(chapterMapStatus({ ...event, phase: "paused", pausedPhase: "chapter" }, untouched(), 3).position, "current");
  for (const phase of ["brag", "finale", "awards", "closed"])
    assert.equal(chapterMapStatus({ ...event, phase }, untouched(), 3).position, "past");
  for (const phase of ["finale", "awards", "closed"])
    assert.equal(chapterMapStatus({ ...event, phase }, untouched(), 7).label, "Unplayed · 0 points");
});

test("actual Map rendering exposes history in button text and preserves current-district navigation", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const holder = { children: [], append(node) { this.children.push(node); } };
  const focus = { id: "close-modal" };
  const context = vm.createContext({
    state: { event: { ...event, chapter: 1 }, me: { progress: [untouched(), { ...untouched(), step: 1, score: 10 }] } },
    districts: Array.from({ length: 8 }, (_, i) => [`District ${i + 1}`, "First", "Second"]),
    // History rows in the explicit neighborhood overview.
    isMoveDayAvailable: () => false,
    // This fixture exercises the retained overview; focused filter behavior has its own adapter.
    isFilterFocused: () => false,
    isFilterAvailable: () => false,
    chapterMapStatus, panel: "", document: { activeElement: focus, createElement: () => ({}) },
    $: () => holder, open() {}, close() {},
    btn: (textContent, onclick, className) => ({ textContent, onclick, className, children: [], append(...nodes) { this.children.push(...nodes); } }),
    toast: (message) => { context.message = message; },
    travel: (...args) => { context.destination = args; },
  });
  vm.runInContext(source.slice(source.indexOf("function map()"), source.indexOf("function mystery()")), context);
  vm.runInContext("map()", context);
  assert.equal(holder.children.length, 8);
  assert.equal(holder.children[0].children[1].textContent, "Unplayed · 0 points");
  assert.equal(holder.children[1].children[1].textContent, "Active · Partial · 10 points");
  assert.equal(holder.children[2].children[1].textContent, "Upcoming");
  holder.children[0].onclick();
  assert.match(context.message, /chapter has ended.*Unplayed · 0 points/);
  assert.equal(context.destination, undefined);
  holder.children[1].onclick();
  assert.deepEqual(context.destination, [0, "activity"]);
  holder.children[2].onclick();
  assert.equal(context.message, "That district opens in its chapter.");
  assert.equal(context.document.activeElement, focus, "Rendering history must not move keyboard focus");
  context.state.event = { ...event, chapter: 2 };
  context.destination = undefined;
  holder.children[1].onclick();
  assert.equal(context.destination, undefined, "A formerly active row cannot navigate the new chapter after a transition");
  assert.match(context.message, /chapter has ended/);
  holder.children[2].onclick();
  assert.deepEqual(context.destination, [0, "activity"], "The newly active row follows current authoritative context");
  for (const phase of ["brag", "finale", "awards", "closed", "countdown"]) {
    holder.children = [];
    context.state.event = { ...event, chapter: 1, phase };
    context.destination = undefined;
    vm.runInContext("map()", context);
    holder.children[1].onclick();
    assert.equal(context.destination, undefined, `${phase}: current index is not an active play destination`);
    assert.equal(holder.children[1].className, "");
    assert.match(context.message, phase === "countdown" ? /opens in its chapter/ : /chapter has ended/);
    if (["finale", "awards", "closed"].includes(phase)) {
      assert.equal(holder.children[7].children[1].textContent, "Unplayed · 0 points");
      holder.children[7].onclick();
      assert.match(context.message, /chapter has ended/);
      assert.equal(context.destination, undefined);
    }
  }
});
