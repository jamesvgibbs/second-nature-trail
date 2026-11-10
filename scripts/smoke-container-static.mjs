// Narrow packaging check. This does not replay capacity, gameplay or durability.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const exec = promisify(execFile), revision = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(revision || '')) throw Error('Usage: node scripts/smoke-container-static.mjs <full Git commit>');
const root = process.cwd(), short = revision.slice(0, 7), image = `second-nature-trail:${short}`;
const temporary = mkdtempSync(join(tmpdir(), 'trail-package-')), source = join(temporary, 'source');
const name = `trail-package-${short}-${process.pid}`, volume = `${name}-data`;
const prefix = resolve(`test-results/container-${short}-static`);
const report = { sourceCommit: revision, image, startedAt: new Date().toISOString(), scope: 'production startup and exact packaged/served asset bytes only', productionDeployed: false, network: 'disposable loopback HTTP, default Secure cookie configuration retained', checks: [], sourceHashes: {}, servedAssets: [], cleanup: [] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const command = async (file, args) => (await exec(file, args, { cwd: root, maxBuffer: 32 * 1024 * 1024 })).stdout.trim();
const docker = (...args) => command('docker', args);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const envfile = join(temporary, 'synthetic.env');
writeFileSync(envfile, `HOST_TOKENS=${randomBytes(32).toString('hex')},${randomBytes(32).toString('hex')}\nPRESENTATION_TOKEN=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
try {
  mkdirSync(source);
  await command('git', ['archive', '--format=tar', `--output=${join(temporary, 'source.tar')}`, revision]);
  await command('tar', ['-xf', join(temporary, 'source.tar'), '-C', source]);
  const runtime = ['server.mjs', 'engine.mjs', 'content.mjs', 'command-checkpoint.mjs', 'Dockerfile'];
  const assets = readdirSync(join(source, 'public'), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(source.length + 1)).sort();
  for (const path of [...runtime, ...assets]) report.sourceHashes[path] = hash(readFileSync(join(source, path)));
  report.backendMatchesDurabilityRevision = {};
  for (const path of runtime) {
    const prior = await exec('git', ['show', `9939a98:${path}`], { cwd: root, encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
    report.backendMatchesDurabilityRevision[path] = hash(prior.stdout) === report.sourceHashes[path];
    assert(report.backendMatchesDurabilityRevision[path], `${path} changed since durability validation; broaden verification before using this narrow smoke`);
  }
  const built = await exec('docker', ['build', '-t', image, '--label', `org.opencontainers.image.revision=${revision}`, source], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(prefix + '-build.log', built.stdout + built.stderr);
  const metadata = JSON.parse(await docker('image', 'inspect', '--format', '{{json .}}', image));
  report.imageId = metadata.Id; report.imageUser = metadata.Config.User;
  assert.equal(metadata.Config.Labels['org.opencontainers.image.revision'], revision);
  assert.equal(report.imageUser, 'node');
  await docker('volume', 'create', volume);
  await docker('run', '-d', '--name', name, '--env-file', envfile, '-v', `${volume}:/app/data`, '-p', '127.0.0.1::4173', image);
  let origin;
  for (let i = 0; i < 100; i++) {
    const state = JSON.parse(await docker('inspect', '--format', '{{json .State}}', name));
    assert.notEqual(state.Status, 'exited', 'production startup exited');
    try {
      const binding = await docker('port', name, '4173/tcp');
      assert(binding.startsWith('127.0.0.1:'));
      origin = 'http://' + binding;
      const response = await fetch(origin + '/health');
      if (response.status === 200) { report.health = await response.json(); break; }
    } catch {}
    await wait(100);
  }
  assert(report.health, 'health never became ready');
  report.loopbackOrigin = origin;
  assert.equal(await docker('exec', name, 'id', '-u'), '1000');
  assert.equal(await docker('exec', name, 'node', '--version'), 'v24.20.0');
  const files = [...runtime.filter(path => path !== 'Dockerfile'), ...assets];
  const packaged = JSON.parse(await docker('exec', name, 'node', '--input-type=module', '-e', "import{readFileSync}from'node:fs';import{createHash}from'node:crypto';console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))));", JSON.stringify(files)));
  for (const path of files) assert.equal(packaged[path], report.sourceHashes[path], `packaged bytes differ: ${path}`);
  report.checks.push('non-root production startup and exact image runtime/static hashes');
  for (const path of assets) {
    const route = path === 'public/index.html' ? '/' : '/' + path.slice(7);
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    const digest = hash(Buffer.from(await response.arrayBuffer()));
    assert.equal(digest, report.sourceHashes[path], `served bytes differ: ${path}`);
    const contentType = response.headers.get('content-type');
    if (/\.(mjs|js)$/.test(path)) assert(contentType.includes('javascript'), route);
    report.servedAssets.push({ path, route, sha256: digest, contentType });
  }
  report.checks.push('every tracked public asset served byte-for-byte with JavaScript module MIME types');
  await docker('stop', '--timeout', '3', name);
  report.stop = JSON.parse(await docker('inspect', '--format', '{{json .State}}', name));
  assert.equal(report.stop.ExitCode, 0);
  report.passed = true;
} catch (error) {
  report.passed = false; report.error = error.message; process.exitCode = 1;
} finally {
  try { const logs = await exec('docker', ['logs', name], { maxBuffer: 1024 * 1024 }); report.containerLogs = logs.stdout + logs.stderr; } catch {}
  try { await docker('rm', '-f', name); report.cleanup.push({ container: name, removed: true }); } catch { report.cleanup.push({ container: name, absent: true }); }
  try { await docker('volume', 'rm', volume); report.cleanup.push({ volume, removed: true }); } catch (error) { report.cleanup.push({ volume, error: error.message }); process.exitCode = 1; }
  rmSync(temporary, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, error: report.error, image, imageId: report.imageId, servedAssetCount: report.servedAssets.length, report: prefix + '.json' }, null, 2));
}
