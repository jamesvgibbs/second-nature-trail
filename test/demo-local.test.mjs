import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function launch(args = [], environment = {}) {
  const child = spawn(process.execPath, ['scripts/demo-local.mjs', '--port', '0', ...args], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, ...environment }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '', errors = '';
  child.stdout.on('data', bytes => { output += bytes; });
  child.stderr.on('data', bytes => { errors += bytes; });
  for (let i = 0; i < 250 && !output.includes('STATUS '); i++) {
    if (child.exitCode !== null) throw Error(`Demo exited${child.exitCode}: ${errors}`);
    await delay(20);
  }
  assert(output.includes('STATUS '), 'Demo must become ready');
  const origin = output.match(/Host: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
  const token = output.match(/Primary operator token: (\S+)/)?.[1];
  assert(origin); assert(token && token.length >= 32);
  const login = await fetch(origin + '/api/host/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  assert.equal(login.status, 200); await login.json();
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const state = async () => { const response = await fetch(origin + '/api/host/state', { headers: { Cookie: cookie } }); assert.equal(response.status, 200); return response.json(); };
  const until = async (predicate, timeout = 2500) => {
    const start = Date.now(); let latest;
    do { latest = await state(); if (predicate(latest)) return latest; await delay(20); } while (Date.now() - start < timeout);
    assert.fail(`Expected demo state within${timeout}ms; actualphase=${latest.event.phase}`);
  };
  return { child, state, until, origin, output: () => output, command: text => child.stdin.write(text + '\n'),
    async close() { if (child.exitCode !== null) return; const exited = once(child, 'exit'); child.kill('SIGTERM'); const [code] = await exited; assert.equal(code, 0, errors); },
    async quit() { const exited = once(child, 'exit'); child.stdin.write('quit\n'); const [code] = await exited; assert.equal(code, 0, errors); },
  };
}

test('isolated demo ignores saved DB/environment, uses actual one-player roster and normal audited phase controls', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'trail-demo-sentinel-')), database = join(directory, 'saved.sqlite');
  writeFileSync(database, 'saved-game-sentinel');
  const app = await launch([], { DB_PATH: database, DEMO: '1', HOST_TOKENS: 'invalid-env-token', PRESENTATION_TOKEN: 'invalid', PORT: '1', BIND: '0.0.0.0' });
  try {
    const joined = await fetch(app.origin + '/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'local-demo-1' }) });
    assert.equal(joined.status, 200); await joined.json();
    const playerCookie = joined.headers.get('set-cookie').split(';')[0];
    const playerState = async () => (await fetch(app.origin + '/api/state', { headers: { Cookie: playerCookie } })).json();
    let state = await app.state();
    assert.equal(state.event.phase, 'draft'); assert.equal(state.players.length, 1); assert.equal(state.event.restoration.perDistrict, 1);
    assert.equal(state.players[0].setup, false); assert.equal(state.event.awards.length, 0);
    assert(app.output().includes('Player 1: http://localhost:')); assert(app.output().includes('no saved database is opened'));
    app.command('lobby'); await app.until(s => s.event.phase === 'lobby');
    app.command('start'); state = await app.until(s => s.event.phase === 'countdown');
    assert(state.event.remainingMs > 9000 && state.event.remainingMs <= 10000);
    app.command('next'); await delay(80); assert.equal((await app.state()).event.phase, 'countdown');
    assert(app.output().includes('normal ten-second countdown'));
    app.command('pause'); state = await app.until(s => s.event.phase === 'paused');
    const remaining = state.event.remainingMs; await delay(60); assert.equal((await app.state()).event.remainingMs, remaining);
    app.command('resume'); await app.until(s => s.event.phase === 'countdown');
    state = await app.until(s => s.event.phase === 'chapter', 12000);
    assert(state.event.remainingMs > 288000 && state.event.remainingMs <= 290000);
    app.command('next'); state = await app.until(s => s.event.phase === 'brag');
    const player = await playerState(); assert.equal(player.me.progress[0].complete, false); assert.equal(player.me.progress[0].score, 0);
    assert(state.audit.some(entry => entry.type === 'advance' && entry.reason.includes('not normal pacing evidence')));
    app.command('next'); state = await app.until(s => s.event.phase === 'chapter' && s.event.chapter === 1);
    assert(state.event.remainingMs > 299000 && state.event.remainingMs <= 300000);
    assert.equal(state.event.restoration.perDistrict, 1);
    assert.equal(readFileSync(database, 'utf8'), 'saved-game-sentinel');
    await app.quit();
  } finally { await app.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('multiple invitations set actual roster and stdin EOF neither starts nor stops the demo', async () => {
  const app = await launch(['--players', '3']);
  try {
    assert.equal((await app.state()).players.length, 3); assert.equal((await app.state()).event.restoration.perDistrict, 3);
    assert(app.output().includes('Player 3:')); assert(!app.output().includes('Player 4:'));
    app.child.stdin.end(); await delay(100);
    assert.equal((await app.state()).event.phase, 'draft'); assert.equal(app.child.exitCode, null);
    assert(app.output().includes('Terminal input closed. Demo remains running'));
  } finally { await app.close(); }
});

test('invalid roster sizes fail before creating a server', async () => {
  for (const value of ['0', '21', '-1', 'two']) {
    const child = spawn(process.execPath, ['scripts/demo-local.mjs', '--players', value], { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.resume();
    const [code] = await once(child, 'exit'); assert.notEqual(code, 0); assert.equal(output.includes('Player 1:'), false);
  }
});
