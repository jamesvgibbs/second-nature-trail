import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine } from "../engine.mjs";
import { CHAPTERS, RULES } from "../content.mjs";
import {
  chapterSceneModel,
  drawChapterScene,
  hitChapterHotspot,
  CHAPTER_SCENE_GEOMETRY as G,
} from "../public/chapter-scenes.mjs";
import { solveRoute } from "../scripts/load-routing.mjs";
function fixture(chapter = 2, count = 1) {
  let now = 100000,
    seq = 0;
  const engine = new Engine({ now: () => now });
  for (let i = 0; i < count; i++) {
    engine.addPlayer("p" + i, "Neighbor " + i);
    engine.get("p" + i).setup = true;
  }
  const host = (type) =>
    engine.host("qa", {
      type,
      requestId: "host" + ++seq,
      reason: "Isolated visual renderer fixture",
    });
  host("lobby");
  host("start");
  now = engine.state.deadline;
  engine.tick();
  for (let i = 0; i < chapter * 2; i++) host("advance");
  const view = (id = "p0") => ({
    ...engine.view(id),
    projectionEpoch: "scene-epoch",
  });
  function act(fields = {}) {
    const v = view(),
      task = v.chapter.task,
      target =
        fields.type === "rewardRedeem"
          ? v.chapter.locations[1]
          : task?.target || v.chapter.locations[0];
    engine.get("p0").position = { x: target.x, y: target.y };
    return engine.dispatch("p0", {
      type: "task",
      expectedChapter: chapter,
      expectedStep: v.me.progress[chapter].step,
      expectedStage: task?.stage || null,
      expectedRound: task?.round,
      requestId: "act" + ++seq,
      ...fields,
    });
  }
  return { engine, view, host, act, setTime: (t) => (now = t), now: () => now };
}
function capture(view, options = {}) {
  const marks = [];
  const ctx = {
    save() {},
    restore() {},
    fillRect(x, y, width, height) {
      marks.push({ type: "rect", x, y, width, height, color: this.fillStyle });
    },
    fillText(value, x, y) {
      marks.push({ type: "text", value: String(value), x, y, font: this.font });
    },
  };
  return { model: drawChapterScene(ctx, view, options), marks };
}
function held(before, after, success) {
  return {
    epoch: after.projectionEpoch,
    chapter: after.event.chapter,
    step: after.me.progress[after.event.chapter].step,
    task: before.chapter.task,
    siteName:
      before.chapter.task?.target?.name || before.chapter.locations[0].name,
    success,
    title: success ? "Accepted" : "Try again",
    text: "Authoritative result",
  };
}
const overlap = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

test("finale and results cannot expose invisible incomplete prior-chapter task hotspots", () => {
  const f = fixture(7, 3);
  f.host("endScoring");
  let v = f.view(),
    m = chapterSceneModel(v);
  assert.deepEqual(
    m.hotspots.map((x) => x.action),
    ["objective"],
  );
  assert.equal(m.shared.total, 2);
  const before = JSON.stringify(f.engine.exportResults());
  f.act({ type: "finale" });
  v = f.view();
  m = chapterSceneModel(v);
  assert.equal(m.ownRepair, true);
  assert.equal(m.hotspots.length, 0);
  assert.equal(JSON.stringify(f.engine.exportResults()), before);
  f.host("advance");
  assert.equal(f.view().event.phase, "awards");
  assert.equal(chapterSceneModel(f.view()).hotspots.length, 0);
  assert.match(chapterSceneModel(f.view()).ending, /toaster/);
  f.host("close");
  assert.equal(chapterSceneModel(f.view()).hotspots.length, 0);
  assert.match(chapterSceneModel(f.view()).ending, /toaster/);
});

test("spatial identity/recovery/reward scenes gate evidence and preserve authored choices and actual six-job results", () => {
  for (const chapter of [2, 3, 6]) {
    const f = fixture(chapter);
    for (let step = 0; step < 6; step++) {
      const unopened = f.view();
      for (const key of ["evidence", "answer", "falseAccusations"])
        Object.defineProperty(unopened.chapter.task, key, {
          get() {
            throw Error("private or uninspected " + key);
          },
        });
      Object.defineProperty(unopened.chapter, "questions", {
        get() {
          throw Error("unrelated learning");
        },
      });
      const initial = capture(unopened);
      assert.equal(initial.model.evidence, "");
      assert.deepEqual(initial.model.choices, []);
      f.act({ choice: 0 });
      const before = f.view(),
        model = capture(before).model;
      assert.equal(model.evidence, CHAPTERS[chapter].tasks[step].evidence);
      assert.deepEqual(
        model.choices.map((o) => o.label),
        CHAPTERS[chapter].tasks[step].options,
      );
      const answer = CHAPTERS[chapter].tasks[step].answer;
      f.act({ choice: (answer + 1) % 3 });
      const wrong = f.view();
      assert.equal(wrong.me.progress[chapter].step, step);
      assert.equal(
        capture(wrong, { held: held(before, wrong, false) }).model.ownRepair,
        false,
      );
      const item = CHAPTERS[chapter].tasks[step].item,
        supply =
          wrong.me.inventory[item] + wrong.me.progress[chapter].reserve[item];
      f.act({ choice: answer });
      const after = f.view();
      assert.equal(
        after.me.inventory[item] + after.me.progress[chapter].reserve[item],
        supply - 1,
      );
      const outcome = capture(after, { held: held(before, after, true) }).model;
      assert(outcome.ownRepair);
      assert.equal(outcome.siteName, before.chapter.task.target.name);
      assert.deepEqual(outcome.choices, []);
      assert.equal(
        outcome.shared.completed,
        chapter !== 6 && step === 5 ? 1 : 0,
      );
      const stale = { ...held(before, after, true), epoch: "old" };
      assert.equal(chapterSceneModel(after, { held: stale }).held, false);
    }
    assert.equal(f.view().me.progress[chapter].score, 35);
    assert.equal(f.view().me.progress[chapter].step, 6);
    assert.equal(f.view().me.progress[chapter].complete, chapter !== 6);
  }
});

test("reward projects use canonical garden/welcome/festival IDs and preserve earned balances with no extra score", () => {
  for (let first = 0; first < 3; first++) {
    const f = fixture(6);
    for (let i = 0; i < 6; i++) {
      f.act({ choice: 0 });
      f.act({ choice: CHAPTERS[6].tasks[i].answer });
    }
    let v = f.view(),
      m = chapterSceneModel(v);
    assert.equal(m.total, 7);
    assert.equal(m.rewards.balance, 12);
    assert.deepEqual(
      m.rewards.options.map((x) => x.id),
      ["garden", "welcome", "festival"],
    );
    assert.equal(m.choices.length, 3);
    assert.equal(v.me.progress[6].score, 60);
    f.act({ choice: first });
    v = f.view();
    m = capture(v).model;
    assert.equal(m.step, 7);
    assert.equal(m.personalScore, 60);
    assert.deepEqual(m.rewards.uses, [RULES.rewards.projects[first].id]);
    assert.equal(m.rewards.balance, 12 - RULES.rewards.projects[first].cost);
    assert.throws(
      () => f.act({ type: "rewardRedeem", choice: first }),
      /already funded/,
    );
    if (first === 0) {
      assert.throws(
        () => f.act({ type: "rewardRedeem", choice: 2 }),
        /Not enough/,
      );
      f.act({ type: "rewardRedeem", choice: 1 });
      assert.equal(chapterSceneModel(f.view()).rewards.balance, 0);
      assert.equal(chapterSceneModel(f.view()).personalScore, 60);
    }
  }
});

test("target scene preserves public IDs and all18 real round resolutions, with safe art and site-only credit", () => {
  const f = fixture(4);
  for (let hit = 0; hit < 18; hit++) {
    const v = f.view(),
      t = v.chapter.task;
    f.setTime(t.actionAllowedAt);
    const current = f.view(),
      m = chapterSceneModel(current);
    assert.equal(m.liveTask.round, current.chapter.task.round);
    assert.equal(m.liveTask.siteHits, hit % 6);
    for (let i = 0; i < 3; i++) {
      const b = G.targets[i];
      assert.equal(
        hitChapterHotspot(m, b.x + 5, b.y + 5).choice,
        current.chapter.task.targets[i].id,
      );
    }
    const wrongSafe = capture(current, { safe: true }),
      insects = capture(current, { safe: false }),
      presentation = capture(current, { safe: false, presentation: true });
    assert.equal(wrongSafe.model.safe, true);
    assert.equal(presentation.model.safe, true);
    assert.deepEqual(
      presentation.marks,
      insects.model.safe
        ? insects.marks
        : capture(current, { safe: true, presentation: true }).marks,
    );
    assert.notDeepEqual(wrongSafe.marks, insects.marks);
    const choice = current.chapter.task.targets.find((t) => t.marked).id;
    f.act({ choice });
    const after = f.view();
    assert.equal(after.me.progress[4].score, Math.floor((hit + 1) / 6) * 20);
    assert.equal(after.me.inventory.parts, 3 - Math.floor((hit + 1) / 6));
    if ((hit + 1) % 6 === 0) {
      const cleared = capture(after, { held: held(current, after, true) });
      assert(
        cleared.marks.some((x) => x.value === "6 / 6 RESOLVED HERE"),
        "Cleared site must not display next-site zero hits",
      );
    }
    if (hit < 17) f.setTime(current.chapter.task.nextRoundAt);
  }
  assert.equal(f.view().me.progress[4].complete, true);
  assert.equal(f.view().me.progress[4].targetHits, 18);
});

test("payment scenes retain actual late/incomplete cycle outcome and do not borrow next-cycle budget in held results", () => {
  const f = fixture(5);
  for (let cycle = 0; cycle < 3; cycle++) {
    const before = f.view(),
      t = before.chapter.task;
    f.setTime(cycle === 2 ? t.dueAt : t.opensAt);
    const choice = cycle === 1 ? 1 : 0;
    const result = f.act({ choice });
    const after = f.view();
    assert.equal(result.correct, cycle !== 2);
    const m = chapterSceneModel(after, {
      held: held(before, after, result.correct),
    });
    assert.equal(m.ownRepair, cycle !== 2);
    assert.equal(m.cycles.at(-1).onTime, cycle !== 2);
    assert.equal(m.personalScore, Math.min(cycle + 1, 2) * 20);
    assert.equal(m.task.budget, t.budget);
    const paint = capture(after, { held: held(before, after, result.correct) });
    assert(
      paint.marks.some((x) => x.value === `FUNDS ${t.budget}`),
      "Held receipt must not label next-cycle opening budget as this cycle",
    );
    assert.deepEqual(m.choices, []);
  }
  assert.equal(f.view().me.progress[5].budget, 90);
  const reopened = capture(f.view());
  assert.equal(reopened.model.retainedBudget, 90);
  assert(reopened.marks.some((mark) => mark.value === "KEPT 90"));
  assert(!reopened.marks.some((mark) => mark.value === "FUNDS 0"));
  assert.equal(f.view().me.inventory.food, 0);
  assert.equal(chapterSceneModel(f.view()).step, 3);
  assert.equal(
    chapterSceneModel(f.view()).ownRepair,
    false,
    "Reload must not paint a late cycle as full on-time completion",
  );
  const paid = fixture(5);
  for (let i = 0; i < 3; i++) {
    paid.setTime(paid.view().chapter.task.opensAt);
    paid.act({ choice: 0 });
  }
  assert.equal(chapterSceneModel(paid.view()).ownRepair, true);
  const incomplete = fixture(5);
  for (let i = 0; i < 3; i++) {
    incomplete.setTime(incomplete.view().chapter.task.opensAt);
    incomplete.act({ choice: 2 });
  }
  assert.equal(chapterSceneModel(incomplete.view()).ownRepair, false);
  assert.equal(chapterSceneModel(incomplete.view()).personalScore, 0);
});

test("network model retains real public graph shapes/constraints and depicts each accepted path without inventing links", () => {
  const f = fixture(7);
  for (let site = 0; site < 3; site++) {
    const before = f.view(),
      t = before.chapter.task,
      m = chapterSceneModel(before);
    assert.equal(m.total, 3);
    assert.equal(m.nodes.length, 10);
    assert.deepEqual(
      m.task.edges,
      t.edgeCosts.map((e) => [e.from, e.to]),
    );
    assert.deepEqual(m.task.blockedEdges, RULES.routing.blockedVariants[site]);
    assert.equal(m.task.budget, [9, 9, 12][site]);
    for (const n of m.nodes) {
      const hit = hitChapterHotspot(m, n.sceneX, n.sceneY);
      assert.equal(hit.node, n.id);
    }
    f.act({ path: [t.source, t.destination] });
    assert.equal(f.view().me.progress[7].step, site);
    const path = solveRoute(t);
    assert(path);
    f.act({ path });
    const after = f.view();
    const model = capture(after, {
      held: { ...held(before, after, true), route: path },
    }).model;
    assert.deepEqual(model.route, path);
    assert.equal(model.ownRepair, true);
    assert.equal(after.me.inventory.cable, 2 - site);
    assert.equal(after.me.progress[7].step, site + 1);
  }
});

test("all six scenes have stable solo/100 crowd, no automatic names and no modal/phase mutation", () => {
  for (let chapter = 2; chapter <= 7; chapter++) {
    const f = fixture(chapter),
      v = f.view();
    v.me.position = { x: 600, y: 380 };
    v.players = Array.from({ length: 100 }, (_, i) => ({
      id: "p" + i,
      name: "PRIVATE NAME " + i,
      setup: true,
      connected: true,
      position: { x: 600, y: 380 },
      emote: { text: "SECRET EMOTE" },
    }));
    const original = structuredClone(v),
      a = capture(v),
      b = capture(
        { ...v, players: v.players.slice().reverse() },
        { focusedPeerId: "p1" },
      );
    assert.equal(a.model.teammates.length, 3);
    assert.deepEqual(
      a.model.teammates.map((p) => p.id),
      b.model.teammates.map((p) => p.id),
    );
    assert(
      !b.marks.some((x) => /PRIVATE NAME|SECRET EMOTE/.test(x.value || "")),
    );
    assert.deepEqual(v, original);
    assert.equal(
      capture({ ...v, players: [v.players[0]] }).model.teammates.length,
      0,
    );
    const paused = {
      ...v,
      event: { ...v.event, phase: "paused", pausedPhase: "chapter" },
    };
    assert.equal(chapterSceneModel(paused).hotspots.length, 0);
    assert.equal(chapterSceneModel(v, { pending: true }).hotspots.length, 0);
    assert.equal(
      chapterSceneModel(v, { presentation: true }).hotspots.length,
      0,
    );
    assert.equal(chapterSceneModel(v, { presentation: true }).player, null);
    for (const p of a.model.teammates) {
      const bounds = { x: p.x - 24, y: p.y - 48, width: 48, height: 88 };
      for (const card of G.choices) assert(!overlap(bounds, card));
    }
  }
});

test("network preview cannot light home windows; only accepted route steps survive continuation and reload", () => {
  const f = fixture(7),
    before = f.view(),
    path = solveRoute(before.chapter.task),
    initial = capture(before, { route: path });
  const windowColors = (paint) =>
    paint.model.nodes
      .filter((n) => n.id.startsWith("home"))
      .map((n) =>
        paint.marks
          .filter(
            (r) =>
              r.type === "rect" &&
              r.width === 12 &&
              r.height === 12 &&
              r.y === n.sceneY - 16 &&
              (r.x === n.sceneX - 24 || r.x === n.sceneX + 12),
          )
          .map((r) => r.color),
      );
  assert.deepEqual(
    windowColors(initial),
    Array.from({ length: 3 }, () => ["#465c57", "#465c57"]),
  );
  f.act({ path });
  const accepted = capture(f.view(), { route: [] });
  assert.deepEqual(windowColors(accepted), [
    ["#d29a55", "#d29a55"],
    ["#465c57", "#465c57"],
    ["#465c57", "#465c57"],
  ]);
  for (let i = 1; i < 3; i++)
    f.act({ path: solveRoute(f.view().chapter.task) });
  const reloaded = capture(f.view());
  assert.equal(reloaded.model.step, 3);
  assert.equal(reloaded.model.completed, true);
  assert.equal(
    reloaded.marks.filter(
      (r) =>
        r.type === "rect" &&
        r.width === 32 &&
        r.height === 36 &&
        r.color === "#d29a55",
    ).length,
    6,
    "Completed graph shows three accepted endpoint homes",
  );
});

test("archive art preserves the actual fifteen award records and800 completions without inventing a finale outcome", () => {
  const record = JSON.parse(
    readFileSync(
      new URL(
        "../test-results/capacity-current-f7ea6a8.export.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(record.awards.length, 15);
  const before = JSON.stringify(record.awards);
  const contributions = Array.from(
    { length: 8 },
    (_, c) => record.players.filter((p) => p.progress[c].complete).length,
  );
  for (const phase of ["awards", "closed"]) {
    const view = {
      event: {
        phase,
        chapter: 7,
        archive: { source: "f7ea6a8", finaleRecorded: false },
        awards: record.awards,
        contributions,
        restoration: { perDistrict: 100 },
      },
      players: [],
      chapter: { title: "Archived chapter awards" },
    };
    const { model, marks } = capture(view, { presentation: true });
    assert.equal(model.archive.finaleRecorded, false);
    assert.equal(model.awardCount, 15);
    assert.equal(model.completedObjectives, 800);
    assert.equal(model.player, null);
    assert.equal(model.hotspots.length, 0);
    assert.deepEqual(model.teammates, []);
    assert.equal(model.ending, "");
    const labels = marks.filter((m) => m.type === "text").map((m) => m.value);
    assert(labels.includes("15 RECORDED AWARDS"));
    assert(labels.includes("FINALE OUTCOME NOT RETAINED"));
    assert(labels.includes("800 recorded chapter completions"));
    assert(
      !labels.some((t) =>
        /YOUR HOME IS RESTORED|0 NEIGHBOR REPAIRS|ONE LAST REPAIR/.test(t),
      ),
    );
    assert.equal(JSON.stringify(view.event.awards), before);
  }
  const live = fixture(7);
  live.host("endScoring");
  const view = live.view();
  view.event.archive = { source: "unrelated", finaleRecorded: false };
  assert.equal(
    chapterSceneModel(view).archive,
    null,
    "Metadata must not suppress an actual playable finale",
  );
  assert.equal(chapterSceneModel(view).hotspots[0].action, "objective");
});

test('public presentation distinguishes zero/partial/full shared restoration without borrowing personal progress or issuing commands',()=>{
 for(let chapter=2;chapter<8;chapter++){
 const paints=[];
 for(const completed of [0,3,100]){const view={event:{phase:'chapter',chapter,restoration:{perDistrict:100},contributions:Array.from({length:8},(_,i)=>i===chapter?completed:0)},chapter:{index:chapter,title:CHAPTERS[chapter].title},players:[]};
 const before=JSON.stringify(view),paint=capture(view,{presentation:true,safe:false}),m=paint.model;
 assert.equal(m.ownRepair,false);assert.equal(m.displayRepair,completed===100);assert.equal(m.districtRestored,completed===100);assert.equal(m.player,null);assert.equal(m.safe,true);assert.equal(m.hotspots.length,0);assert.equal(m.personalScore,0);assert.equal(m.step,0);assert.deepEqual(m.cycles,[]);assert.equal(m.rewards,null);assert.deepEqual(m.choices,[]);assert.equal(JSON.stringify(view),before);
 const words=paint.marks.filter(x=>x.type==='text').map(x=>x.value).join(' ');assert(!/\b(Visit|Choose|Select|Continue|CHECK BEFORE ACTING|YOUR HOME IS RESTORED|0 REWARD TOKENS|CYCLE 0|FUNDS 0|KEPT 0)\b/i.test(words),`Public chapter${chapter+1} must describe, not instruct: ${words}`);
 paints.push(paint.marks.filter(x=>x.type==='rect'&&x.x>=300&&x.x+x.width<=1180&&x.y>=280&&x.y+x.height<=580));}
 assert.notDeepEqual(paints[2],paints[0],`Chapter${chapter+1} foreground must visibly reflect the completed district`);
 }
 for(const perDistrict of [undefined,0,-1,NaN]){const m=chapterSceneModel({event:{phase:'chapter',chapter:2,contributions:[0,0,100],restoration:{perDistrict}},chapter:{title:'Identity'},players:[]},{presentation:true});assert.equal(m.displayRepair,false,'Unknown denominator cannot fabricate full restoration');}
});
