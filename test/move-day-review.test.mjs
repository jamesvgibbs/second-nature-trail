import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function launch(args, env = {}) {
  const child = spawn(process.execPath, ['scripts/move-day-review.mjs', '--port', '0', ...args], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '', error = '';
  child.stdout.on('data', bytes => { output += bytes; });
  child.stderr.on('data', bytes => { error += bytes; });
  const waitFor = async (predicate, timeout = 45000) => {
    const start = Date.now();
    while (!predicate(output)) {
      if (child.exitCode !== null) throw Error(`Review exited${child.exitCode}: ${error}`);
      if (Date.now() - start >= timeout) { child.kill('SIGTERM'); throw Error('Review did not reach expected state'); }
      await wait(20);
    }
  };
  return { child, output: () => output, errors: () => error, waitFor,
    async stop() { if (child.exitCode !== null) return; const stopped = once(child, 'exit'); child.kill('SIGTERM'); const [code] = await stopped; assert.equal(code, 0, error); },
  };
}

test('bounded HTTP/SSE scenario performs actual cargo choices and preserves every peer projection', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'move-review-test-')), report = join(dir, 'report.json'), sentinel = join(dir, 'saved.sqlite');
  writeFileSync(sentinel, 'untouched existing game');
  const run = launch(['--verify', '--players', '3', '--output', report], { DB_PATH: sentinel, DEMO: '1', HOST_TOKENS: 'invalid', PRESENTATION_TOKEN: 'invalid' });
  try {
    const exited = once(run.child, 'exit'); await run.waitFor(text => text.includes('VERIFIED '));
    const [code] = await exited; assert.equal(code, 0, run.errors());
    const result = JSON.parse(readFileSync(report));
    assert.equal(result.passed, true); assert.equal(result.concurrentParticipants, 3);
    assert.equal(result.completedObjectives, 3); assert.equal(result.scoringSamples, 36);
    assert.deepEqual(result.scores, { perPlayer: 45, primaryValue: 27 });
    assert.deepEqual(result.inventoryPerPlayer, { parts: 0, filters: 3, food: 1, cable: 1 });
    assert.equal(result.reservesConsumed, 0); assert.equal(result.answersExposed, false);
    assert.equal(result.peerUpdatesPreservedOwnProgress, true); assert.deepEqual(result.errors, []);
    assert.equal(result.storage, ':memory:'); assert.equal(result.clockOffsets, false); assert.equal(result.scoresSeeded, false);
    assert.equal(readFileSync(sentinel, 'utf8'), 'untouched existing game');
    assert(result.frames > 30); assert.equal(result.humanVisualAcceptance, false);
  } finally { await run.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('visual review reserves one human identity; real peers can move between crowd arrangements without scoring', async () => {
  const run = launch(['--players', '3']); let controller, replacement;
  try {
    await run.waitFor(text => text.includes('PLAYER '));
    const origin = run.output().match(/HOST (http:\/\/127\.0\.0\.1:\d+)/)[1];
    const token = run.output().match(/PRIMARY TOKEN (\S+)/)[1];
    const post = async (path, body, cookie) => {
      const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
      assert.equal(response.status, 200); const data = await response.json(); return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
    };
    const operator = await post('/api/host/login', { token });
    const state = async () => (await fetch(origin + '/api/host/state', { headers: { Cookie: operator.cookie } })).json();
    assert.equal((await state()).connections.length, 2);
    const human = await post('/api/join', { token: 'move-review-1' });
    controller = new AbortController();
    const stream = await fetch(origin + '/api/events?client=human-test', { headers: { Cookie: human.cookie }, signal: controller.signal });
    assert.equal(stream.status, 200); await stream.body.getReader().read();
    assert.equal((await state()).connections.length, 3);
    run.child.stdin.write('square\n'); await run.waitFor(text => text.includes('ARRANGEMENT square:'));
    let current = await state();
    assert(current.players.filter(p => p.id !== 'review-1').every(p => p.position.x >= 550 && p.position.y >= 350));
    const humanBefore = current.players.find(p => p.id === 'review-1');
    replacement = launch(['--players', '3', '--attach', origin], { MOVE_REVIEW_HOST_TOKEN: token });
    await replacement.waitFor(text => text.includes('ATTACHED: 2 simulated identities reconnected'));
    current = await state(); assert.equal(current.connections.length, 3);
    assert.deepEqual(current.players.find(p => p.id === 'review-1'), humanBefore, 'controller takeover must not change human state');
    replacement.child.stdin.write('spread\n'); await replacement.waitFor(text => text.includes('ARRANGEMENT spread:'));
    current = await state();
    assert(current.players.filter(p => p.id !== 'review-1').every(p => (Math.abs(p.position.y - 160) < 0.6 && p.position.x >= 159.5 && p.position.x <= 300.5) || (Math.abs(p.position.x - 230) < 0.6 && p.position.y >= 59.5 && p.position.y <= 160.5)));
    assert.equal(current.event.contributions[0], 0); assert.equal(current.event.phase, 'lobby');
    run.child.stdin.end(); await wait(100); assert.equal(run.child.exitCode, null); assert.equal((await state()).connections.length, 3);
  } finally { controller?.abort(); await replacement?.stop(); await run.stop(); }
});
