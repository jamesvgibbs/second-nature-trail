import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { Engine } from '../engine.mjs';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function fixture(phase) {
  let now = 1000000, request = 0;
  const engine = new Engine({ now: () => now });
  engine.addPlayer('neighbor', 'Neighbor');
  engine.dispatch('neighbor', { type: 'setup', requestId: 'setup', character: 0, palette: 0, insects: false });
  if (phase === 'lobby') engine.host('operator', { type: 'lobby', reason: 'Tutorial regression', requestId: 'lobby' });
  const nodes = new Map(), errors = [], messages = [];
  const node = () => ({ children: [], append(...items) { this.children.push(...items); } });
  for (const id of ['#tutorial-actions', '#ready-action']) nodes.set(id, node());
  const context = vm.createContext({
    state: engine.view('neighbor'), activeCanvas: { focus() {} },
    $: (selector) => nodes.get(selector), movementKeys: () => 'WASD',
    btn: (textContent, onclick) => ({ textContent, onclick }),
    toast: (message) => messages.push(message),
    open(title, html) {
      context.dialog = title;
      for (const id of ['practice-action', 'practice-answers'])
        if (html.includes(`id="${id}"`)) nodes.set(`#${id}`, node());
    },
    close() { context.dialog = null; },
    async act(type, fields) {
      try {
        const result = engine.dispatch('neighbor', { type, requestId: `action-${request++}`, ...fields });
        context.state = engine.view('neighbor');
        return result;
      } catch (error) { errors.push(error.message); return null; }
    },
  });
  vm.runInContext(source.slice(source.indexOf('function tutorialDone('), source.indexOf('function travel(')), context);
  context.renderTutorial();
  return { engine, context, nodes, errors, messages,
    advance(ms) { now += ms; },
    async step(index, choice = 0) {
      await nodes.get('#tutorial-actions').children[index].onclick();
      if (index !== 0) await nodes.get(index === 3 ? '#practice-answers' : '#practice-action').children[choice].onclick();
    },
    async move() {
      now += 1000;
      await context.act('move', { x: 635, y: 380 });
      await context.act('tutorial', { step: 'move' });
    },
  };
}

for (const phase of ['draft', 'lobby']) {
  test(`actual ${phase} tutorial UI completes all five practice steps and Ready without competitive changes`, async () => {
    const f = fixture(phase), before = structuredClone(f.engine.get('neighbor'));
    await f.step(0); await f.move();
    await f.step(1);
    await f.step(2);
    assert.equal(f.engine.get('neighbor').practice.collected, true);
    await f.step(3, 1);
    assert.equal(f.engine.get('neighbor').practice.answered, false, 'wrong practice answer does not complete');
    await f.step(3, 0);
    await f.step(4);
    await f.nodes.get('#ready-action').children[0].onclick();
    const player = f.engine.get('neighbor');
    assert.deepEqual(f.errors, []);
    assert.deepEqual(player.tutorial, ['move', 'interact', 'collect', 'answer', 'help']);
    assert.equal(player.ready, true);
    assert.deepEqual(player.progress, before.progress);
    assert.deepEqual(player.items, before.items);
    assert.equal(f.engine.state.phase, phase);
  });
  test(`${phase} practice preserves collection/question/Ready prerequisites`, async () => {
    const f = fixture(phase);
    await f.step(2);
    assert.match(f.errors.pop(), /Interact with the practice crate first/);
    await f.step(3);
    assert.match(f.errors.pop(), /Collect the practice supply first/);
    await f.nodes.get('#ready-action').children[0].onclick();
    assert.match(f.errors.pop(), /Complete every tutorial step/);
    assert.equal(f.engine.get('neighbor').ready, false);
    assert.deepEqual(f.engine.get('neighbor').tutorial, []);
  });
}

test('reported draft position with guide and movement complete can collect without resetting progress', async () => {
  const f = fixture('draft');
  await f.step(1);
  f.advance(1000);
  await f.context.act('move', { x: 536.1919999999999, y: 420.90900000000113 });
  await f.context.act('tutorial', { step: 'move' });
  assert.deepEqual(f.engine.get('neighbor').tutorial, ['interact', 'move']);
  const position = structuredClone(f.engine.get('neighbor').position);
  await f.step(2);
  assert.deepEqual(f.errors, []);
  assert.equal(f.engine.get('neighbor').practice.collected, true);
  assert.deepEqual(f.engine.get('neighbor').position, position);
  assert.deepEqual(f.engine.get('neighbor').tutorial, ['interact', 'move', 'collect']);
});
