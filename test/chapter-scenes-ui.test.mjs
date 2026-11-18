import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fixture as baseFixture } from "./client-simulation-fixture.mjs";
import {
  drawChapterScene,
  chapterSceneModel,
  hitChapterHotspot,
  CHAPTER_SCENE_TITLES,
  CHAPTER_SCENE_GEOMETRY as G,
} from "../public/chapter-scenes.mjs";
import { drawEventScene } from "../public/event-scenes.mjs";
import { Engine } from "../engine.mjs";
import { clipMove } from "../public/world.mjs";
import { CHAPTERS } from "../content.mjs";
import { solveRoute } from "../scripts/load-routing.mjs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
function section(a, b) {
  const i = source.indexOf(a),
    j = source.indexOf(b, i);
  assert(i >= 0 && j > i);
  return source.slice(i, j);
}
function frozenExport(engine) {
  const { operationalAudit, ...result } = engine.exportResults();
  assert(Array.isArray(result.players));
  assert(Array.isArray(result.awards));
  return JSON.stringify(result);
}
// Actual production handlers, real Engine and ordered projections. DOM is a test
// adapter; arrival is explicitly placed at authoritative targets, not path proof.
function fixture(chapter) {
  const f = baseFixture(chapter),
    c = f.context;
  for (const id of ["#mission", "#phase-label", "#map-label"]) {
    f.ids.set(id, f.document.createElement("div"));
    f.persistent.add(id);
  }
  Object.assign(c, {
    clipMove,
    chapterSceneModel,
    hitChapterHotspot,
    CHAPTER_SCENE_TITLES,
    chapterSceneState: {
      epoch: null,
      chapter: null,
      key: "",
      round: null,
      selection: null,
      pending: false,
      token: 0,
      overview: false,
      held: null,
      journal: null,
      focusedPeerId: null,
      route: [],
      auto: false,
      autoRound: null,
    },
    travelToastText: null,
    app: { querySelector: () => null },
    chapterMapStatus: () => ({}),
    contributionsHTML: () => "",
    keyLabel: (k) => c.keys[k].toUpperCase(),
    setDestination: (x, y, kind) => {
      c.target = { x, y, arrival: kind };
      f.travels.push([x, y, kind]);
    },
  });
  vm.runInContext(section("function awardsHTML(", "function tutorialDone("), c);
  vm.runInContext(
    section("function renderMission(", "function nextChapterHTML("),
    c,
  );
  vm.runInContext(section("function travel(", "function showActivity("), c);
  vm.runInContext(
    section("function worldKeys(", 'modal.addEventListener("keydown"'),
    c,
  );
  c.renderMission();
  const near = () => {
    const t = c.sceneShopAvailable()
      ? c.state.chapter.locations[1]
      : c.state.chapter.task?.target || c.state.chapter.locations[0];
    f.engine.get("neighbor").position = { x: t.x, y: t.y };
    f.send();
  };
  const submit = async () => {
    const before = f.requests.length,
      p = c.scenePrimary();
    if (f.requests.length > before) f.resolve();
    await p;
  };
  const next = () => {
    c.scenePrimary();
    c.target = null;
    near();
  };
  const key = (value, target = f.document.activeElement) =>
    c.sceneKeys({ key: value, target, preventDefault() {} });
  return { ...f, near, submit, next, key };
}

for (const chapter of [2, 3, 6])
  test(`chapter ${chapter + 1} six actual inspect/decision controls retain wrong retries, supplies and confirmed repair`, async () => {
    const f = fixture(chapter),
      c = f.context;
    for (let step = 0; step < 6; step++) {
      f.near();
      await f.submit();
      assert.equal(c.syncChapterSceneState().stage, "decide");
      const job = CHAPTERS[chapter].tasks[step];
      f.key(String(((job.answer + 1) % 3) + 1));
      await f.submit();
      assert.equal(c.state.me.progress[chapter].step, step);
      assert.equal(c.syncChapterSceneState().ownRepair, false);
      const before =
        Object.values(c.state.me.inventory).reduce((a, b) => a + b, 0) +
        Object.values(c.state.me.progress[chapter].reserve).reduce(
          (a, b) => a + b,
          0,
        );
      const box = G.choices[job.answer];
      c.sceneClick(box.x + 10, box.y + 10);
      const count = f.requests.length;
      assert.equal(c.chapterSceneState.selection, job.answer);
      assert.equal(f.requests.length, count);
      await f.submit();
      assert.equal(c.state.me.progress[chapter].step, step + 1);
      assert.match(c.chapterSceneState.journal.text, /\+10 task points/);
      assert(
        c.chapterSceneState.journal.text.includes(
          `Chapter score ${c.state.me.progress[chapter].score}`,
        ),
      );
      assert.match(
        c.chapterSceneState.journal.text,
        /Supply change: (parts|food|cable) -1/,
      );
      if (chapter === 6)
        assert.match(c.chapterSceneState.journal.text, /\+2 reward tokens/);
      assert.equal(c.syncChapterSceneState().ownRepair, true);
      assert.equal(
        c.chapterSceneState.held.task.target.name,
        job.target?.name || c.chapterSceneState.held.siteName,
      );
      const after =
        Object.values(c.state.me.inventory).reduce((a, b) => a + b, 0) +
        Object.values(c.state.me.progress[chapter].reserve).reduce(
          (a, b) => a + b,
          0,
        );
      assert.equal(after, before - 1);
      f.send();
      assert(c.chapterSceneState.held);
      if (step < 5) f.next();
    }
    assert.equal(c.state.me.progress[chapter].score, 35);
    if (chapter !== 6)
      assert.equal(c.state.me.progress[chapter].complete, true);
    else {
      f.next();
      assert.equal(c.state.chapter.rewardShop.balance, 12);
      c.selectSceneChoice(0);
      await f.submit();
      assert.equal(c.state.me.progress[6].step, 7);
      assert.equal(c.state.chapter.rewardShop.balance, 8);
      f.next();
      assert.equal(f.ids.get("#scene-primary").disabled, true, "No valid project is selected yet");
      c.selectSceneChoice(2);
      assert.equal(c.chapterSceneState.selection, null);
      assert.equal(f.ids.get("#scene-primary").disabled, true, "Unaffordable celebration cannot enable funding");
      c.selectSceneChoice(1);
      await f.submit();
      assert.equal(c.state.chapter.rewardShop.balance, 0);
      f.next();
      assert.equal(f.ids.get("#scene-primary").textContent, "Open field notes");
      assert.equal(f.ids.get("#scene-primary").disabled, false);
      const requestsBeforeNotes=f.requests.length;
      c.scenePrimary();
      assert.equal(c.panel, "field-notes");
      assert.equal(f.requests.length, requestsBeforeNotes, "Exhausted shop opens read-only notes without a purchase");
      assert.equal(c.state.me.progress[6].score, 35);
      assert.deepEqual(Array.from(c.state.chapter.rewardShop.uses), [
        "garden",
        "welcome",
      ]);
    }
  });

test("three actual route controls use public node IDs, reject broken paths, reset and complete constrained graphs", async () => {
  const f = fixture(7),
    c = f.context;
  for (let site = 0; site < 3; site++) {
    f.near();
    const task = c.state.chapter.task;
    c.selectSceneNode(task.destination);
    await f.submit();
    assert.equal(c.state.me.progress[7].step, site);
    assert.equal(c.chapterSceneState.held, null);
    const reset = [
      ...f.ids.get("#scene-actions").querySelectorAll("button"),
    ].find((b) => b.textContent === "Reset path");
    reset.onclick();
    assert.equal(c.chapterSceneState.journal.title, "Route updated.");
    assert.match(c.chapterSceneState.journal.text, /Review.*before connecting/);
    assert.deepEqual(Array.from(c.chapterSceneState.route), [task.source]);
    const path = solveRoute(task);
    for (const id of path.slice(1)) {
      const n = chapterSceneModel(c.state).nodes.find((n) => n.id === id);
      c.sceneClick(n.sceneX, n.sceneY);
    }
    assert.deepEqual(Array.from(c.chapterSceneState.route), path);
    await f.submit();
    assert.equal(c.state.me.progress[7].step, site + 1);
    assert.match(c.chapterSceneState.journal.text, /\+20 task points/);
    assert.match(c.chapterSceneState.journal.text, /cable -1/);
    assert.deepEqual(Array.from(c.chapterSceneState.held.route), path);
    if (site < 2) f.next();
  }
  assert.equal(c.state.me.progress[7].score, 50);
  assert.equal(c.state.me.inventory.cable, 0);
});

test("payment controls enforce opening, retain late outcome and carry budgets through all three recorded cycles", async () => {
  const f = fixture(5),
    c = f.context;
  for (let cycle = 0; cycle < 3; cycle++) {
    f.near();
    const task = c.state.chapter.task;
    if (cycle) {
      c.selectSceneChoice(0);
      const count = f.requests.length;
      await f.submit();
      assert.equal(f.requests.length, count);
    }
    f.time(cycle === 2 ? task.dueAt : task.opensAt);
    c.selectSceneChoice(cycle === 1 ? 1 : 0);
    await f.submit();
    const p = c.state.me.progress[5];
    assert.equal(p.step, cycle + 1);
    assert.equal(p.cycles[cycle].onTime, cycle !== 2);
    assert.equal(c.chapterSceneState.held.task.budget, task.budget);
    assert.equal(c.syncChapterSceneState().ownRepair, cycle !== 2);
    if (cycle < 2) f.next();
  }
  assert.equal(c.state.me.progress[5].score, 40);
  assert.equal(c.state.me.progress[5].budget, 90);
  assert.match(c.chapterSceneState.journal.text, /No on-time points earned/);
});

for (const auto of [false, true])
  test(`targeting ${auto ? "selected-auto" : "keyboard/manual"} resolves all18 rounds with six-hit site boundaries`, async () => {
    const f = fixture(4),
      c = f.context;
    c.chapterSceneState.auto = auto;
    for (let hit = 0; hit < 18; hit++) {
      f.near();
      let task = c.state.chapter.task;
      if (f.now() > task.actionAllowedAt) {
        f.time(task.nextRoundAt);
        task = c.state.chapter.task;
      }
      const selected = task.targets.find((t) => t.marked).id;
      const count = f.requests.length;
      c.chapterSceneTick();
      assert.equal(f.requests.length, count, "Auto never chooses a target");
      f.time(task.actionAllowedAt);
      c.selectSceneChoice(selected);
      if (auto) {
        c.chapterSceneTick();
        assert.equal(f.requests.length, count + 1);
        f.resolve();
        await new Promise((r) => setImmediate(r));
      } else {
        const p = f.key(" ");
        f.resolve();
        await p;
      }
      assert.equal(c.state.me.progress[4].targetHits, hit + 1);
      assert.equal(
        c.state.me.progress[4].score,
        Math.floor((hit + 1) / 6) * 20,
      );
      const n = f.requests.length;
      c.chapterSceneTick();
      if (!c.chapterSceneState.held) await f.submit();
      assert.equal(
        f.requests.length,
        n,
        "No second action or automatic duplicate in same round",
      );
      if ((hit + 1) % 6 === 0) {
        assert(c.chapterSceneState.held);
        assert.match(c.chapterSceneState.journal.text, /\+20 task points/);
        assert.match(c.chapterSceneState.journal.text, /parts -1/);
        if (hit < 17) f.next();
      }
      if (hit < 17) f.time(task.nextRoundAt);
    }
    assert.equal(c.state.me.progress[4].complete, true);
    assert.equal(c.state.me.inventory.parts, 0);
  });

test("pending actions stay single and cannot steal a new Help panel or show stale phase/epoch repair", async () => {
  for (const transition of ["help", "pause", "epoch", "chapter"]) {
    const f = fixture(2),
      c = f.context;
    f.near();
    await f.submit();
    c.selectSceneChoice(CHAPTERS[2].tasks[0].answer);
    f.canvas.focus();
    const count = f.requests.length,
      p = c.scenePrimary();
    c.scenePrimary();
    assert.equal(f.requests.length, count + 1);
    assert.equal(f.ids.get("#scene-primary").disabled, true);
    if (transition === "help") {
      c.open("Help", '<input id="help-edit">');
      f.ids.get("#help-edit").focus();
    }
    if (transition === "pause") {
      f.engine.host("operator", {
        type: "pause",
        reason: "QA",
        requestId: "pause",
      });
      f.send();
    }
    if (transition === "epoch") f.send(() => {}, "replacement-epoch");
    if (transition === "chapter") {
      f.engine.state.chapter = 3;
      f.send();
    }
    f.resolve();
    await p;
    if (transition === "help") {
      assert.equal(f.modal.open, true);
      assert.equal(f.document.activeElement, f.ids.get("#help-edit"));
    } else assert.equal(c.chapterSceneState.held, null);
  }
});

test("target controls reject early/decoy/repeat and paused selection; a fresh round requires deliberate new choice", async () => {
  const f = fixture(4),
    c = f.context;
  f.near();
  let task = c.state.chapter.task;
  const decoy = task.targets.find((t) => !t.marked).id;
  c.selectSceneChoice(decoy);
  const count = f.requests.length;
  await f.submit();
  assert.equal(f.requests.length, count);
  f.time(task.actionAllowedAt);
  await f.submit();
  assert.equal(c.state.me.progress[4].targetHits, 0);
  assert.match(c.chapterSceneState.journal.title, /decoy/);
  const sent = f.requests.length;
  await f.submit();
  assert.equal(f.requests.length, sent);
  f.time(task.nextRoundAt);
  c.chapterSceneTick();
  assert.equal(c.chapterSceneState.selection, null);
  c.chapterSceneState.auto = true;
  f.time(c.state.chapter.task.actionAllowedAt);
  c.chapterSceneTick();
  assert.equal(f.requests.length, sent);
  f.engine.host("operator", {
    type: "pause",
    reason: "QA",
    requestId: "pause-target",
  });
  f.send();
  c.selectSceneChoice(c.state.chapter.task.targets.find((t) => t.marked).id);
  assert.equal(c.chapterSceneState.selection, null);
  await f.submit();
  assert.equal(f.requests.length, sent);
});

test("100-peer updates preserve owned keyboard choice/result focus and reload reconstructs authoritative progress", async () => {
  const f = fixture(2),
    c = f.context;
  f.near();
  await f.submit();
  f.key("1");
  const chosen = c.chapterSceneState.selection,
    focused = f.document.activeElement;
  for (let i = 0; i < 99; i++) {
    const id = `peer-${String(i).padStart(3, "0")}`;
    f.engine.addPlayer(id, `Peer <${i}>`);
    const p = f.engine.get(id);
    p.setup = true;
    p.connected = true;
    p.position = { ...f.engine.get("neighbor").position };
  }
  f.send();
  assert.equal(c.chapterSceneState.selection, chosen);
  assert.equal(f.document.activeElement, focused);
  assert.equal(c.syncChapterSceneState().teammates.length, 3);
  assert.equal(c.syncChapterSceneState().teammateCount, 99);
  c.selectSceneChoice(CHAPTERS[2].tasks[0].answer);
  f.canvas.focus();
  await f.submit();
  assert.equal(f.document.activeElement, f.ids.get("#scene-result"));
  const saved = JSON.stringify(f.engine.state.players.neighbor);
  f.send();
  assert.equal(f.document.activeElement, f.ids.get("#scene-result"));
  assert.equal(c.chapterSceneState.held.step, 1);
  c.chapterSceneState.held = null;
  c.chapterSceneState.journal = null;
  c.chapterSceneState.epoch = null;
  f.send();
  assert.equal(c.syncChapterSceneState().step, 1);
  assert.equal(c.syncChapterSceneState().ownRepair, false);
  assert.equal(c.syncChapterSceneState().stage, "inspect");
  assert.equal(JSON.stringify(f.engine.state.players.neighbor), saved);
  c.setChapterOverview(true);
  assert.equal(c.sceneFocused(), false);
  c.setChapterOverview(false);
  assert.equal(c.sceneFocused(), true);
  assert.equal(f.document.activeElement, f.canvas);
});

test("finale focused semantic action reaches the same authoritative contribution and leaves frozen scores untouched", async () => {
  const f = fixture(7),
    c = f.context;
  f.engine.host("operator", {
    type: "endScoring",
    reason: "QA finale",
    requestId: "end-score",
  });
  f.send();
  const frozen = frozenExport(f.engine);
  const m = c.syncChapterSceneState();
  assert.equal(m.phase, "finale");
  assert.equal(m.ownRepair, false);
  const p = c.scenePrimary();
  assert.equal(f.requests.at(-1).action.type, "finale");
  f.resolve();
  await p;
  assert.equal(c.syncChapterSceneState().ownRepair, true);
  assert.equal(c.state.event.finale.contributors.length, 1);
  assert.equal(frozenExport(f.engine), frozen);
  assert.equal(
    f.ids.get("#finale-action").querySelectorAll("button")[0].disabled,
    true,
  );
});

test("finale pending button and semantic key cannot duplicate, and newer dialogs/epochs cannot receive old repair feedback", async () => {
  for (const transition of ["none", "help", "epoch", "phase"]) {
    const f = fixture(7),
      c = f.context;
    f.engine.host("operator", {
      type: "endScoring",
      reason: "QA",
      requestId: "freeze",
    });
    f.send();
    const before = frozenExport(f.engine),
      p = c.scenePrimary();
    assert.equal(f.requests.length, 1);
    assert.equal(
      f.ids.get("#finale-action").querySelectorAll("button")[0].disabled,
      true,
    );
    c.scenePrimary();
    c.contributeFinale();
    assert.equal(f.requests.length, 1);
    if (transition === "help") {
      c.open("Help", '<input id="finale-help">');
      f.ids.get("#finale-help").focus();
    }
    if (transition === "epoch") f.send(() => {}, "next-final-epoch");
    if (transition === "phase") {
      f.engine.host("operator", {
        type: "advance",
        reason: "QA",
        requestId: "results",
      });
      f.send();
    }
    f.resolve();
    await p;
    assert.equal(frozenExport(f.engine), before);
    if (transition === "none") {
      assert.equal(c.syncChapterSceneState().ownRepair, true);
      c.scenePrimary();
      assert.equal(f.requests.length, 1);
    } else {
      assert(!f.ids.get("#dialog-feedback")?.textContent?.includes("Repair"));
      if (transition === "help")
        assert.equal(f.document.activeElement, f.ids.get("#finale-help"));
    }
  }
});

test("remapped interact from the actual focused choice/result controls confirms then continues without a canvas focus requirement", async () => {
  const f = fixture(2),
    c = f.context;
  f.near();
  await f.submit();
  f.engine.dispatch("neighbor", {
    type: "setup",
    requestId: "remap-qa",
    character: 0,
    palette: 0,
    insects: false,
    settings: {
      keys: { ...c.keys, interact: "f" },
      reducedMotion: true,
      textSize: 1.5,
    },
  });
  f.send();
  assert.equal(c.keys.interact, "f");
  assert.equal(c.prefs.reducedMotion, true);
  assert.equal(c.prefs.textSize, 24);
  f.key(String(CHAPTERS[2].tasks[0].answer + 1));
  const button = f.document.activeElement;
  assert.equal(button.tagName, "BUTTON");
  const before = f.requests.length;
  const p = button.onkeydown({ key: "f", target: button, preventDefault() {} });
  assert.equal(f.requests.length, before + 1);
  f.resolve();
  await p;
  assert.equal(c.state.me.progress[2].step, 1);
  const result = f.document.activeElement;
  assert.equal(result, f.ids.get("#scene-result"));
  result.onkeydown({ key: "f", target: result, preventDefault() {} });
  assert.equal(c.chapterSceneState.held, null);
  assert.equal(c.syncChapterSceneState().stage, "inspect");
  const n = f.requests.length;
  f.key("f", { tagName: "INPUT" });
  assert.equal(f.requests.length, n);
  assert.equal(c.state.me.progress[2].step, 1);
});

test("completed reload retains chapter score; paused completion opens only read-only field notes", async () => {
  const f = fixture(2),
    c = f.context;
  for (let i = 0; i < 6; i++) {
    f.near();
    await f.submit();
    c.selectSceneChoice(CHAPTERS[2].tasks[i].answer);
    await f.submit();
    if (i < 5) f.next();
  }
  c.chapterSceneState.journal = null;
  c.chapterSceneState.held = null;
  f.send();
  c.renderMission();
  assert.match(f.ids.get("#mission").innerHTML, /Chapter complete/);
  assert.match(f.ids.get("#mission").innerHTML, /60/);
  assert.match(f.ids.get("#supply-hud").innerHTML, /60/);
  f.engine.host("operator", {
    type: "pause",
    reason: "QA complete",
    requestId: "pause-done",
  });
  f.send();
  assert.equal(f.ids.get("#scene-primary").disabled, false);
  const before = f.requests.length;
  await c.scenePrimary();
  assert.equal(f.requests.length, before);
  assert.equal(f.modal.open, true);
  assert.match(f.ids.get("#modal-title").textContent, /Field notes/);
});

test("same-chapter overview preference survives snapshots but a new chapter or finale defaults to its focused scene", () => {
  const f = fixture(2),
    c = f.context;
  c.setChapterOverview(true);
  f.send();
  assert.equal(c.sceneFocused(), false);
  assert.equal(c.chapterSceneState.overview, true);
  f.engine.state.chapter = 3;
  f.send();
  assert.equal(c.sceneFocused(), true);
  assert.equal(c.chapterSceneState.overview, false);
  c.setChapterOverview(true);
  f.engine.host("operator", {
    type: "endScoring",
    reason: "QA finale",
    requestId: "focus-finale",
  });
  f.send();
  assert.equal(c.sceneFocused(), true);
  assert.equal(c.chapterSceneState.overview, false);
});

test("actual presentation frame uses only public safe scenes in all six chapters, breaks and finale, while player practice stays in its world", () => {
  const engine = new Engine({ now: () => 100000 });
  engine.addPlayer("viewer", "Neighbor");
  engine.get("viewer").setup = true;
  const calls = [];
  const ctx = new Proxy({}, { get: (o, k) => o[k] || (() => {}) });
  const c = vm.createContext({
    state: null,
    activeCanvas: { isConnected: true },
    activeCtx: ctx,
    isPresentation: true,
    target: null,
    serverOffset: 0,
    measureFrame() {},
    requestAnimationFrame() {},
    $: () => null,
    sceneFocused: () => false,
    isFilterFocused: () => false,
    isMoveDayFocused: () => false,
    drawChapterScene: (ctx, state, options) => {
      const m = drawChapterScene(ctx, state, options);
      calls.push(["chapter", m]);
    },
    drawEventScene: (ctx, state, options) => {
      const m = drawEventScene(ctx, state, options);
      calls.push(["event", m]);
    },
    drawMap: () => calls.push(["overview"]),
  });
  vm.runInContext(section("function frame(", "function rect("), c);
  for (let chapter = 2; chapter < 8; chapter++) {
    engine.state.chapter = chapter;
    engine.state.phase = "chapter";
    c.state = engine.presentation();
    const before = JSON.stringify(c.state);
    assert.equal(c.state.me, undefined);
    c.frame(1000);
    const [kind, m] = calls.at(-1);
    assert.equal(kind, "chapter");
    assert.equal(m.safe, true);
    assert.equal(m.player, null);
    assert.equal(m.hotspots.length, 0);
    assert.equal(JSON.stringify(c.state), before);
  }
  for (const phase of ["draft", "lobby", "countdown", "brag"]) {
    engine.state.phase = phase;
    c.state = engine.presentation();
    c.frame(1000);
    assert.equal(calls.at(-1)[0], "event");
  }
  engine.state.phase = "chapter";
  engine.host("qa", {
    type: "endScoring",
    reason: "QA public",
    requestId: "end-public",
  });
  for (const phase of ["finale", "awards", "closed"]) {
    engine.state.phase = phase;
    c.state = engine.presentation();
    c.frame(1000);
    assert.equal(calls.at(-1)[0], "chapter");
    assert.equal(calls.at(-1)[1].hotspots.length, 0);
  }
  c.isPresentation = false;
  for (const phase of ["draft", "lobby"]) {
    engine.state.phase = phase;
    c.state = engine.view("viewer");
    c.frame(1000);
    assert.equal(calls.at(-1)[0], "overview");
  }
});

test("finale and result captions/hints follow phase rather than the last chapter",()=>{
 const f=fixture(7),c=f.context;
 const hint=f.document.createElement('div');f.ids.set('#world-hint',hint);f.persistent.add('#world-hint');
 vm.runInContext(section('function updateControlHints()', 'function verifiedHighlightHTML()'),c);
 f.engine.host('operator',{type:'endScoring',reason:'Phase caption check',requestId:'caption-final'});f.send();
 assert.equal(f.ids.get('#map-label').textContent,'BRING THE LIGHTS HOME');
 assert.match(f.ids.get('#mission').innerHTML,/0 neighbors have contributed toward 1 repair\./);
 assert.doesNotMatch(f.ids.get('#mission').innerHTML,/1 repairs/);
 assert.match(hint.textContent,/contributes/);
 f.engine.dispatch('neighbor',{type:'finale',requestId:'caption-repair'});f.send();
 assert.match(hint.textContent,/Your home is restored/);assert.doesNotMatch(hint.textContent,/contributes/);
 f.engine.host('operator',{type:'advance',reason:'Results caption check',requestId:'caption-awards'});f.send();
 assert.equal(f.ids.get('#map-label').textContent,'NEIGHBORHOOD AWARDS');
 assert.match(hint.textContent,/Results are recorded/);
 assert.doesNotMatch(hint.textContent,/continues|contributes|Click to walk/);
 f.engine.host('operator',{type:'close',reason:'Closed caption check',requestId:'caption-closed'});f.send();
 assert.equal(f.ids.get('#map-label').textContent,'THE TRAIL IS COMPLETE');
 assert.match(hint.textContent,/Trail complete/);
});

test("countdown and brag captions suppress frozen movement instructions, including paused equivalents",()=>{
 const f=fixture(0),c=f.context;
 const hint=f.document.createElement('div');f.ids.set('#world-hint',hint);f.persistent.add('#world-hint');
 vm.runInContext(section('function updateControlHints()', 'function noteVisualIntent('),c);
 vm.runInContext(section('function nextChapterHTML()', 'function rewardsShop()'),c);
 vm.runInContext(section('function standingsHTML()', 'function rulesHTML('),c);
 for(const displayPhase of ['countdown','brag'])for(const paused of [false,true]){
  f.send(view=>{view.event.phase=paused?'paused':displayPhase;view.event.paused=paused;view.event.pausedPhase=paused?displayPhase:null;});
  assert.equal(f.ids.get('#map-label').textContent,displayPhase==='countdown'?'COUNTDOWN PREPARATIONS':'CHAPTER BREAK');
  assert.match(hint.textContent,displayPhase==='countdown'?/resume when the chapter opens/:/Scores are frozen.*Next:/);
  assert.doesNotMatch(hint.textContent,/Click to walk|arrows to move|to interact/);
 }
 f.send(view=>{view.event.phase='lobby';view.event.paused=false;view.event.pausedPhase=null;});
 assert.match(hint.textContent,/Click to walk/);
});
