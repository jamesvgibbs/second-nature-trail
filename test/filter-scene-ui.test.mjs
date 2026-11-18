import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fixture as baseFixture } from "./client-simulation-fixture.mjs";
import {
  filterSceneModel,
  hitFilterHotspot,
  FILTER_GEOMETRY,
} from "../public/filter-scene.mjs";
import { clipMove } from "../public/world.mjs";
import { CHAPTERS } from "../content.mjs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
function section(start, end) {
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  assert(a >= 0 && b > a);
  return source.slice(a, b);
}
function fixture() {
  const f = baseFixture(1),
    c = f.context;
  for (const id of ["#mission", "#phase-label", "#map-label"]) {
    const element = f.document.createElement("div");
    f.ids.set(id, element);
    f.persistent.add(id);
  }
  Object.assign(c, {
    clipMove,
    filterSceneModel,
    hitFilterHotspot,
    filterState: {
      epoch: null,
      key: "",
      selection: null,
      pending: false,
      token: 0,
      overview: false,
      completedHome: null,
      journal: null,
      focusedPeerId: null,
    },
    travelToastText: null,
    app: { querySelector: () => null },
    chapterMapStatus: () => ({}),
    contributionsHTML: () => "",
    setDestination: (x, y, kind) => {
      c.target = { x, y, arrival: kind };
      f.travels.push([x, y, kind]);
    },
    keyLabel: (key) => c.keys[key].toUpperCase(),
  });
  vm.runInContext(
    section("function renderMission(", "function nextChapterHTML("),
    c,
  );
  vm.runInContext(
    section("function worldKeys(", 'modal.addEventListener("keydown"'),
    c,
  );
  vm.runInContext(section("function travel(", "function showActivity("), c);
  c.renderMission();
  const near = () => {
    const t = c.state.chapter.task?.target;
    if (t) {
      f.engine.get("neighbor").position = { x: t.x, y: t.y };
      f.send();
    }
  };
  async function submit() {
    const p = c.filterPrimary();
    f.resolve();
    await p;
  }
  return { ...f, near, submit };
}
async function inspect(f) {
  f.near();
  await f.submit();
  assert.equal(f.context.syncFilterState().stage, "decide");
}
function key(f, value) {
  f.context.worldKeys({ key: value, preventDefault() {} });
}

test("six real filter work orders inspect, reject wrong choice, install and retain the completed home until Next", async () => {
  const f = fixture(),
    c = f.context;
  assert.equal(c.syncFilterState().options.length, 0);
  for (let i = 0; i < 6; i++) {
    await inspect(f);
    const actual = CHAPTERS[1].tasks[i],
      name = c.state.chapter.task.target.name;
    assert.equal(c.syncFilterState().evidence, actual.evidence);
    c.selectFilterChoice((actual.answer + 1) % 3);
    await f.submit();
    assert.equal(c.syncFilterState().homeRestored, false);
    assert.equal(c.state.me.progress[1].step, i);
    assert.match(c.filterState.journal.title, /another look/);
    c.selectFilterChoice(actual.answer);
    const before =
      c.state.me.inventory.filters + c.state.me.progress[1].reserve.filters;
    await f.submit();
    assert.equal(c.state.me.progress[1].step, i + 1);
    assert.equal(
      c.state.me.inventory.filters + c.state.me.progress[1].reserve.filters,
      before - 1,
    );
    assert.equal(c.syncFilterState().stage, "installed");
    assert.equal(c.syncFilterState().homeName, name);
    assert.equal(c.syncFilterState().homeRestored, true);
    assert.equal(
      f.ids.get("#filter-primary").textContent,
      i === 5 ? "Open field notes" : "Next home",
    );
    assert.equal(f.document.activeElement, f.ids.get("#filter-result"));
    f.send();
    assert.equal(c.syncFilterState().homeName, name);
    if (i < 5) {
      c.filterPrimary();
      assert.equal(c.syncFilterState().stage, "inspect");
      assert.equal(c.syncFilterState().homeRestored, false);
      assert.equal(c.target.arrival, "activity");
      c.target = null;
    }
  }
  assert.equal(c.state.me.progress[1].complete, true);
  assert.equal(c.state.me.progress[1].score, 35); // wrong-first at0 floors, five later -5 penalties
  // Reload-like local state loss retains all six confirmed repairs, no invented progress.
  c.filterState.completedHome = null;
  c.filterState.journal = null;
  assert.equal(c.syncFilterState().completedHomes.filter(Boolean).length, 6);
});

test("pointer cards and keyboard numbers select the same authored IDs; only confirmation sends a task", async () => {
  const f = fixture();
  await inspect(f);
  for (let i = 0; i < 3; i++) {
    const box = FILTER_GEOMETRY.cards[i];
    f.context.filterSceneClick(box.x + 10, box.y + 10);
    assert.equal(f.context.filterState.selection, i);
    const count = f.requests.length;
    key(f, String(i + 1));
    assert.equal(f.context.filterState.selection, i);
    assert.equal(f.requests.length, count);
  }
  const result = f.context.filterPrimary();
  assert.equal(f.requests.at(-1).action.choice, 2);
  f.resolve();
  await result;
  assert.equal(f.requests.at(-1).action.expectedChapter, 1);
  assert.equal(f.requests.at(-1).action.expectedStage, "decide");
});

test("pending confirmation deduplicates; pause, phase and epoch changes cannot publish a stale installed home", async () => {
  for (const boundary of ["pause", "chapter", "epoch"]) {
    const f = fixture();
    await inspect(f);
    f.context.selectFilterChoice(CHAPTERS[1].tasks[0].answer);
    const p = f.context.filterPrimary(),
      count = f.requests.length;
    f.context.filterPrimary();
    assert.equal(f.requests.length, count);
    assert.equal(f.ids.get("#filter-primary").disabled, true);
    f.send(
      (v) => {
        if (boundary === "pause") {
          v.event.phase = "paused";
          v.event.paused = true;
          v.event.pausedPhase = "chapter";
        }
        if (boundary === "chapter") {
          v.event.chapter = 2;
          v.event.phase = "chapter";
        }
      },
      boundary === "epoch" ? "replacement-process" : "trail-ui",
    );
    f.resolve();
    await p;
    assert.equal(f.context.filterState.completedHome, null);
  }
  const f = fixture();
  f.send((v) => {
    v.event.phase = "paused";
    v.event.paused = true;
    v.event.pausedPhase = "chapter";
  });
  assert.equal(f.ids.get("#filter-primary").disabled, true);
  await f.context.filterPrimary();
  assert.equal(f.requests.length, 0);
});

test("newer Help/overview focus is never hijacked by accepted installation", async () => {
  const f = fixture();
  await inspect(f);
  f.context.selectFilterChoice(0);
  const p = f.context.filterPrimary();
  f.context.setFilterOverview(true);
  f.context.panel = "help";
  f.context.open("Help", '<p id="help-copy">Help remains open</p>');
  f.ids.get("#help-copy").focus();
  const focus = f.document.activeElement;
  f.resolve();
  await p;
  assert.equal(f.context.filterState.overview, true);
  assert.equal(f.modal.open, true);
  assert.equal(f.document.activeElement, focus);
});

test("100 peers and unrelated score updates preserve selected option and deliberate companion names", async () => {
  const f = fixture();
  await inspect(f);
  f.context.selectFilterChoice(1);
  const original = f.context.filterState.selection;
  f.send((v) => {
    v.players = Array.from({ length: 100 }, (_, i) => ({
      id: "peer-" + String(i).padStart(3, "0"),
      name: "Neighbor " + i,
      position: { ...v.me.position },
      setup: true,
      connected: true,
    }));
  });
  assert.equal(f.context.filterState.selection, original);
  assert.equal(f.context.syncFilterState().teammates.length, 3);
  assert.equal(f.ids.get("#filter-companions").children[0].textContent, "100 nearby · 101 connected"); // fixture injects100 others plus self
  assert.equal(
    f.ids.get("#filter-companions").querySelectorAll("button").length,
    3,
  );
  const peer = f.ids.get("#filter-companions").querySelectorAll("button")[1];
  peer.onclick();
  assert.match(
    f.ids.get("#filter-companions").querySelectorAll("button")[1].textContent,
    /Neighbor 1/,
  );
  assert.equal(f.context.filterState.selection, original);
  const focus = f.document.activeElement;
  f.send((v) => {
    v.event.contributions[1] = 1;
  });
  // This projection has no peers: deliberate lost peer focus safely returns to canvas.
  assert.notEqual(f.document.activeElement, focus);
  assert.equal(f.document.activeElement, f.canvas);
});

test("movement reveals the real overview; Escape returns, and arrival clears only its travel toast", () => {
  const f = fixture(),
    c = f.context;
  key(f, "d");
  assert.equal(c.filterState.overview, true);
  assert.equal(c.target.x, c.state.me.position.x + 35);
  key(f, "Escape");
  assert.equal(c.filterState.overview, false);
  c.travel(0, "activity");
  assert.match(f.ids.get("#toast").textContent, /Visiting/);
  c.showActivity("activity");
  assert.equal(f.ids.get("#toast").style.display, "none");
  c.travel(0, "activity");
  c.toast("A neighbor offered a trade.");
  c.showActivity("activity");
  assert.equal(f.ids.get("#toast").textContent, "A neighbor offered a trade.");
  assert.equal(f.ids.get("#toast").style.display, "block");
});

 test("number-key selection keeps E confirmation working from the now-focused choice button", async()=>{
 const f=fixture(); await inspect(f); const answer=CHAPTERS[1].tasks[0].answer; key(f,String(answer+1));
 const focused=f.document.activeElement;
 assert.equal(focused.dataset.focusKey,`filter:choice:${answer}`);
 let prevented=false;
 const p=focused.onkeydown({key:'e',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(f.requests.at(-1).action.choice,answer);
 f.resolve();await p;
 assert.equal(f.context.state.me.progress[1].step,1);
 assert.equal(f.context.syncFilterState().stage,'installed');
 const outcome=f.document.activeElement;assert.equal(outcome.id,'filter-result');
 outcome.onkeydown({key:'e',preventDefault(){}});
 assert.equal(f.context.syncFilterState().stage,'inspect');assert.equal(f.context.target.arrival,'activity');
 });
