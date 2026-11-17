import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./client-simulation-fixture.mjs";
import { CHAPTERS, RULES } from "../content.mjs";
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function confirm(f, choice) {
  f.context.showActivity("activity");
  f.choose(choice);
  const pending = f.confirm().onclick();
  f.resolve();
  await pending;
}
function continueReport(f) {
  f.ids.get("#receipt-next")?.children[0]?.onclick();
}
function replaceWithHelp(f) {
  f.context.panel = "help";
  f.context.open("Help", '<p id="fresh-help">Fresh help</p>');
  f.ids.get("#fresh-help").focus();
  return f.document.activeElement;
}

test("all16 learning answers wrong-first→correct practice preserve zero credit and completing feedback", async () => {
  for (let c = 0; c < 8; c++)
    for (let q = 0; q < 2; q++) {
      const f = fixture(c),
        answer = CHAPTERS[c].questions[q].answer;
      for (const choice of [
        (answer + 1) % CHAPTERS[c].questions[q].options.length,
        answer,
      ]) {
        f.context.quiz(q);
        f.choose(choice);
        const pending = f.ids.get("#quiz-confirm").children[0].onclick();
        f.resolve();
        await pending;
      }
      assert.equal(f.context.state.me.progress[c].score, 0);
      assert.match(f.body.innerHTML, /Correct practice answer/);
      assert.equal(f.ids.has("#quiz-confirm"), false);
    }
});

test("quiz,secret,mystery,trade callbacks cannot replace a newer dialog and submit once while pending", async () => {
  for (const type of ["quiz", "secret", "mystery", "trade"]) {
    const f = fixture();
    f.engine.addPlayer("peer", "Peer");
    f.engine.get("peer").setup = true;
    f.send();
    let submit;
    if (type === "quiz") {
      f.context.quiz(0);
      f.choose(0);
      submit = f.ids.get("#quiz-confirm").children[0].onclick;
    }
    if (type === "secret") {
      f.context.showActivity("secret");
      submit = f.ids.get("#secret-action").children[0].onclick;
    }
    if (type === "mystery") {
      f.context.mystery();
      f.ids.get("#mystery-answer").value = "N";
      submit = () =>
        f.ids.get("#mystery-form").onsubmit({ preventDefault() {} });
    }
    if (type === "trade") {
      f.context.trade(f.engine.get("peer"));
      f.ids.get("#give-item").value = "parts";
      f.ids.get("#give-qty").value = "1";
      f.ids.get("#receive-item").value = "food";
      f.ids.get("#receive-qty").value = "1";
      submit = () => f.ids.get("#trade-form").onsubmit({ preventDefault() {} });
    }
    const pending = submit();
    await submit();
    assert.equal(f.requests.length, 1, type);
    const focus = replaceWithHelp(f);
    f.resolve();
    await pending;
    assert.equal(f.context.panel, "help", type);
    assert.equal(f.document.activeElement, focus, type);
    assert.equal(f.modal.open, true, type);
  }
});

test("all8 actual secret controls collect once; pointer mystery rejects incomplete/wrong then saves all8", async () => {
  const f = fixture();
  f.context.mystery();
  f.ids.get("#mystery-answer").value = "N";
  let p = f.ids.get("#mystery-form").onsubmit({ preventDefault() {} });
  f.resolve();
  await p;
  assert.match(f.ids.get("#dialog-feedback").textContent, /eight clues/);
  for (let chapter = 0; chapter < 8; chapter++) {
    f.engine.state.chapter = chapter;
    f.send();
    for (let repeat = 0; repeat < 2; repeat++) {
      f.context.showActivity("secret");
      p = f.ids.get("#secret-action").children[0].onclick();
      f.resolve();
      await p;
      assert.equal(f.modal.open, false);
      assert.ok(f.ids.get("#toast").textContent.length);
    }
    assert.equal(f.context.state.me.clues.length, chapter + 1);
    assert.equal(f.context.state.me.progress[chapter].score, 0);
  }
  f.context.mystery();
  const letters = f.ids.get("#mystery-letters").children;
  for (let i = 0; i < 8; i++) letters[0].onclick();
  p = f.ids.get("#mystery-form").onsubmit({ preventDefault() {} });
  f.resolve();
  await p;
  assert.equal(f.ids.get("#mystery-answer").value, "NNNNNNNN");
  assert.match(f.ids.get("#dialog-feedback").textContent, /does not fit/);
  f.ids.get("#mystery-edit").children[0].onclick();
  assert.equal(f.ids.get("#mystery-answer").value, "NNNNNNN");
  f.ids.get("#mystery-edit").children[1].onclick();
  assert.equal(f.ids.get("#mystery-answer").value, "");
  letters.forEach((b) => b.onclick());
  p = f.ids.get("#mystery-form").onsubmit({ preventDefault() {} });
  f.resolve();
  await p;
  assert.equal(f.context.state.me.mystery, true);
  assert.equal(f.modal.open, false);
  f.send();
  assert.equal(f.context.state.me.clues.length, 8);
});

for (const chapter of [1, 2, 3, 6])
  test(`chapter${chapter + 1}: actual six inspected sites, wrong retry, all correct decisions and optional challenge`, async () => {
    const f = fixture(chapter);
    for (let step = 0; step < 6; step++) {
      await confirm(f, 0);
      assert.match(f.body.innerHTML, /YOUR INSPECTION/);
      if (step === 0) {
        await confirm(f, (CHAPTERS[chapter].tasks[step].answer + 1) % 3);
        assert.equal(f.context.state.me.progress[chapter].step, 0);
        continueReport(f);
      }
      await confirm(f, CHAPTERS[chapter].tasks[step].answer);
      continueReport(f);
    }
    if (chapter === 6) {
      assert.equal(f.context.state.chapter.rewardShop.balance, 12);
      await confirm(f, 0);
      continueReport(f);
    }
    assert.equal(f.context.state.me.progress[chapter].complete, true);
    assert.equal(f.context.state.me.progress[chapter].score, 60);
    f.context.showActivity("challenge");
    f.choose((CHAPTERS[chapter].challenge.answer + 1) % 3);
    let p = f.confirm().onclick();
    f.resolve();
    await p;
    continueReport(f);
    f.context.showActivity("challenge");
    f.choose(CHAPTERS[chapter].challenge.answer);
    p = f.confirm().onclick();
    f.resolve();
    await p;
    assert.equal(f.context.state.me.progress[chapter].challenge, true);
  });
test("budget controls disable early cycles, keep pending lock, then record all three on-time payments", async () => {
  const f = fixture(5);
  for (let step = 0; step < 3; step++) {
    f.context.showActivity("activity");
    f.interval();
    const task = f.context.state.chapter.task;
    if (f.now() < task.opensAt) {
      assert.equal(f.confirm().disabled, true);
      assert.match(f.ids.get("#budget-clock").textContent, /opens in/);
      f.time(task.opensAt);
      f.interval();
    }
    assert.equal(f.confirm().disabled, false);
    f.choose(0);
    const p = f.confirm().onclick();
    f.interval();
    assert.equal(f.confirm().disabled, true);
    f.resolve();
    await p;
    continueReport(f);
  }
  assert.equal(f.context.state.me.progress[5].step, 3);
  assert.equal(f.context.state.me.progress[5].score, 60);
  assert.equal(f.context.state.me.progress[5].budget, 110);
});

for (const mode of ["manual", "selected-auto"])
  test(`targeting ${mode}: all18 deliberate hits over3 sites; no early, repeat, unselected or paused action`, async () => {
    const f = fixture(4);
    for (let hit = 0; hit < 18; hit++) {
      let task = f.context.state.chapter.task;
      if (hit) f.time(task.nextRoundAt);
      task = f.context.state.chapter.task;
      f.context.showActivity("activity");
      f.interval();
      assert.equal(f.ids.get("#target-confirm").children[0].disabled, true);
      let p = f.context.resolveTarget();
      await p;
      const count = f.requests.length;
      assert.equal(count, hit);
      f.context.autoTargetEnabled = mode === "selected-auto";
      // Choosing nothing never auto-resolves a target.
      f.time(task.actionAllowedAt);
      f.interval();
      assert.equal(f.requests.length, count);
      if (hit === 0) {
        f.engine.host("operator", {
          type: "pause",
          reason: "Target pause regression",
          requestId: "pause",
        });
        f.send();
        f.interval();
        await f.context.resolveTarget();
        assert.equal(f.requests.length, count);
        f.engine.host("operator", {
          type: "resume",
          reason: "Target resume regression",
          requestId: "resume",
        });
        f.send();
        f.context.showActivity("activity");
        f.interval();
      }
      task = f.context.state.chapter.task;
      const marked = task.targets.findIndex((t) => t.marked);
      f.ids.get("#targets").children[marked].onclick();
      if (f.context.autoTargetEnabled) {
        f.interval();
        p = null;
      } else p = f.context.resolveTarget();
      assert.equal(f.requests.length, count + 1);
      f.interval();
      await f.context.resolveTarget();
      assert.equal(f.requests.length, count + 1);
      f.resolve();
      if (p) await p;
      else await flush();
      assert.equal(f.context.state.me.progress[4].primary, hit + 1);
      if ((hit + 1) % 6 === 0) continueReport(f);
    }
    assert.equal(f.context.state.me.progress[4].complete, true);
    assert.equal(f.context.state.me.progress[4].score, 60);
  });

test("routing actual node controls preserve selected focus, reject broken path, reset and finish three constrained homes", async () => {
  const f = fixture(7);
  const paths = [
    ["north", "relay-west", "bypass", "home-a"],
    ["south", "relay-east", "hub", "home-b"],
    ["south", "north", "relay-west", "hub", "home-c"],
  ];
  f.context.showActivity("activity");
  f.ids
    .get("#route-nodes")
    .children.find((b) => b.dataset.nodeId === "home-a")
    .onclick();
  assert.match(f.ids.get("#route-path").textContent, /missing or broken/);
  let p = f.ids.get("#route-actions").children[0].onclick();
  f.resolve();
  await p;
  assert.equal(f.context.state.me.progress[7].step, 0);
  continueReport(f);
  for (const path of paths) {
    f.context.showActivity("activity");
    const reset = f.ids.get("#route-actions").children[1];
    f.ids.get("#route-nodes").children[1].onclick();
    reset.onclick();
    assert.deepEqual([...f.context.routePath], ["exchange"]);
    for (const id of path) {
      f.ids
        .get("#route-nodes")
        .children.find((b) => b.dataset.nodeId === id)
        .onclick();
      assert.equal(f.document.activeElement.dataset.nodeId, id);
    }
    p = f.ids.get("#route-actions").children[0].onclick();
    const before = f.requests.length;
    await f.ids.get("#route-actions").children[0].onclick();
    assert.equal(f.requests.length, before);
    f.resolve();
    await p;
    continueReport(f);
  }
  assert.equal(f.context.state.me.progress[7].score, 60);
  assert.equal(f.context.state.me.progress[7].complete, true);
});

test("Rewards shop uses earned tokens only once per project, blocks unaffordable purchases and adds no score", async () => {
  const f = fixture(6);
  for (let step = 0; step < 6; step++) {
    await confirm(f, 0);
    await confirm(f, CHAPTERS[6].tasks[step].answer);
    continueReport(f);
  }
  await confirm(f, 0);
  continueReport(f);
  f.context.rewardsShop();
  let buttons = f.ids.get("#reward-projects").children;
  assert.equal(buttons[0].disabled, true);
  assert.equal(buttons[2].disabled, true);
  assert.equal(buttons[1].disabled, false);
  const p = buttons[1].onclick();
  await buttons[1].onclick();
  assert.equal(f.requests.at(-1).action.type, "rewardRedeem");
  f.resolve();
  await p;
  continueReport(f);
  f.context.rewardsShop();
  buttons = f.ids.get("#reward-projects").children;
  assert(buttons.every((b) => b.disabled));
  assert.equal(f.context.state.chapter.rewardShop.balance, 0);
  assert.deepEqual(
    [...f.context.state.chapter.rewardShop.uses],
    ["garden", "welcome"],
  );
  assert.equal(f.context.state.me.progress[6].score, 60);
});
test("all8 optional challenge controls enforce main completion, preserve wrong retry and save exactly one bonus", async () => {
  for (let chapter = 0; chapter < 8; chapter++) {
    const f = fixture(chapter),
      q = CHAPTERS[chapter].challenge;
    f.context.showActivity("challenge");
    f.choose(q.answer);
    let p = f.confirm().onclick();
    f.resolve();
    await p;
    assert.match(
      f.ids.get("#dialog-feedback").textContent,
      /main objective first/,
    );
    // Explicit fixture precondition isolates the optional control; main loops are covered separately.
    const progress = f.engine.get("neighbor").progress[chapter];
    progress.complete = true;
    progress.step = f.engine.taskCount(chapter);
    f.send();
    f.context.showActivity("challenge");
    f.choose((q.answer + 1) % q.options.length);
    p = f.confirm().onclick();
    f.resolve();
    await p;
    assert.equal(f.context.state.me.progress[chapter].challenge, false);
    continueReport(f);
    f.context.showActivity("challenge");
    f.choose(q.answer);
    p = f.confirm().onclick();
    f.resolve();
    await p;
    assert.equal(f.context.state.me.progress[chapter].challenge, true);
    const score = f.context.state.me.progress[chapter].score;
    f.context.showActivity("challenge");
    f.choose(q.answer);
    p = f.confirm().onclick();
    f.resolve();
    await p;
    assert.equal(f.context.state.me.progress[chapter].score, score);
    assert.match(f.ids.get("#dialog-feedback").textContent, /already complete/);
  }
});

test("trade UI uses two confirmations, refreshes live inventory, and cancellation prevents exchange", async () => {
  const f = fixture(1);
  f.engine.addPlayer("peer", "Peer");
  f.engine.get("peer").setup = true;
  f.send();
  const offer = async () => {
    f.context.trade(f.engine.get("peer"));
    f.ids.get("#give-item").value = "parts";
    f.ids.get("#give-qty").value = "1";
    f.ids.get("#receive-item").value = "food";
    f.ids.get("#receive-qty").value = "1";
    const p = f.ids.get("#trade-form").onsubmit({ preventDefault() {} });
    f.resolve();
    await p;
    return f.context.state.trades[0];
  };
  let t = await offer();
  const initial = { ...f.context.state.me.inventory };
  let buttons = f.ids.get("#trade-list").querySelectorAll("button");
  let p = buttons
    .find((b) => b.dataset.focusKey.endsWith(":confirm"))
    .onclick();
  f.resolve();
  await p;
  assert.deepEqual(f.context.state.me.inventory, initial);
  f.context.inventory();
  f.peer("peer", "tradeConfirm", { tradeId: t.id });
  assert.equal(f.context.state.me.inventory.parts, initial.parts - 1);
  assert.equal(f.context.state.me.inventory.food, initial.food + 1);
  assert.match(f.body.innerHTML, /2 units/);
  assert.match(f.body.innerHTML, /4 units/);
  const traded = { ...f.context.state.me.inventory };
  t = await offer();
  buttons = f.ids.get("#trade-list").querySelectorAll("button");
  p = buttons.find((b) => b.dataset.focusKey.endsWith(":cancel")).onclick();
  f.resolve();
  await p;
  assert.equal(f.context.state.trades.length, 0);
  assert.deepEqual(f.context.state.me.inventory, traded);
});

test("help/emote/assist UI registers the intended peer and only completed recipient task grants bonus", async () => {
  const f = fixture(1);
  f.engine.addPlayer("peer", "Peer");
  f.engine.get("peer").setup = true;
  f.engine.get("peer").position = { ...f.context.state.chapter.task.target };
  f.send();
  f.context.neighbors();
  let p = f.ids.get("#emotes").children[0].onclick();
  f.resolve();
  await p;
  assert.equal(f.engine.get("neighbor").emote.index, 0);
  p = f.ids.get("#help-requests").children[0].onclick();
  f.resolve();
  await p;
  assert.equal(f.engine.get("neighbor").help, 0);
  f.peer("peer", "help", { preset: 0 });
  f.context.neighbors();
  p = f.ids
    .get("#neighbor-list")
    .querySelectorAll("button")
    .find((b) => b.dataset.focusKey === "neighbor:peer:assist")
    .onclick();
  f.resolve();
  await p;
  assert.equal(f.context.state.me.progress[1].score, 0);
  // Recipient uses legitimate engine actions; this assertion exercises the helper's live receiving projection.
  for (let step = 0; step < 6; step++)
    for (const stage of ["inspect", "decide"]) {
      const task = f.engine.view("peer").chapter.task;
      f.engine.get("peer").position = { ...task.target };
      f.time(f.now() + 3100);
      f.peer("peer", "task", {
        choice: stage === "inspect" ? 0 : CHAPTERS[1].tasks[step].answer,
        expectedStep: step,
        expectedStage: stage,
      });
    }
  assert.equal(f.context.state.me.progress[1].score, RULES.assistPoints);
});
test("practice callbacks cannot close a newly opened dialog; failed help does not mark tutorial complete", async () => {
  for (const step of ["interact", "collect", "answer", "help"]) {
    const f = fixture(0, (engine) => {
      engine.state.phase = "lobby";
      engine.state.deadline = null;
    });
    const player = f.engine.get("neighbor");
    player.position = { x: 600, y: 380 };
    player.practice.interacted = true;
    f.body.innerHTML =
      '<div id="tutorial-actions"></div><div id="ready-action"></div>';
    f.context.renderTutorial();
    f.ids
      .get("#tutorial-actions")
      .children[
        ["move", "interact", "collect", "answer", "help"].indexOf(step)
      ].onclick();
    const submit =
      step === "answer"
        ? f.ids.get("#practice-answers").children[0].onclick
        : f.ids.get("#practice-action").children[0].onclick;
    const p = submit();
    await submit();
    assert.equal(f.requests.length, 1);
    const focus = replaceWithHelp(f);
    f.resolve();
    await p;
    assert.equal(f.context.panel, "help");
    assert.equal(f.modal.open, true);
    assert.equal(f.document.activeElement, focus);
    if (step === "help")
      assert.equal(
        f.requests.length,
        1,
        "closing the practice dialog stops its second request",
      );
  }
});
test("an old request error cannot overwrite a newer Help dialog", async () => {
  const f = fixture();
  f.context.quiz(0);
  f.choose(0);
  const p = f.ids.get("#quiz-confirm").children[0].onclick();
  const focus = replaceWithHelp(f);
  f.requests[0].reject(new Error("Old answer request failed"));
  await p;
  assert.equal(f.context.panel, "help");
  assert.equal(f.document.activeElement, focus);
  assert.equal(f.ids.has("#dialog-feedback"), false);
});
test("actual Settings persists all text sizes, volumes, control preference and eight remapped keys; invalid keys never send", async () => {
  const f = fixture(),
    remap = {
      up: "z",
      left: "x",
      down: "c",
      right: "b",
      interact: "f",
      inventory: "v",
      map: "n",
      help: "j",
    };
  for (const size of [16, 20, 24]) {
    f.context.settings();
    const inputs = f.ids.get("#remap").querySelectorAll("input");
    inputs[0].value = inputs[1].value;
    await f.ids.get("#settings-save").children[0].onclick();
    assert.match(
      f.ids.get("#dialog-feedback").textContent,
      /different, non-empty key/,
    );
    const sentBefore = f.requests.length;
    for (const invalid of ["", " "]) {
      inputs[0].value = invalid;
      await f.ids.get("#settings-save").children[0].onclick();
      assert.match(
        f.ids.get("#dialog-feedback").textContent,
        /different, non-empty key/,
      );
      assert.equal(f.requests.length, sentBefore);
    }
    inputs.forEach((i) => (i.value = remap[i.dataset.action]));
    f.ids.get("#text-size").value = String(size);
    f.ids.get("#controls").value = "pointer";
    f.ids.get("#reduced").checked = true;
    f.ids.get("#music").value = "25";
    f.ids.get("#effects").value = "60";
    f.ids.get("#safe-select").value = "false";
    const p = f.ids.get("#settings-save").children[0].onclick();
    f.resolve();
    await p;
    const saved = f.engine.get("neighbor").settings;
    assert.equal(saved.textSize, size / 16);
    assert.equal(saved.music, 0.25);
    assert.equal(saved.effects, 0.6);
    assert.equal(saved.control, "pointer");
    assert.equal(saved.reducedMotion, true);
    assert.deepEqual(saved.keys, remap);
    assert.equal(f.document.documentElement.style["--base"], size + "px");
    f.send();
    f.context.settings();
    assert.equal(f.ids.get("#text-size").value, size);
    assert.equal(f.ids.get("#music").value, 25);
    assert.equal(f.ids.get("#effects").value, 60);
  }
});
test("recipient sees active preset emotes in Neighbors without focus churn; expiry and replacement clear accurately", () => {
  const f = fixture(1);
  f.engine.addPlayer("peer", "Peer");
  f.engine.get("peer").setup = true;
  f.send();
  f.context.neighbors();
  const button = f.ids.get("#neighbor-list").querySelectorAll("button")[0];
  button.focus();
  const label = () =>
    f.ids
      .get("#neighbor-list")
      .querySelectorAll("span")
      .find((s) => s.dataset.emotePeer === "peer");
  f.peer("peer", "emote", { emote: 0 });
  assert.equal(label().textContent, RULES.emotes[0]);
  assert.equal(f.document.activeElement, button);
  f.peer("peer", "emote", { emote: 2 });
  assert.equal(label().textContent, RULES.emotes[2]);
  assert.equal(f.document.activeElement, button);
  f.time(f.now() + 5001);
  f.interval();
  assert.equal(label().textContent, "");
  assert.equal(f.document.activeElement, button);
});
test("a delayed accepted assist cannot put feedback in a newly opened Help dialog", async () => {
  const f = fixture(1);
  f.engine.addPlayer("peer", "Peer");
  f.engine.get("peer").setup = true;
  f.engine.get("peer").position = { ...f.context.state.chapter.task.target };
  f.peer("peer", "help", { preset: 0 });
  f.context.neighbors();
  const p = f.ids.get("#neighbor-list").querySelectorAll("button")[0].onclick();
  const focus = replaceWithHelp(f);
  f.resolve();
  await p;
  assert.equal(f.context.panel, "help");
  assert.equal(f.document.activeElement, focus);
  assert.equal(f.ids.has("#dialog-feedback"), false);
});
