import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../engine.mjs';
import { deliveryModel, deliveryReceipt } from '../public/trail-feedback.mjs';

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
        assert.equal(receipt.deltas.find(d => d.label === 'Current chapter score').value, last.after.me.progress[0].score);
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
  assert(r.receipt.details.some(text => text.includes('Published delivery points') && text.includes('20')));
  assert(r.receipt.details.some(text => text.includes('not an action-only breakdown')));
  assert.equal(r.receipt.deltas.find(d => d.label === 'Observed score change').value, 30);
});

test('concurrent trade/resource changes are not presented as an exclusive consumption receipt', () => {
  const f = fixture(); f.step(0); f.step(1); f.step(0);
  const r = f.step(0, engine => { engine.get('tester').items.pop(); });
  assert.equal(r.receipt.deltaStatus, 'concurrent');
  assert.equal(r.receipt.title, 'Delivery saved');
  assert.equal(r.receipt.deltas.find(d => d.label === 'Stored parts now').value, 1);
  assert.equal(r.receipt.deltas.find(d => d.label === 'Reserve parts now').value, 6);
});
