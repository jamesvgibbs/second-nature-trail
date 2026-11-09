import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../engine.mjs";
import { CHAPTERS, SPATIAL_CHAPTERS } from "../content.mjs";
function fixture(n = 2) {
  let time = 1000000,
    i = 0;
  const e = new Engine({ now: () => time });
  const act = (id, type, extra = {}) =>
    e.dispatch(id, {
      type,
      requestId: `r${i++}`,
      expectedChapter: e.state.chapter,
      ...(type === "task"
        ? {
            expectedStep: e.get(id).progress[e.state.chapter].step,
            expectedStage: e.chapterView(e.get(id)).task?.stage || null,
            expectedRound:
              e.state.chapter === 4
                ? e.view(id).chapter.task?.round
                : undefined,
          }
        : {}),
      ...extra,
    });
  const host = (type, extra = {}) =>
    e.host("operator", {
      type,
      reason: "test",
      requestId: `h${i++}`,
      ...extra,
    });
  for (let j = 0; j < n; j++) {
    e.addPlayer(`p${j}`, `Player ${j}`);
    act(`p${j}`, "setup", { character: 0, palette: 0, insects: false });
  }
  host("lobby");
  host("start");
  time += 10000;
  e.tick();
  return {
    e,
    act,
    host,
    advance: (n) => {
      time += n;
      e.tick();
    },
  };
}
function locate(e, id, pos) {
  e.state.players[id].position = { ...pos };
}
function delivery(f, id = "p0", route = 0) {
  for (let k = 0; k < 3; k++)
    for (let j = 0; j < 4; j++) {
      const t = f.e.view(id).chapter.task;
      locate(f.e, id, t.target);
      f.act(id, "task", {
        choice:
          t.stage === "load"
            ? f.e.view(id).me.inventory.cable + f.e.view(id).me.reserve.cable >=
              2
              ? 2
              : 0
            : t.stage === "route"
              ? route
              : 0,
      });
    }
}
test("event runs exactly 60 minutes through chapters, breaks and finale", () => {
  const f = fixture();
  f.advance(3590000);
  assert.equal(f.e.state.phase, "awards");
  assert.equal(f.e.state.chapter, 7);
  assert(f.e.state.snapshot);
  assert.equal(f.e.state.awards.length, 15);
});
test("delivery requires physical route checkpoint and changes metric by damage", () => {
  const f = fixture();
  assert.throws(() => f.act("p0", "task", { choice: 2 }), /closer/);
  delivery(f);
  delivery(f, "p1", 1);
  assert.equal(f.e.get("p0").progress[0].primary, 36);
  assert.equal(f.e.get("p1").progress[0].primary, 24);
  f.advance(290000);
  assert.equal(f.e.state.awards[0].playerId, "p0");
});
test("same request is idempotent and changed payload fails", () => {
  const f = fixture();
  const a = {
    type: "quiz",
    index: 0,
    choice: 0,
    expectedChapter: 0,
    requestId: "stable",
  };
  f.e.dispatch("p0", a);
  f.e.dispatch("p0", a);
  assert.equal(f.e.get("p0").progress[0].score, 10);
  assert.throws(() => f.e.dispatch("p0", { ...a, choice: 1 }), /reused/);
});
test("quiz first answer immutable and projections contain no keys/explanations", () => {
  const f = fixture();
  const before = JSON.stringify(f.e.view("p0"));
  assert(!before.includes('"answer":'));
  assert(!before.includes("Planning essential services reduces"));
  f.act("p0", "quiz", { index: 0, choice: 1 });
  f.act("p0", "quiz", { index: 0, choice: 0 });
  assert.equal(f.e.get("p0").progress[0].quiz[0].correct, false);
  assert.equal(f.e.get("p0").progress[0].score, 0);
});
test("pause freezes actions and preserves remaining schedule", () => {
  const f = fixture();
  f.host("pause");
  const remaining = f.e.state.pause.remainingMs;
  f.advance(30000);
  assert.throws(() => f.act("p0", "move", { x: 1, y: 1 }), /frozen/);
  assert.throws(() => f.act("p0", "quiz", { index: 0, choice: 0 }), /closed/);
  f.host("resume");
  assert.equal(f.e.event().remainingMs, remaining);
});
test("trade requires both confirmations, commits once, preserves total and supplier provenance", () => {
  const f = fixture();
  const total = () =>
    Object.values(f.e.state.players).reduce((n, p) => n + p.items.length, 0);
  const { tradeId } = f.act("p0", "tradeOffer", {
    target: "p1",
    give: { item: "parts", qty: 1 },
    receive: { item: "cable", qty: 1 },
  });
  f.act("p0", "tradeConfirm", { tradeId });
  assert.equal(f.e.view("p0").me.inventory.parts, 3);
  f.act("p1", "tradeConfirm", { tradeId });
  assert.equal(f.e.view("p0").me.inventory.parts, 2);
  assert.equal(total(), 24);
  assert.throws(() => f.act("p1", "tradeConfirm", { tradeId }), /pending/);
  f.e.consume(f.e.get("p1"), "parts");
  f.e.consume(f.e.get("p1"), "parts");
  f.e.consume(f.e.get("p1"), "parts");
  f.e.consume(f.e.get("p1"), "parts");
  assert.deepEqual(f.e.get("p0").traderRecipients, ["p1"]);
});
test("inventory changes and disconnect invalidate uncommitted trades", () => {
  const f = fixture();
  const offer = () =>
    f.act("p0", "tradeOffer", {
      target: "p1",
      give: { item: "parts", qty: 1 },
      receive: { item: "cable", qty: 1 },
    }).tradeId;
  const a = offer();
  f.e.consume(f.e.get("p0"), "parts");
  assert.equal(f.e.state.trades[a].status, "cancelled");
  const b = offer();
  f.e.disconnect("p1");
  assert.equal(f.e.state.trades[b].status, "cancelled");
});
test("snapshot cannot change through finale, projections or exported mutations", () => {
  const f = fixture();
  delivery(f);
  f.host("endScoring");
  const original = JSON.stringify(f.e.exportResults());
  f.act("p0", "finale");
  f.act("p1", "finale");
  const exported = f.e.exportResults();
  exported.players[0].name = "forged";
  assert.equal(JSON.stringify(f.e.exportResults()), original);
  assert.throws(() => f.act("p0", "quiz", { index: 0, choice: 0 }), /closed/);
});
test("skipped chapter unranked and its trade/quiz/secret contributions excluded", () => {
  const f = fixture();
  f.act("p0", "quiz", { index: 0, choice: 0 });
  f.host("skip");
  assert.equal(f.e.metrics(f.e.get("p0")).correct, 0);
  assert.equal(f.e.state.ranked[0], false);
  assert(!f.e.state.awards.some((a) => a.chapter === 0));
});
test("forged values and reserved identities rejected", () => {
  const f = fixture();
  assert.throws(() => f.e.addPlayer("__proto__", "Oops"), /identity/);
  assert.throws(() => f.act("p0", "score", { points: 999 }), /Unknown/);
  assert.throws(
    () =>
      f.act("p0", "tradeOffer", {
        target: "p1",
        give: { item: "parts", qty: -1 },
        receive: { item: "food", qty: 1 },
      }),
    /quantity/,
  );
  assert.throws(
    () => f.act("p0", "setup", { character: 0, palette: 0, insects: null }),
    /Choose whether/,
  );
});
test("restore serialized state preserves accepted progress and request deduplication", () => {
  const f = fixture();
  const a = {
    type: "quiz",
    index: 0,
    choice: 0,
    expectedChapter: 0,
    requestId: "saved",
  };
  f.e.dispatch("p0", a);
  const e = new Engine({
    state: JSON.parse(JSON.stringify(f.e.state)),
    now: f.e.now,
  });
  e.dispatch("p0", a);
  assert.equal(e.get("p0").progress[0].score, 10);
});
test("assists need real unfinished request and credit once after completion", () => {
  const f = fixture();
  assert.throws(() => f.act("p0", "assist", { target: "p1" }), /unfinished/);
  f.act("p1", "help", { preset: 0 });
  f.act("p0", "assist", { target: "p1" });
  assert.equal(f.e.metrics(f.e.get("p0")).assists, 0);
  delivery(f, "p1");
  assert.equal(f.e.metrics(f.e.get("p0")).assists, 1);
  assert.throws(() => f.act("p0", "assist", { target: "p1" }), /unfinished/);
});
test("target rounds accept one deliberate attempt and reject rapid retries", () => {
  const f = fixture();
  f.advance(4 * 420000 - 10000);
  assert.equal(f.e.state.chapter, 4);
  locate(f.e, "p0", CHAPTERS[4].locations[0]);
  for (let n = 0; n < 3; n++) {
    const t = f.e.view("p0").chapter.task;
    const choice = t.targets.find((x) => x.marked).id;
    f.act("p0", "task", { choice });
    if (n < 2) {
      assert.throws(() => f.act("p0", "task", { choice }), /round/);
      f.advance(9000);
    }
  }
  assert.equal(f.e.get("p0").progress[4].primary, 3);
  assert.equal(f.e.get("p0").progress[4].complete, true);
});
test("routing rejects blocked connections and loops then completes valid graph paths", () => {
  const f = fixture();
  f.advance(7 * 420000 - 10000);
  locate(f.e, "p0", CHAPTERS[7].locations[0]);
  const bad = f.act("p0", "task", { path: ["exchange", "relay-n", "home-a"] });
  assert.equal(bad.correct, false);
  assert.throws(
    () =>
      f.act("p0", "task", {
        path: ["exchange", "relay-n", "exchange", "home-a"],
      }),
    /loop/,
  );
  for (const path of [
    ["exchange", "relay-s", "hub", "home-a"],
    ["exchange", "relay-s", "hub", "home-b"],
    ["exchange", "relay-n", "hub", "home-c"],
  ])
    assert(f.act("p0", "task", { path }).correct);
  assert(f.e.get("p0").progress[7].complete);
});
test("budget model carries actual retained budget and excludes optional overspend", () => {
  const f = fixture();
  f.advance(5 * 420000 - 10000);
  locate(f.e, "p0", CHAPTERS[5].locations[0]);
  for (let n = 0; n < 3; n++) {
    f.act("p0", "task", { choice: 0 });
    if (n < 2) f.advance(45000);
  }
  const r = f.e.get("p0").progress[5];
  assert.equal(r.primary, 3);
  assert.equal(r.budget, 110);
  assert.equal(
    r.cycles.reduce((n, x) => n + x.income - x.payment - x.expense, 0),
    110,
  );
  assert.equal(f.e.get("p0").items.filter((x) => x.kind === "food").length, 0);
});
test("tutorial acknowledgments cannot manufacture actual practice actions", () => {
  const f = fixture();
  assert.throws(() => f.act("p0", "tutorial", { step: "move" }), /Move/);
  assert.throws(() => f.act("p0", "tutorial", { step: "collect" }), /Interact/);
  assert.throws(
    () => f.act("p0", "tutorial", { step: "answer", choice: 0 }),
    /Collect/,
  );
  assert.throws(() => f.act("p0", "tutorial", { step: "help" }), /Send/);
  assert.throws(() => f.act("p0", "ready"), /tutorial/);
});
test("movement does not grow durable scoring deduplication ledger", () => {
  const f = fixture();
  const before = Object.keys(f.e.state.requests).length;
  f.advance(1000);
  f.act("p0", "move", { x: 700, y: 380 });
  assert.equal(Object.keys(f.e.state.requests).length, before);
});
test("recorded complete run allocates fifteen distinct qualifying recipients", () => {
  const f = fixture(24);
  for (let c = 0; c < 8; c++) {
    assert.equal(f.e.state.chapter, c);
    for (let n = 0; n < 24; n++) {
      const id = `p${n}`;
      f.act(id, "help", { preset: 0 });
      locate(f.e, id, CHAPTERS[c].locations[0]);
    }
    for (let n = 0; n < 24; n++)
      f.act(`p${n}`, "assist", { target: `p${(n + 1) % 24}` });
    if (c === 0) {
      for (let n = 0; n < 24; n += 2) {
        const { tradeId } = f.act(`p${n}`, "tradeOffer", {
          target: `p${n + 1}`,
          give: { item: "cable", qty: 1 },
          receive: { item: "parts", qty: 1 },
        });
        f.act(`p${n}`, "tradeConfirm", { tradeId });
        f.act(`p${n + 1}`, "tradeConfirm", { tradeId });
      }
    }
    for (let step = 0; step < CHAPTERS[c].tasks.length; step++) {
      for (let n = 0; n < 24; n++) {
        const id = `p${n}`;
        if (c === 0) {
          if (step === 0) delivery(f, id);
        } else if (c === 4) {
          const task = f.e.view(id).chapter.task;
          f.act(id, "task", { choice: task.targets.find((x) => x.marked).id });
        } else if (c === 7) {
          f.act(id, "task", {
            path: [
              ["exchange", "relay-s", "hub", "home-a"],
              ["exchange", "relay-s", "hub", "home-b"],
              ["exchange", "relay-n", "hub", "home-c"],
            ][step],
          });
        } else if (SPATIAL_CHAPTERS.includes(c)) {
          locate(f.e, id, f.e.view(id).chapter.task.target);
          f.act(id, "task", { choice: 0 });
          f.act(id, "task", { choice: CHAPTERS[c].tasks[step].answer });
        } else
          f.act(id, "task", {
            choice: c === 5 ? 0 : CHAPTERS[c].tasks[step].answer,
          });
      }
      f.advance(c === 4 ? 9000 : c === 5 ? 45000 : 3000);
    }
    for (let n = 0; n < 24; n++) {
      const id = `p${n}`;
      for (let index = 0; index < 2; index++)
        f.act(id, "quiz", {
          index,
          choice: CHAPTERS[c].questions[index].answer,
        });
      locate(f.e, id, CHAPTERS[c].locations[1]);
      f.act(id, "secret");
      f.act(id, "challenge", { choice: CHAPTERS[c].challenge.answer });
      if (c === 7) f.act(id, "mystery", { answer: "NEIGHBOR" });
    }
    f.advance(f.e.event().remainingMs);
    assert.equal(f.e.state.phase, "brag");
    f.advance(120000);
  }
  const snapshot = f.e.exportResults();
  assert.equal(snapshot.awards.length, 15);
  assert(snapshot.awards.every((a) => a.playerId));
  assert.equal(new Set(snapshot.awards.map((a) => a.playerId)).size, 15);
  assert(snapshot.actions.some((a) => a.type === "qualifyingTrade"));
  assert(snapshot.actions.some((a) => a.type === "assistCompleted"));
  assert(snapshot.players.every((p) => p.progress.every((r) => r.complete)));
  const owners = new Map();
  for (const event of snapshot.actions) {
    if (event.type === "join")
      for (const item of event.allocation) owners.set(item.id, event.playerId);
    if (event.type === "tradeCompleted") {
      for (const itemId of event.give) {
        assert.equal(owners.get(itemId), event.from);
        owners.set(itemId, event.to);
      }
      for (const itemId of event.receive) {
        assert.equal(owners.get(itemId), event.to);
        owners.set(itemId, event.from);
      }
    }
    if (event.type === "consume" && event.source === "inventory") {
      assert.equal(owners.get(event.itemId), event.playerId);
      owners.delete(event.itemId);
    }
  }
  for (const player of snapshot.players)
    assert.deepEqual(
      [...owners]
        .filter(([, owner]) => owner === player.id)
        .map(([id]) => id)
        .sort(),
      player.items.map((item) => item.id).sort(),
    );
});
test("payment cycles use server opening and due times and exclude late payments", () => {
  const f = fixture();
  f.advance(5 * 420000 - 10000);
  locate(f.e, "p0", CHAPTERS[5].locations[0]);
  f.act("p0", "task", { choice: 0 });
  assert.throws(() => f.act("p0", "task", { choice: 0 }), /not opened/);
  f.advance(90000);
  const late = f.act("p0", "task", { choice: 0 });
  assert.equal(late.correct, false);
  assert.equal(f.e.get("p0").progress[5].primary, 1);
});
test("paused targeting projection freezes rounds and resumes same round", () => {
  const f = fixture();
  f.advance(4 * 420000 - 10000);
  const before = f.e.view("p0").chapter.task.round;
  f.host("pause");
  f.advance(60000);
  assert.equal(f.e.view("p0").chapter.task.round, before);
  f.host("resume");
  assert.equal(f.e.view("p0").chapter.task.round, before);
});
test("many assists grant only one bounded chapter bonus", () => {
  const f = fixture(4);
  for (let n = 1; n < 4; n++) {
    locate(f.e, "p0", { x: 600, y: 380 });
    f.act(`p${n}`, "help", { preset: 0 });
    f.act("p0", "assist", { target: `p${n}` });
    delivery(f, `p${n}`);
  }
  assert.equal(f.e.get("p0").progress[0].score, 5);
  assert.equal(f.e.metrics(f.e.get("p0")).assists, 3);
});
test("unclean restart cancels pending barter and preserves completed transfers", () => {
  const f = fixture(3);
  const { tradeId } = f.act("p0", "tradeOffer", {
    target: "p1",
    give: { item: "parts", qty: 1 },
    receive: { item: "cable", qty: 1 },
  });
  f.act("p0", "tradeConfirm", { tradeId });
  f.act("p1", "tradeConfirm", { tradeId });
  const pending = f.act("p0", "tradeOffer", {
    target: "p2",
    give: { item: "parts", qty: 1 },
    receive: { item: "cable", qty: 1 },
  }).tradeId;
  f.act("p0", "tradeConfirm", { tradeId: pending });
  const saved = JSON.parse(JSON.stringify(f.e.state));
  const restored = new Engine({ state: saved, now: f.e.now });
  assert.equal(restored.state.trades[pending].status, "cancelled");
  assert.equal(restored.state.trades[tradeId].status, "complete");
  assert.deepEqual(restored.get("p0").items, f.e.get("p0").items);
  assert.throws(
    () =>
      restored.dispatch("p2", {
        type: "tradeConfirm",
        tradeId: pending,
        expectedChapter: 0,
        requestId: "restart-confirm",
      }),
    /pending/,
  );
});
test("content drift blocks restart even when semantic version is unchanged", () => {
  const f = fixture();
  const saved = structuredClone(f.e.state);
  saved.contentHash = "different-content";
  assert.throws(() => new Engine({ state: saved }), /content hash/);
});
test("delayed chapter, task stage and targeting round actions cannot score current content", () => {
  const f = fixture();
  locate(f.e, "p0", CHAPTERS[0].locations[0]);
  f.act("p0", "task", { choice: 0 });
  assert.throws(
    () => f.act("p0", "task", { choice: 0, expectedStage: "load" }),
    /stage changed/,
  );
  f.advance(420000 - 10000);
  assert.throws(
    () => f.act("p0", "quiz", { index: 0, choice: 0, expectedChapter: 0 }),
    /chapter changed/,
  );
  assert.equal(f.e.get("p0").progress[1].quiz[0], null);
  f.advance(3 * 420000);
  locate(f.e, "p0", CHAPTERS[4].locations[0]);
  assert.throws(
    () => f.act("p0", "task", { choice: 0, expectedRound: -1 }),
    /round changed/,
  );
  assert.equal(f.e.get("p0").progress[4].targetRound, null);
});
test("compact personal action projection matches full authoritative personal fields", () => {
  const f = fixture();
  const patch = f.e.actionView("p0"),
    full = f.e.view("p0");
  for (const key of Object.keys(patch)) assert.deepEqual(patch[key], full[key]);
  assert.equal(patch.players, undefined);
  assert.equal(patch.rules, undefined);
  assert.equal(patch.world, undefined);
});
test("expanded spatial activity requires arrival and inspection before each of six decisions", () => {
  const f = fixture();
  f.advance(420000 - 10000);
  assert.equal(f.e.state.chapter, 1);
  assert.equal(f.e.view("p0").chapter.taskCount, 6);
  assert.equal(f.e.view("p0").chapter.task.evidence, null);
  assert.throws(() => f.act("p0", "task", { choice: 0 }), /closer/);
  for (let step = 0; step < 6; step++) {
    const task = f.e.view("p0").chapter.task;
    assert.equal(task.stage, "inspect");
    locate(f.e, "p0", task.target);
    f.act("p0", "task", { choice: 0 });
    const inspected = f.e.view("p0").chapter.task;
    assert.equal(inspected.stage, "decide");
    assert(inspected.evidence.length > 20);
    f.act("p0", "task", { choice: CHAPTERS[1].tasks[step].answer });
  }
  assert.equal(f.e.get("p0").progress[1].score, 60);
  assert.equal(f.e.get("p0").progress[1].primary, 6);
  assert.equal(f.e.view("p0").chapter.task, null);
  assert.equal(f.e.view("p0").chapter.taskCount, 6);
});
test("a false accusation reduces the clone chapter metric without recording a completion", () => {
  const f = fixture();
  f.advance(2 * 420000 - 10000);
  locate(f.e, "p0", f.e.view("p0").chapter.task.target);
  f.act("p0", "task", { choice: 0 });
  const q = CHAPTERS[2].tasks[0];
  f.act("p0", "task", { choice: (q.answer + 1) % 3 });
  const r = f.e.get("p0").progress[2];
  assert.equal(r.primary, -1);
  assert.equal(r.step, 0);
  assert.equal(r.mistakes, 1);
  f.act("p0", "task", { choice: q.answer });
  assert.equal(r.primary, 0);
  assert.equal(r.step, 1);
});
