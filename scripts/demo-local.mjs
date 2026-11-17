// Isolated local walkthrough. Never opens a saved event database.
import { createInterface } from 'node:readline';
import { randomBytes, randomUUID } from 'node:crypto';
import { createGameServer } from '../server.mjs';

let port = 4180, players = 1;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const option = args[i], value = args[++i];
  if (!['--port', '--players'].includes(option) || value === undefined || !/^\d+$/.test(value))
    throw Error('Usage: npm run demo -- [--port 4180] [--players 1..20]');
  const number = Number(value);
  if (option === '--port') port = number;
  else players = number;
}
if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isInteger(players) || players < 1 || players > 20)
  throw Error('Port must be0..65535; players must be1..20.');
const hostTokens = ['primary', 'backup'].map(role => `local-demo-${role}-${randomBytes(24).toString('hex')}`);
const presentationToken = `local-demo-display-${randomBytes(24).toString('hex')}`;
const app = createGameServer({ dbPath: ':memory:', demo: false, hostTokens, presentationToken, secure: false });
for (let n = 1; n <= players; n++) app.addInvitation(`demo-neighbor-${n}`, `Demo neighbor ${n}`, `local-demo-${n}`);
let input, cookie, origin, closing = false, closePromise, sequence = Promise.resolve();
function shutdown(code = 0) {
  if (closePromise) return closePromise;
  closing = true;
  input?.close();
  closePromise = app.close().then(() => { process.exitCode = code; process.stdin.pause(); });
  return closePromise;
}
async function request(path, body) {
  const response = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || `Request failed: ${response.status}`);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function status() {
  const { data } = await request('/api/host/state');
  console.log('STATUS ' + JSON.stringify({ phase: data.event.phase, chapter: data.event.chapter + 1, players: data.players.length, remainingMs: data.event.remainingMs, restorationPerDistrict: data.event.restoration.perDistrict }));
  return data;
}
async function command(line) {
  if (closing) return;
  const word = line.trim().toLowerCase();
  if (!word) return;
  if (word === 'quit') { await shutdown(); return; }
  if (word === 'status') { await status(); return; }
  if (!['lobby', 'start', 'pause', 'resume', 'next'].includes(word)) throw Error('Commands: lobby, start, pause, resume, next, status, quit.');
  if (word === 'next') {
    const { data } = await request('/api/host/state');
    if (data.event.phase === 'countdown' || data.event.pausedPhase === 'countdown')
      throw Error('Let the normal ten-second countdown finish. Use pause/resume to stop or continue it.');
  }
  await request('/api/host/action', {
    type: word === 'next' ? 'advance' : word,
    requestId: randomUUID(),
    reason: word === 'next'
      ? 'Local demo terminal: shorten walkthrough by advancing this phase; not normal pacing evidence'
      : `Local demo terminal: ${word}`,
  });
  await status();
}
app.server.on('error', error => {
  console.error('Local demo could not start: ' + error.message);
  void shutdown(1);
});
app.server.listen(port, '127.0.0.1', async () => {
  try {
    const actualPort = app.server.address().port;
    origin = `http://127.0.0.1:${actualPort}`;
    cookie = (await request('/api/host/login', { token: hostTokens[0] })).cookie;
    await request('/api/host/action', {
      type: 'broadcast', requestId: randomUUID(), reason: 'Label isolated local walkthrough',
      message: 'LOCAL DEMO · Practice event; results are for this walkthrough.',
    });
    console.log('LOCAL DEMO · no saved database is opened; quitting discards this walkthrough.');
    for (let n = 1; n <= players; n++) console.log(`Player ${n}: http://localhost:${actualPort}/?invite=local-demo-${n}`);
    console.log(`Host: ${origin}/host`);
    console.log(`Primary operator token: ${hostTokens[0]}`);
    console.log(`Backup operator token: ${hostTokens[1]}`);
    console.log('Use the host page’s Open safe presentation link; it shares the host sign-in.');
    console.log('Player localhost and host127.0.0.1 keep their browser cookies separate. Use separate profiles for multiple players.');
    console.log('Commands: lobby, start, pause, resume, next, status, quit.');
    console.log('Open lobby, finish setup/practice, then start. Start keeps the normal ten-second countdown.');
    console.log('next advances one phase through normal operator recovery; it does not complete tasks or award fabricated points.');
    input = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
    input.on('line', line => { sequence = sequence.then(() => command(line)).catch(error => console.log('COMMAND ERROR: ' + error.message)); });
    input.on('close', () => { if (!closing) console.log('Terminal input closed. Demo remains running; use browser host controls or send SIGTERM to stop.'); });
    await status();
  } catch (error) { console.error(error.message); await shutdown(1); }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void shutdown(); });
