// Bounded local developer scenario. Bots use the public HTTP/SSE protocol.
// No saved DB, game-clock offsets, assigned scores or completed-task fixtures.
import { createGameServer } from '../server.mjs';
import { createProjection, reduceProjection } from '../public/projection.mjs';
import { findPath, stepToward, waypointReached, isWalkable } from '../public/world.mjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';

let verify = false, count = 100, port, output, attach;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (flag === '--verify') { verify = true; continue; }
  if (!['--players', '--port', '--output', '--attach'].includes(flag) || !args[i + 1]) throw Error('Usage: node scripts/move-day-review.mjs [--verify] [--players 2..100] [--port N] [--output new-report.json] [--attach http://127.0.0.1:PORT]');
  const value = args[++i];
  if (flag === '--attach') attach = value;
  else if (flag === '--output') output = value;
  else { if (!/^\d+$/.test(value)) throw Error('Numeric option required'); if (flag === '--players') count = Number(value); else port = Number(value); }
}
if (attach) { assert(!verify && /^http:\/\/127\.0\.0\.1:\d+$/.test(attach), 'Attach requires an existing loopback review server'); assert(process.env.MOVE_REVIEW_HOST_TOKEN, 'MOVE_REVIEW_HOST_TOKEN required for attach'); }
port ??= verify ? 0 : 4182;
assert(Number.isInteger(count) && count >= 2 && count <= 100 && Number.isInteger(port) && port >= 0 && port <= 65535, 'Invalid roster or port');
const root = new URL('../', import.meta.url), startedAt = new Date().toISOString();
const sourceFiles = ['server.mjs','engine.mjs','content.mjs','command-checkpoint.mjs','scripts/move-day-review.mjs', ...readdirSync(new URL('../public/', import.meta.url)).filter(file => /\.(?:mjs|js|css|html)$/.test(file)).map(file => 'public/' + file)];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]));
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const uncommittedSourceFiles = sourceFiles.filter(file => {
  try { return createHash('sha256').update(execFileSync('git', ['show', `${sourceCommit}:${file}`], { cwd: root, stdio: ['ignore','pipe','ignore'] })).digest('hex') !== sourceHashes[file]; }
  catch { return true; }
});
const hostTokens = [0,1].map(() => randomBytes(32).toString('hex')), presentationToken = randomBytes(32).toString('hex');
const app = attach ? null : createGameServer({ dbPath: ':memory:', demo: false, hostTokens, presentationToken, secure: false });
for (let n = 1; app && n <= count; n++) app.addInvitation(`review-${n}`, n === 1 && !verify ? 'Your review player' : `Simulated neighbor ${n}`, `move-review-${n}`);
const clients = [], controllers = [], pendingPumps = [], samples = [], errors = [];
let origin, hostCookie, input, closing = false, closePromise, sequence = Promise.resolve(), frameCount = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { scenario: 'bounded chapter1 HTTP/SSE developer check; not full-hour capacity or representative network evidence', mode: verify ? 'verification' : 'native visual review', startedAt, sourceCommit, sourceHashes, uncommittedSourceFiles, roster: count, scoresSeeded: false, clockOffsets: false, storage: ':memory:', environment: { node: process.version, platform: process.platform, arch: process.arch, network: 'loopback; server and simulated clients share one process; user computer not controlled' }, errors };
async function http(path, body, cookie, client) {
  const start = performance.now();
  const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...(client ? { 'x-trail-client': client } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Error(`${path}: ${response.status} ${data.error}`);
  if (body?.type === 'task') samples.push(performance.now() - start);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
function publicContentOnly(state) {
  if (!state.chapter) return;
  for (const task of [state.chapter.task, state.chapter.challenge].filter(Boolean))
    for (const key of ['answer', 'item', 'falseAccusations']) assert(!Object.hasOwn(task, key), `private task field ${key}`);
  for (const [i, question] of (state.chapter.questions || []).entries()) {
    assert(!Object.hasOwn(question, 'answer'), 'private quiz answer');
    if (!state.me?.progress?.[state.event.chapter]?.quiz?.[i]) assert(!Object.hasOwn(question, 'explanation'), 'unsubmitted quiz explanation');
  }
}
function project(client, incoming, kind) {
  publicContentOnly(incoming);
  const old = client.state;
  client.projection = reduceProjection(client.projection, incoming, { kind, allowEpoch: kind === 'full' });
  client.state = client.projection.state;
  if (client.state) {
    assert.equal(client.state.me.id, client.id, 'peer update cannot replace own identity');
    if (old?.event.phase === 'chapter' && client.state.event.phase === 'chapter' && old.event.chapter === 0 && client.state.event.chapter === 0) {
      assert(client.state.me.progress[0].step >= old.me.progress[0].step, 'peer/SSE update regressed own delivery');
      assert(client.state.me.progress[0].score >= old.me.progress[0].score, 'unexpected loss of confirmed delivery points');
    }
  }
}
async function connect(cookie, path, onState) {
  const controller = new AbortController(); controllers.push(controller);
  const response = await fetch(origin + path, { headers: { Cookie: cookie }, signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', ready;
  const first = new Promise(resolve => { ready = resolve; });
  const pump = (async () => {
    try {
      while (!closing) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          const data = block.split('\n').find(line => line.startsWith('data: '));
          if (data && !block.startsWith('event: takeover')) { onState?.(JSON.parse(data.slice(6))); frameCount++; ready(); }
        }
      }
    } catch (error) { if (!closing && error.name !== 'AbortError') errors.push(error.message); }
    finally { ready(); }
  })(); pendingPumps.push(pump); await first;
}
async function action(client, type, fields = {}) {
  const body = { type, requestId: randomUUID(), expectedChapter: client.state.event.chapter,
    ...(type === 'task' ? { expectedStep: client.state.me.progress[0].step, expectedStage: client.state.chapter.task?.stage || null } : {}),
    ...(type === 'move' ? { movementSequence: ++client.movementSequence } : {}), ...fields };
  const { data } = await http('/api/action', body, client.cookie, client.client);
  project(client, data.patch || data.state || data, data.patch ? 'patch' : type === 'move' ? 'move' : 'full');
  return data.result;
}
async function host(type) {
  await http('/api/host/action', { type, reason: 'Isolated Move Day developer review', requestId: randomUUID() }, hostCookie);
}
async function status() {
  const { data } = await http('/api/host/state', undefined, hostCookie);
  const summary = { phase: data.event.phase, chapter: data.event.chapter + 1, connectedParticipants: data.connections.length, simulatedParticipants: clients.length, roster: count, completedObjectives: data.event.contributions[0] };
  console.log('STATUS ' + JSON.stringify(summary)); return { summary, data };
}
async function walk(client, destination, stopDistance = 0.5) {
  assert(isWalkable(destination), 'review destination must be walkable');
  const began = Date.now(); let path = findPath(client.state.me.position, destination), last = Date.now() - 100;
  assert(path, 'no path to review destination');
  while (!closing && Math.hypot(client.state.me.position.x - destination.x, client.state.me.position.y - destination.y) > stopDistance) {
    assert(Date.now() - began < 60000, 'navigation exceeded60seconds');
    while (path.length > 1 && waypointReached(client.state.me.position, path[0])) path.shift();
    const now = Date.now(), elapsed = Math.min(.25, (now - last) / 1000); last = now;
    const next = stepToward(client.state.me.position, path[0], client.state.rules.moveSpeed, elapsed);
    await action(client, 'move', next);
    await sleep(100);
  }
}
async function arrange(place) {
  await Promise.all(clients.map((client, i) => {
    const target = place === 'district' ? (client.state.chapter.task?.target || client.state.chapter.locations[0])
      : place === 'optional' ? client.state.chapter.locations[1]
      : place === 'depot' ? { x: 110 + i % 11 * 10, y: 160 + Math.floor(i / 11) * 6 }
      : place === 'square' ? { x: 550 + i % 11 * 10, y: 350 + Math.floor(i / 11) * 6 }
      : i % 2 === 0 ? { x: 160 + 140 * (i / Math.max(1, clients.length - 1)), y: 160 }
      : { x: 230, y: 60 + 100 * (i / Math.max(1, clients.length - 1)) };
    return walk(client, target);
  }));
  console.log(`ARRANGEMENT ${place}: ${clients.length} connected simulated neighbors walked through the normal movement API.`);
}
async function waitForChapter() {
  const started = Date.now();
  while (clients.some(client => client.state.event.phase !== 'chapter')) {
    assert(Date.now() - started < 15000, 'normal countdown did not open chapter'); await sleep(100);
  }
}
async function deliveries(client) {
  const plan = [[0,0],[1,1],[2,0]];
  while (!closing && !client.state.me.progress[0].complete) {
    assert.equal(client.state.event.phase, 'chapter'); assert.equal(client.state.event.chapter, 0);
    const progress = client.state.me.progress[0], task = client.state.chapter.task;
    await walk(client, task.target, 25);
    const choice = task.stage === 'load' ? plan[progress.step][0] : task.stage === 'route' ? plan[progress.step][1] : 0;
    await action(client, 'task', { choice });
  }
  const r = client.state.me.progress[0];
  assert.equal(r.score, 45); assert.equal(r.primary, 27); assert.equal(r.step, 3); assert.equal(r.complete, true);
  assert.deepEqual(client.state.me.inventory, { parts: 0, filters: 3, food: 1, cable: 1 });
  assert(Object.values(r.reserve).every(quantity => quantity === 6));
}
async function close() {
  if (closePromise) return closePromise;
  closing = true; input?.close(); controllers.forEach(controller => controller.abort());
  closePromise = (async () => { await Promise.allSettled(pendingPumps); await app?.close(); })();
  return closePromise;
}
async function command(line) {
  const [word, argument] = line.trim().split(/\s+/);
  if (!word || closing) return;
  if (word === 'quit') return close();
  if (['square','depot','spread','district','optional'].includes(word)) { await arrange(word); return; }
  if (word === 'contribute') {
    const n = Number(argument || 1);
    assert(Number.isInteger(n) && n >= 1 && n <= clients.length, 'Choose one to all simulated neighbors');
    const current = await status(); assert.equal(current.summary.phase, 'finale', 'Contributions require the finale');
    const waitingAt = Date.now();
    while (clients.some(client => client.state.event.phase !== 'finale')) {
      assert(Date.now() - waitingAt < 15000, 'Finale projection did not arrive'); await sleep(100);
    }
    const selected = clients.filter(client => !current.data.event.finale.contributors.includes(client.id)).slice(0, n);
    assert.equal(selected.length, n, 'Not enough neighbors remain to contribute');
    const { operationalAudit: beforeOperations, ...before } = (await http('/api/host/export', undefined, hostCookie)).data;
    await Promise.all(selected.map(client => action(client, 'finale')));
    const { operationalAudit: afterOperations, ...after } = (await http('/api/host/export', undefined, hostCookie)).data;
    assert.deepEqual(after, before, 'Finale contributions must not change frozen scores or awards');
    console.log(`CONTRIBUTED ${selected.length}: existing neighbors used the normal finale API; frozen results unchanged.`);
    await status(); return;
  }
  if (word === 'repair') {
    const n = Number(argument || 5); assert(Number.isInteger(n) && n >= 1 && n <= clients.length, 'repair count must select1..all simulated neighbors');
    const current = await status(); assert.equal(current.summary.phase, 'chapter', 'repair requires an active chapter');
    await waitForChapter(); // A just-accepted resume can precede its next SSE projection.
    const selected = clients.filter(client => !client.state.me.progress[0].complete).slice(0, n);
    await Promise.all(selected.map(deliveries)); await status(); return;
  }
  if (['start','pause','resume'].includes(word)) await host(word);
  else if (word !== 'status') throw Error('Commands: square, depot, spread, district, optional, start, pause, resume, repair [count], contribute [count], status, quit.');
  await status();
}
try {
  origin = attach || await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', () => resolve(`http://127.0.0.1:${app.server.address().port}`)); });
  const primary = await http('/api/host/login', { token: attach ? process.env.MOVE_REVIEW_HOST_TOKEN : hostTokens[0] }); hostCookie = primary.cookie;
  if (!attach) {
    const backup = await http('/api/host/login', { token: hostTokens[1] });
    const display = await http('/api/presentation/login', { token: presentationToken });
    await connect(hostCookie, '/api/events?client=review-host-one');
    await connect(backup.cookie, '/api/events?client=review-host-two');
    await connect(display.cookie, '/api/events?presentation=1');
    await host('lobby');
  }
  for (let start = verify ? 1 : 2; start <= count; start += 5) {
    await Promise.all(Array.from({ length: Math.min(5, count - start + 1) }, async (_, offset) => {
      const n = start + offset, id = `review-${n}`, joined = await http('/api/join', { token: `move-review-${n}`, ...(attach ? { takeover: true } : {}) });
      const client = { id, cookie: joined.cookie, client: `bot-${n}`, movementSequence: 0, projection: createProjection(), state: null }; clients.push(client);
      await connect(client.cookie, `/api/events?client=${client.client}`, state => project(client, state, 'full'));
      assert(client.state); if (!attach) await action(client, 'setup', { character: n % 12, palette: n % 6, insects: false, settingsSequence: 1 });
    }));
    await sleep(260); // Login IP rate stays below the normal public limit.
  }
  clients.sort((a,b) => Number(a.id.slice(7)) - Number(b.id.slice(7)));
  const initial = await status(); assert.equal(initial.summary.connectedParticipants, clients.length + (attach ? 1 : 0));
  report.initialConnectedParticipants = initial.summary.connectedParticipants;
  if (verify) {
    await host('start'); const clock = await status();
    assert.equal(clock.data.event.phase, 'countdown'); assert(clock.data.event.remainingMs > 9000);
    await waitForChapter();
    const active = await status(); assert.equal(active.summary.connectedParticipants, count);
    report.concurrentParticipants = active.summary.connectedParticipants;
    await Promise.all(clients.map(deliveries));
    await sleep(700); // Receive subsequent peer/full projections after own accepted result.
    for (const client of clients) { assert.equal(client.state.me.progress[0].score, 45); assert.equal(client.state.players.length, count); }
    const final = await status(); assert.equal(final.summary.completedObjectives, count); assert.equal(errors.length, 0);
    const sorted = [...samples].sort((a,b) => a-b), quantile = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] || 0;
    Object.assign(report, { passed: true, completedObjectives: count, scoringSamples: samples.length, actionLatencyMs: { p50: quantile(.5), p95: quantile(.95), p99: quantile(.99) }, phase: final.summary.phase, frames: frameCount, scores: { perPlayer: 45, primaryValue: 27 }, inventoryPerPlayer: { parts: 0, filters: 3, food: 1, cable: 1 }, reservesConsumed: 0, answersExposed: false, peerUpdatesPreservedOwnProgress: true, humanVisualAcceptance: false });
    await close();
    report.finishedAt = new Date().toISOString();
    if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('VERIFIED ' + JSON.stringify(report));
  } else {
    if (!attach) {
      await arrange('depot');
      console.log(`PLAYER http://localhost:${app.server.address().port}/?invite=move-review-1`);
      console.log(`HOST ${origin}/host`);
      console.log(`PRIMARY TOKEN ${hostTokens[0]}`);
    } else console.log(`ATTACHED: ${clients.length} simulated identities reconnected through invitation takeover; human identity untouched. No position, score or progress assigned.`);
    console.log(`VISUAL REVIEW: ${clients.length} simulated neighbors; the human browser makes ${count} real connected participants. Bots remain idle until commanded. No objective completion is fabricated.`);
    console.log('Commands: square, depot, spread, district, optional, start, pause, resume, repair [count], contribute [count], status, quit. repair plays three real deliveries per selected bot.');
    input = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
    input.on('line', line => { sequence = sequence.then(() => command(line)).catch(error => console.log('COMMAND ERROR: ' + error.message)); });
    input.on('close', () => { if (!closing) console.log('Input closed; review remains available. SIGTERM stops this isolated server.'); });
    await status();
  }
} catch (error) {
  errors.push(error.message); report.passed = false; report.finishedAt = new Date().toISOString();
  await close();
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.error(error.stack); process.exitCode = 1;
}
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { void close(); });
