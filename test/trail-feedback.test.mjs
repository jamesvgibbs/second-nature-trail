import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../engine.mjs';
import { deliveryModel, deliveryReceipt, actionReceipt } from '../public/trail-feedback.mjs';
import { CHAPTERS } from '../content.mjs';

function fixture() {
  let now = 100000, version = 1, sequence = 0;
  const engine = new Engine({ now: () => now });
  engine.addPlayer('tester', 'Test neighbor'); engine.get('tester').setup = true;
  const host = type => engine.host('operator', { type, reason: 'Isolated feedback fixture', requestId: `host-${type}` });
  host('lobby'); host('start'); now = engine.state.deadline; engine.tick();
  const stamp = state => ({ ...state, projectionEpoch: 'fixture-epoch', projectionVersion: version++ });
  const view = () => stamp(engine.view('tester'));
  const step = (choice, concurrent) => {
    const before = view();
    engine.get('tester').position = { ...before.chapter.task.target };
    const action = { type: 'task', requestId: `task-${++sequence}`, choice, expectedChapter: 0, expectedStep: before.me.progress[0].step, expectedStage: before.chapter.task.stage };
    now += 3100;
    const result = engine.dispatch('tester', action);
    concurrent?.(engine);
    const after = stamp(engine.actionView('tester'));
    return { before, after, action, result, receipt: deliveryReceipt(before, after, action, result) };
  };
  return { engine, view, step };
}

test('real public projection supplies every cargo fact without consuming or confusing storage with loaded cargo', () => {
  const f = fixture(), state = f.view(), original = structuredClone(state);
  const m = deliveryModel(state);
  assert.deepEqual(state, original);
  assert.equal(m.storageUsed, 12); assert.equal(m.storageLimit, 12); assert.equal(m.maxSlots, 4);
  assert.equal(m.loaded, null); assert.equal(m.slots, 0);
  assert.deepEqual(m.plans.map(p => [p.safe.value, p.safe.points, p.shortcut.value, p.shortcut.points]), [[10,17,6,10],[11,18,5,8],[12,20,8,13]]);
  assert(m.plans.every(p => p.available && p.slots === 4));
  const packed = f.step(1);
  assert.equal(packed.receipt.title, 'Cart packed');
  const current = deliveryModel(f.view());
  assert.deepEqual(current.loaded, { parts: 1, food: 2 });
  assert.equal(current.storageUsed, 12, 'packing is a plan; delivery consumes supplies');
  assert.equal(current.slots, 4); assert.equal(current.routes[1].damageValue, 6);
  current.loaded.parts = 99; assert.equal(f.engine.get('tester').progress[0].delivery.loaded.parts, 1);
});

test('plan affordability includes finite separate reserves and derives all values from supplied public rules', () => {
  const f = fixture(), state = f.view();
  state.me.inventory.parts = 0; state.me.progress[0].reserve.parts = 1;
  let model = deliveryModel(state);
  assert.equal(model.plans[0].available, false); assert.equal(model.plans[1].available, true);
  state.rules.values.parts = 8; state.rules.deliveryDamage = 3; state.rules.taskPoints = 30;
  model = deliveryModel(state);
  assert.equal(model.plans[0].safe.value, 16); assert.equal(model.plans[0].safe.points, 30);
  assert.equal(model.plans[0].shortcut.value, 10); assert.equal(model.plans[0].shortcut.points, 19);
  assert.equal(deliveryModel({ ...state, rules: undefined }), null);
  assert.equal(deliveryModel({ ...state, event: { chapter: 1 } }), null);
  state.me.inventory.parts = -1; assert.equal(deliveryModel(state), null);
});

for (const plan of [0, 1, 2]) for (const route of [0, 1]) {
  test(`real engine receipts match plan${plan} route${route} across all stages and completion`, () => {
    const f = fixture(); let last;
    for (let trip = 0; trip < 3; trip++) {
      for (const [choice, stage] of [[plan,'load'],[route,'route'],[0,'travel'],[0,'deliver']]) {
        last = f.step(choice); const receipt = last.receipt;
        assert(receipt, stage); assert.equal(receipt.stage, stage); assert.equal(receipt.id, last.action.requestId);
        assert.equal(receipt.deltaStatus, 'consistent'); assert.equal(receipt.completed, trip === 2 && stage === 'deliver');
        assert.equal(receipt.deltas.find(d => d.label === 'Score now').value, last.after.me.progress[0].score);
      }
    }
    assert.match(last.receipt.details.at(-1), /All 3 deliveries are complete/);
    assert.equal(last.after.event.contributions[0], 1);
    assert.equal(deliveryModel(f.view()).complete, true);
  });
}

test('receipt rejects nonaccepted, duplicated, stale, cross-epoch/phase/player/chapter and unexpected stage responses', () => {
  const f = fixture(), accepted = f.step(0);
  const receipt = (change = {}) => deliveryReceipt(change.before || accepted.before, change.after || accepted.after, change.action || accepted.action, change.result || accepted.result);
  assert.equal(receipt({ result: { ok: false, correct: true } }), null);
  assert.equal(receipt({ result: { ok: true, correct: false } }), null);
  for (const type of ['quiz','challenge','move','rewardRedeem']) assert.equal(receipt({ action: { ...accepted.action, type } }), null);
  assert.equal(receipt({ action: { ...accepted.action, requestId: '' } }), null);
  assert.equal(receipt({ action: { ...accepted.action, expectedStep: 1 } }), null);
  assert.equal(receipt({ action: { ...accepted.action, expectedStage: 'deliver' } }), null);
  assert.equal(receipt({ after: { ...accepted.after, projectionEpoch: 'restarted' } }), null);
  assert.equal(receipt({ after: { ...accepted.after, projectionVersion: accepted.before.projectionVersion } }), null);
  assert.equal(receipt({ before: accepted.after }), null, 'duplicate accepted response cannot be applied against already advanced state');
  for (const phase of ['draft','paused','brag','finale']) assert.equal(receipt({ after: { ...accepted.after, event: { ...accepted.after.event, phase } } }), null);
  assert.equal(receipt({ after: { ...accepted.after, event: { ...accepted.after.event, chapter: 1 } } }), null);
  assert.equal(receipt({ after: { ...accepted.after, me: { ...accepted.after.me, id: 'other' } } }), null);
  const changed = structuredClone(accepted.after); changed.me.progress[0].delivery.stage = 'deliver';
  assert.equal(receipt({ after: changed }), null);
});

test('concurrent learning score is reported as observed total without attributing it to delivery', () => {
  const f = fixture(); f.step(2); f.step(0); f.step(0);
  const r = f.step(0, engine => { const p = engine.get('tester').progress[0]; p.score += 10; p.quiz[0] = { correct: true }; });
  assert.equal(r.receipt.deltaStatus, 'concurrent');
  assert(r.receipt.details.some(text => text.includes('Delivery points') && text.includes('20')));
  assert(r.receipt.details.some(text => text.includes('Current totals are shown below')));
  assert.equal(r.receipt.deltas.find(d => d.label === 'Score change'), undefined);
  assert.equal(r.receipt.deltas.find(d => d.label === 'Score now').value, 30);
});

test('concurrent trade/resource changes are not presented as an exclusive consumption receipt', () => {
  const f = fixture(); f.step(0); f.step(1); f.step(0);
  const r = f.step(0, engine => { engine.get('tester').items.pop(); });
  assert.equal(r.receipt.deltaStatus, 'concurrent');
  assert.equal(r.receipt.title, 'Delivery complete');
  assert.equal(r.receipt.deltas.find(d => d.label === 'Stored parts now').value, 1);
  assert.equal(r.receipt.deltas.find(d => d.label === 'Reserve parts now').value, 6);
});

test('feedback never reads or leaks quiz, challenge or private authored answers', () => {
  const f = fixture(), accepted = f.step(0);
  for (const object of [accepted.before.chapter, accepted.after.chapter]) {
    for (const field of ['questions', 'challenge', 'answer', 'explanation']) {
      Object.defineProperty(object, field, { get() { throw Error(`Must not read ${field}`); }, enumerable: true });
    }
  }
  accepted.before.rules.privateAnswer = 'DO-NOT-EXPOSE-THIS-ANSWER';
  const model = deliveryModel(accepted.before);
  const receipt = deliveryReceipt(accepted.before, accepted.after, accepted.action, accepted.result);
  assert(model); assert(receipt);
  const serialized = JSON.stringify({ model, receipt });
  assert.equal(serialized.includes('DO-NOT-EXPOSE-THIS-ANSWER'), false);
  assert.equal(/"(?:answer|questions|challenge|explanation)":/.test(serialized), false);
});

function chapterFixture(chapter) {
  let now = 100000, version = 0, sequence = 0, round = 0;
  const engine = new Engine({ now: () => now }); engine.addPlayer('tester', 'Test neighbor'); engine.get('tester').setup = true;
  // Explicit isolated chapter fixture, not event pacing or completed earlier play.
  Object.assign(engine.state, { phase: 'chapter', chapter, chapterOpenedAt: now, deadline: now + 300000, participantCount: 1 });
  const stamp = value => ({ ...value, projectionEpoch: 'activity-fixture', projectionVersion: ++version });
  const perform = (type, fields = {}) => {
    now += 3100;
    if (chapter === 4) now = engine.state.chapterOpenedAt + round++ * 9000 + 2000;
    const before = stamp(engine.view('tester')), task = before.chapter.task;
    const target = type === 'challenge' || type === 'rewardRedeem' ? before.chapter.locations[1] : task?.target || before.chapter.locations[0];
    engine.get('tester').position = { x: target.x, y: target.y };
    const action = { type, requestId: `generic-${++sequence}`, expectedChapter: chapter,
      ...(type === 'task' ? { expectedStep: before.me.progress[chapter].step, expectedStage: task?.stage || null, ...(chapter === 4 ? { expectedRound: task.round } : {}) } : {}), ...fields };
    const result = engine.dispatch('tester', action), after = stamp(engine.actionView('tester'));
    return { before, after, action, result, receipt: actionReceipt(before, after, action, result) };
  };
  return { engine, perform, setTime: value => { now = value; } };
}

test('generic spatial receipts cover evidence inspection, incorrect decisions and correct completion without answers', () => {
  for (const chapter of [1, 2, 3, 6]) {
    const f = chapterFixture(chapter);
    let r = f.perform('task', { choice: 0 });
    assert.equal(r.receipt.stage, 'inspect'); assert.equal(r.receipt.completed, false);
    const correct = CHAPTERS[chapter].tasks[0].answer;
    r = f.perform('task', { choice: (correct + 1) % CHAPTERS[chapter].tasks[0].options.length });
    assert.equal(r.receipt.title, 'This site still needs help');
    assert.equal(r.receipt.deltas.some(d => d.label === 'Score change'), false);
    r = f.perform('task', { choice: correct });
    assert.equal(r.receipt.title, 'Work completed');
    assert.equal(r.receipt.deltas.find(d => d.label === 'Objective progress').value, `1/${r.before.chapter.taskCount}`);
    for (const object of [r.before.chapter, r.after.chapter]) Object.defineProperty(object, 'questions', { get() { throw Error('private question read'); } });
    Object.defineProperty(r.before.chapter, 'challenge', { get() { throw Error('private challenge read'); } });
    assert(actionReceipt(r.before, r.after, r.action, r.result));
  }
});

test('budget receipts use the actual recorded payment cycle for on-time and incomplete plans', () => {
  for (const choice of [0, 1, 2]) {
    const f = chapterFixture(5), r = f.perform('task', { choice });
    assert(r.receipt); assert.equal(r.receipt.stage, 'budget');
    assert.equal(r.receipt.title, choice === 2 ? 'Payment cycle recorded' : 'Payment made on time');
    assert.equal(r.receipt.deltas.find(d => d.label === 'Fictional budget retained').value, [40,20,0][choice]);
    assert.equal(r.receipt.deltas.find(d => d.label === 'Score now').value, choice === 2 ? 0 : 20);
  }
  const late = chapterFixture(5); late.setTime(145001);
  assert.equal(late.perform('task', { choice: 0 }).receipt.title, 'Payment cycle recorded');
});

test('routing receipts report a valid route and a failed attempt without revealing a solution', () => {
  const f = chapterFixture(7);
  let r = f.perform('task', { path: ['exchange', 'home-a'] });
  assert.equal(r.receipt.title, 'Connection needs another plan');
  assert.equal(r.receipt.details.join(' ').includes('relay-west'), false);
  r = f.perform('task', { path: ['exchange','north','relay-west','bypass','home-a'] });
  assert.equal(r.receipt.title, 'Home connected'); assert.equal(r.after.me.progress[7].step, 1);
});

test('target receipts occur at site completion only, not every successful hit or miss', () => {
  const f = chapterFixture(4), pattern = [1,0,2];
  for (let round = 0; round < 6; round++) {
    const r = f.perform('task', { choice: pattern[round % 3] });
    if (round < 5) assert.equal(r.receipt, null);
    else { assert.equal(r.receipt.title, 'Site cleared'); assert.equal(r.receipt.deltas.find(d => d.label === 'Targets resolved').value, 6); }
  }
  assert.equal(f.perform('task', { choice: 0 }).receipt, null, 'a missed target stays inline');
});

test('challenge and reward receipts use accepted outcomes and never replay completed claims', () => {
  const challenge = chapterFixture(1), p = challenge.engine.get('tester').progress[1];
  Object.assign(p, { complete: true, step: 6, score: 60 });
  const answer = CHAPTERS[1].challenge.answer;
  let r = challenge.perform('challenge', { choice: (answer + 1) % CHAPTERS[1].challenge.options.length });
  assert.equal(r.receipt.title, 'Try another approach'); assert.equal(r.receipt.completed, false);
  r = challenge.perform('challenge', { choice: answer });
  assert.equal(r.receipt.title, 'Challenge complete'); assert.equal(r.receipt.completed, true);
  const reward = chapterFixture(6), progress = reward.engine.get('tester').progress[6];
  Object.assign(progress, { step: 6, rewardBalance: 12, rewardEarned: 12, score: 60 });
  r = reward.perform('task', { choice: 0 });
  assert.equal(r.receipt.title, 'Neighborhood project funded'); assert.equal(r.receipt.completed, true);
  assert.equal(r.receipt.deltas.find(d => d.label === 'Reward tokens remaining').value, 8);
  r = reward.perform('rewardRedeem', { choice: 1 });
  assert.equal(r.receipt.deltas.find(d => d.label === 'Reward tokens remaining').value, 0);
  assert.equal(r.receipt.details.some(line => line.includes('shared neighborhood restoration')), false, 'additional project is not another objective completion');
});

test('generic receipts reject unaccepted, stale, wrong phase/epoch/task context and quiz actions', () => {
  const f = chapterFixture(1), r = f.perform('task', { choice: 0 });
  const check = (before = r.before, after = r.after, action = r.action, result = r.result) => actionReceipt(before, after, action, result);
  assert.equal(check(r.before, r.after, r.action, { ok: false }), null);
  assert.equal(check(r.before, r.after, { ...r.action, type: 'quiz' }), null);
  assert.equal(check(r.before, r.after, { ...r.action, expectedStep: 1 }), null);
  assert.equal(check(r.before, r.after, { ...r.action, expectedStage: 'decide' }), null);
  assert.equal(check(r.before, { ...r.after, projectionVersion: r.before.projectionVersion }), null);
  assert.equal(check(r.before, { ...r.after, projectionEpoch: 'restart' }), null);
  assert.equal(check(r.before, { ...r.after, event: { ...r.after.event, phase: 'paused' } }), null);
  assert.equal(check(r.before, { ...r.after, event: { ...r.after.event, chapter: 2 } }), null);
});
