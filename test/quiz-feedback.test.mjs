import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { Engine } from '../engine.mjs';
import { CHAPTERS, RULES } from '../content.mjs';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
function fixture(chapter = 0) {
  let now = 1000000, request = 0;
  const engine = new Engine({ now: () => now });
  engine.addPlayer('neighbor', 'Neighbor');
  engine.dispatch('neighbor', { type: 'setup', requestId: 'setup', character: 0, palette: 0, insects: false });
  engine.host('operator', { type: 'lobby', reason: 'Quiz regression', requestId: 'lobby' });
  engine.host('operator', { type: 'start', reason: 'Quiz regression', requestId: 'start' });
  now += RULES.countdownMs; engine.tick();
  engine.state.chapter = chapter;
  const ids = new Map();
  class Element {
    constructor() { this.children = []; this.style = {}; this.attributes = {}; this.classList = { toggle() {} }; }
    append(...nodes) { this.children.push(...nodes); }
    prepend(node) { this.children.unshift(node); if (node.id) ids.set('#' + node.id, node); }
    after(node) { if (node.id) ids.set('#' + node.id, node); }
    set innerHTML(html) {
      this.html = html; this.children = [];
      for (const key of ['#task-choices', '#quiz-confirm', '#learning-list', '#dialog-feedback', '#selection-status']) ids.delete(key);
      for (const match of html.matchAll(/id="([^"]+)"/g)) ids.set('#' + match[1], new Element());
    }
    get innerHTML() { return this.html; }
    querySelectorAll() { return this.children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    focus() { document.activeElement = this; }
  }
  const document = { createElement: () => new Element(), activeElement: null };
  const body = new Element(), modal = { open: false, showModal() { this.open = true; } };
  for (const key of ['#toast', '#modal-title', '#close-modal']) ids.set(key, new Element());
  const context = vm.createContext({
    body, modal, document, $: (key) => ids.get(key), state: engine.view('neighbor'),
    target: null, panel: '', selection: null,
    btn(textContent, onclick) { const b = new Element(); b.textContent = textContent; b.onclick = onclick; return b; },
    esc: (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    async act(type, fields) {
      try {
        const result = engine.dispatch('neighbor', { type, requestId: 'action-' + request++, ...fields });
        context.state = engine.view('neighbor');
        return result;
      } catch (error) { context.toast(error.message); return null; }
    },
  });
  vm.runInContext(section('function toast(', 'function close()') + section('function choose(', 'function inventory('), context);
  return { engine, context, ids, body,
    feedback: () => ids.get('#dialog-feedback')?.textContent,
    async answer(index, choice) {
      context.quiz(index);
      await ids.get('#task-choices').children[choice].onclick();
      await ids.get('#quiz-confirm').children[0].onclick();
    },
  };
}

test('all sixteen first-correct answers earn published points and retain real modal feedback and list credit', async () => {
  for (let chapter = 0; chapter < CHAPTERS.length; chapter++) {
    const f = fixture(chapter);
    for (let index = 0; index < 2; index++) {
      await f.answer(index, CHAPTERS[chapter].questions[index].answer);
      assert.equal(f.engine.get('neighbor').progress[chapter].score, (index + 1) * RULES.quizPoints);
      assert.match(f.feedback(), new RegExp(`Correct\\. ${RULES.quizPoints} points earned\\. First answer recorded`));
      assert.match(f.body.innerHTML, new RegExp(`First answer: correct\\. ${RULES.quizPoints} points earned`));
      assert.equal(f.engine.get('neighbor').progress[chapter].step, 0);
    }
    f.context.learning();
    for (const button of f.ids.get('#learning-list').children)
      assert.match(button.textContent, new RegExp(`✓ Correct · ${RULES.quizPoints} points`));
  }
});

test('wrong first answer followed by correct retry remains zero and explains both outcomes visibly', async () => {
  const f = fixture(), q = CHAPTERS[0].questions[1];
  await f.answer(1, 0);
  assert.match(f.feedback(), /Not quite\. 0 points earned\. First answer recorded/);
  assert.match(f.body.innerHTML, /First answer: incorrect\. 0 points earned/);
  await f.answer(1, q.answer);
  assert.match(f.feedback(), /Correct\. Unscored retry\. Your first answer and its points are unchanged/);
  assert.match(f.body.innerHTML, /First answer: incorrect\. 0 points earned/);
  assert.equal(f.engine.get('neighbor').progress[0].score, 0);
  assert.equal(f.engine.get('neighbor').progress[0].quiz[1].choice, 0);
  f.context.learning();
  assert.match(f.ids.get('#learning-list').children[1].textContent, /^Answered · 0 points/);
});

test('selection is reset per encounter and an old chapter confirmation cannot score the next chapter', async () => {
  const f = fixture();
  f.context.quiz(0);
  f.ids.get('#task-choices').children[0].onclick();
  f.context.quiz(1);
  await f.ids.get('#quiz-confirm').children[0].onclick();
  assert.match(f.feedback(), /Choose an answer first/);
  assert.equal(f.engine.get('neighbor').progress[0].quiz[1], null);
  f.ids.get('#task-choices').children[1].onclick();
  f.engine.state.chapter = 1;
  f.context.state = f.engine.view('neighbor');
  await f.ids.get('#quiz-confirm').children[0].onclick();
  assert.match(f.feedback(), /chapter changed/);
  assert.equal(f.engine.get('neighbor').progress[1].quiz[1], null);
});

test('repeated correct and later incorrect retries preserve the first correct credit without awarding more', async () => {
  const f = fixture(), q = CHAPTERS[0].questions[0];
  await f.answer(0, q.answer);
  await f.answer(0, q.answer);
  assert.equal(f.engine.get('neighbor').progress[0].score, RULES.quizPoints);
  assert.match(f.feedback(), /Correct\. Unscored retry/);
  await f.answer(0, 1);
  assert.equal(f.engine.get('neighbor').progress[0].score, RULES.quizPoints);
  assert.match(f.feedback(), /Not quite\. Unscored retry/);
  assert.match(f.body.innerHTML, new RegExp(`First answer: correct\\. ${RULES.quizPoints} points earned`));
});
