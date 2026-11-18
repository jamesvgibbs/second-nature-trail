import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { drawEventScene } from '../public/event-scenes.mjs';
import { overviewCrowd } from '../public/crowd-view.mjs';
import { Engine } from '../engine.mjs';
import { clipMove, waypointReached, stepToward, isWalkable, findPath, OBSTACLES, DOORS } from '../public/world.mjs';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end)); }
function fixture({ seen = true, modalOpen = false, presentation = false, editing = false } = {}) {
  let time = 1000000, request = 0;
  const engine = new Engine({ now: () => time });
  engine.addPlayer('neighbor', 'Neighbor');
  engine.dispatch('neighbor', { type: 'setup', requestId: 'setup', character: 0, palette: 0, insects: false });
  const document = { activeElement: { tagName: 'INPUT', isConnected: editing } }, handlers = {};
  const canvas = { isConnected: true, attributes: {}, setAttribute(name,value) { this.attributes[name]=value; }, getContext() { return new Proxy({}, {get: () => () => {}}); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 800 }; },
    addEventListener(type, handler) { handlers[type] = handler; },
    focus() { document.activeElement = canvas; } };
  const node = { append() {}, textContent: '' };
  const calls = [], modal = { open: modalOpen };
  const context = vm.createContext({
    state: engine.view('neighbor'), app: {}, activeCanvas: null, activeCtx: null,
    document, modal, isPresentation: presentation, connected: true,
    target: null, lastMove: 0, serverOffset: 0, tutorialMovePending: false, panel: '',
    keys: { up: 'w', down: 's', left: 'a', right: 'd' },
    $: (selector) => selector === '#world' ? canvas : node,
    topbar: () => '', btn: () => ({}), inventory() {}, map() {}, neighbors() {}, help() {}, settings() {},
    renderMission() {}, updateConnection() {}, updateControlHints() {}, windowCheck() {},
    drawEventScene, requestAnimationFrame() {}, drawMap() {}, measureFrame() {}, toast() {}, showActivity() {}, close() {},
    movementKeys: () => 'WASD', keyLabel: (x) => x, esc: (x) => x,
    localStorage: { getItem: () => seen ? '1' : null, setItem() {} },
    open() { modal.open = true; document.activeElement = { id: 'close-modal' }; },
    overviewCrowd, clipMove, waypointReached, stepToward, isWalkable, findPath, OBSTACLES, DOORS,
    tutorialDone: (step) => context.state.me.tutorial.includes(step),
    act(type, fields) {
      calls.push(type);
      const result = engine.dispatch('neighbor', { type, requestId: `action-${request++}`, ...fields });
      context.state = engine.view('neighbor');
      return Promise.resolve(result);
    },
  });
  vm.runInContext(section('function game()', 'function renderMission()') +
    section('function worldKeys(e)', 'modal.addEventListener("keydown"') +
    section('function frame(now)', 'function rect(') +
    section('function setDestination(', 'function drawRepairs('), context);
  context.game();
  return { engine, context, canvas, document, modal, calls,
    key(key) { assert.equal(document.activeElement, canvas); handlers.keydown({ key, preventDefault() {} }); },
    click(x, y) { handlers.pointerdown({ clientX: x, clientY: y }); },
    frame() { time += 200; context.frame(time - 1000000); },
  };
}

test('actual game entry and frame send arrow/WASD movement to the draft engine without scoring', async () => {
  for (const [key, dx, dy] of [['w', 0, -1], ['a', -1, 0], ['s', 0, 1], ['d', 1, 0],
    ['ArrowUp', 0, -1], ['ArrowLeft', -1, 0], ['ArrowDown', 0, 1], ['ArrowRight', 1, 0]]) {
    const f = fixture(), before = structuredClone(f.engine.get('neighbor').progress);
    assert.equal(f.engine.state.phase, 'draft');
    f.key(key); f.frame();
    const p = f.engine.get('neighbor').position;
    assert.equal(Math.sign(p.x - 600), dx, key);
    assert.equal(Math.sign(p.y - 380), dy, key);
    f.key(key); f.frame();
    await Promise.resolve();
    assert.ok(f.engine.get('neighbor').tutorial.includes('move'), key);
    assert.deepEqual(f.engine.get('neighbor').progress, before);
    assert.throws(() => f.engine.dispatch('neighbor', { type: 'task', requestId: 'score', expectedChapter: 0, expectedStep: 0, expectedStage: 'load', choice: 0 }));
  }
});

test('pointer practice follows the same draft movement path', () => {
  const f = fixture(); f.click(650, 380); f.frame();
  assert.ok(f.engine.get('neighbor').position.x > 600);
  assert.equal(f.engine.get('neighbor').progress[0].score, 0);
});

test('non-play phases and pause still freeze client movement and reject engine movement', () => {
  for (const phase of ['countdown', 'brag', 'paused', 'awards', 'closed']) {
    const f = fixture();
    f.engine.state.phase = phase;
    if (phase === 'paused') f.engine.state.pause = { phase: 'chapter', remainingMs: 10000, at: 1000000 };
    f.context.state = f.engine.view('neighbor');
    f.key('d'); f.frame();
    assert.equal(f.context.target, null, phase);
    assert.deepEqual(f.calls, [], phase);
    assert.throws(() => f.engine.dispatch('neighbor', { type: 'move', requestId: 'frozen', x: 650, y: 380 }), /frozen|paused/i);
  }
  const f = fixture(); f.context.state.event.paused = true;
  f.key('d'); f.frame(); assert.deepEqual(f.calls, []);
});

test('entry focuses the map on return but preserves intro, existing modal and presentation focus', () => {
  const returned = fixture();
  assert.equal(returned.document.activeElement, returned.canvas);
  returned.document.activeElement = { tagName: 'BODY' };
  returned.context.game();
  assert.equal(returned.document.activeElement, returned.canvas);
  const first = fixture({ seen: false });
  assert.equal(first.modal.open, true);
  assert.equal(first.document.activeElement.id, 'close-modal');
  for (const options of [{ modalOpen: true }, { presentation: true }, { editing: true }]) {
    const f = fixture(options);
    assert.equal(f.document.activeElement.tagName, 'INPUT');
  }
});

test('read-only presentation canvas announces an illustration without movement or keyboard focus', () => {
  const f=fixture({presentation:true});
  assert.equal(f.canvas.attributes.role,'img');
  assert.equal(f.canvas.attributes.tabindex,'-1');
  assert.match(f.canvas.attributes['aria-label'],/read-only/);
  assert.doesNotMatch(f.canvas.attributes['aria-label'],/WASD|Press E|Move with/);
  assert.notEqual(f.document.activeElement,f.canvas);
});
