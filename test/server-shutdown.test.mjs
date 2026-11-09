import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { once } from 'node:events';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGameServer } from '../server.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('Shutdown exceeded 2500ms')), 2500);
  })]); } finally { clearTimeout(timer); }
}

test('shutdown bounds idle/partial sockets, shares completion, closes SSE and preserves committed score on disk', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'trail-shutdown-'));
  const dbPath = join(directory, 'event.sqlite');
  const app = createGameServer({ dbPath, demo: true });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port, base = `http://127.0.0.1:${port}`;
  const sockets = [];
  let stream, closed = false;
  const request = async (path, body, cookie) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'x-trail-client': 'shutdown' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0], value: await response.json() };
  };
  try {
    const joined = await request('/api/join', { token: 'demo-1' });
    const response = await fetch(base + '/api/events?client=shutdown', { headers: { Cookie: joined.cookie } });
    stream = response.body.getReader();
    await stream.read();
    assert.equal((await request('/api/action', { type: 'setup', requestId: 'setup', settingsSequence: 1, character: 0, palette: 0, insects: false }, joined.cookie)).status, 200);
    app.engine.host('fixture', { type: 'lobby', requestId: 'lobby', reason: 'Synthetic shutdown fixture' });
    app.engine.host('fixture', { type: 'start', requestId: 'start', reason: 'Synthetic shutdown fixture' });
    const now = app.engine.state.deadline;
    app.engine.now = () => now;
    app.engine.tick();
    const quiz = { type: 'quiz', index: 0, choice: 0, expectedChapter: 0, requestId: 'committed-quiz' };
    assert.equal((await request('/api/action', quiz, joined.cookie)).status, 200);
    assert.equal(app.engine.get('neighbor-1').progress[0].score, 10);
    const idle = connect(port, '127.0.0.1'); sockets.push(idle); await once(idle, 'connect');
    const lateGet = connect(port, '127.0.0.1'); sockets.push(lateGet); await once(lateGet, 'connect');
    let getReceived = ''; lateGet.on('data', bytes => { getReceived += bytes; });
    const partial = connect(port, '127.0.0.1'); sockets.push(partial); await once(partial, 'connect');
    const lateBody = JSON.stringify({ type: 'quiz', index: 1, choice: 0, expectedChapter: 0, requestId: 'late-quiz' });
    let received = '';
    partial.on('data', bytes => { received += bytes; });
    const seenPartial = new Promise(resolve => app.server.once('request', resolve));
    partial.write(`POST /api/action HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nContent-Type: application/json\r\nCookie: ${joined.cookie}\r\nx-trail-client: shutdown\r\nContent-Length: ${Buffer.byteLength(lateBody)}\r\n\r\n${lateBody.slice(0, 1)}`);
    await seenPartial;
    const started = Date.now(), first = app.close(), second = app.close();
    assert.equal(first, second);
    let settled = false; first.then(() => { settled = true; });
    await wait(50);
    assert.equal(settled, false, 'repeated close must wait for open connection drain');
    assert(existsSync(dbPath + '.lock'), 'lock is held until persistence and DB close');
    partial.write(lateBody.slice(1));
    lateGet.write('GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
    await bounded(first); closed = true;
    assert(Date.now() - started < 2500, 'shutdown must finish before a short container stop grace');
    assert.match(received, /503 Service Unavailable/);
    assert.match(getReceived, /503 Service Unavailable/);
    assert.equal(existsSync(dbPath + '.lock'), false);
    assert.equal(app.engine.get('neighbor-1').progress[0].score, 10);
    assert.equal(app.engine.state.requests['neighbor-1:late-quiz'], undefined);
    // Read through queued SSE bytes to the orderly EOF.
    while (!(await stream.read()).done) {}
    const restarted = createGameServer({ dbPath, demo: true });
    try {
      assert.equal(restarted.engine.get('neighbor-1').progress[0].score, 10);
      const replay = restarted.engine.dispatch('neighbor-1', quiz);
      assert.equal(replay.correct, true);
      assert.equal(restarted.engine.get('neighbor-1').progress[0].score, 10);
    } finally { await restarted.close(); }
  } finally {
    sockets.forEach(socket => socket.destroy());
    if (!closed) await app.close();
    await stream?.cancel();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('shutdown also terminates a partial request whose body never arrives', async () => {
  const app = createGameServer({ dbPath: ':memory:', demo: true });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const socket = connect(app.server.address().port, '127.0.0.1');
  await once(socket, 'connect');
  const seen = new Promise(resolve => app.server.once('request', resolve));
  socket.write('POST /api/join HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{');
  await seen;
  const start = Date.now();
  try { await bounded(app.close()); assert(Date.now() - start < 2500); }
  finally { socket.destroy(); await app.close(); }
});

test('shutdown flushes an already queued command durably before its HTTP success', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'trail-shutdown-queue-'));
  const dbPath = join(directory, 'event.sqlite');
  const app = createGameServer({ dbPath, demo: true });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const login = await fetch(base + '/api/host/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'local-host-one' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0]; await login.json();
  const original = globalThis.setTimeout;
  let queued;
  const ready = new Promise(resolve => { queued = resolve; });
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay !== 8) return original(callback, delay, ...args);
    const timer = original(callback, 60000, ...args); queued(); return timer;
  };
  try {
    const response = fetch(base + '/api/host/action', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ type: 'broadcast', message: 'Queued before shutdown', reason: 'Shutdown regression', requestId: 'queued-broadcast' }) });
    await bounded(ready);
    globalThis.setTimeout = original;
    const closing = app.close();
    const confirmed = await response;
    assert.equal(confirmed.status, 200); await confirmed.json();
    await bounded(closing);
    const reopened = createGameServer({ dbPath, demo: true });
    try { assert.equal(reopened.engine.state.broadcast, 'Queued before shutdown'); }
    finally { await reopened.close(); }
  } finally {
    globalThis.setTimeout = original;
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
