import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync,readFileSync,statSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { exportAudit } from '../scripts/export-audit.mjs';
test('audit exporter reads committed state only, hashes exact evidence and refuses overwrite/unfrozen data',()=>{
  const dir=mkdtempSync(join(tmpdir(),'trail-audit-')),source=join(dir,'event.sqlite'),out=join(dir,'audit.json');
  const db=new DatabaseSync(source);
  db.exec('CREATE TABLE game(id INTEGER PRIMARY KEY,state TEXT NOT NULL);CREATE TABLE sessions(secret TEXT);INSERT INTO sessions VALUES(\'do-not-export\')');
  const snapshot={at:1,seed:'seed',contentHash:'content',players:[]},state={snapshot,phase:'finale',seed:'seed',contentHash:'content',requests:{'p:r':{fingerprint:'{}',result:{ok:true}}},audit:[]};
  db.prepare('INSERT INTO game VALUES(1,?)').run(JSON.stringify(state));
  try {
    exportAudit(source,out,{sourceCommit:'fixture'});
    const bytes=readFileSync(out,'utf8'),evidence=JSON.parse(bytes);
    assert.equal(evidence.sourceCommit,'fixture');
    assert.equal(evidence.snapshotHash,createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'));
    assert.equal(evidence.requestsHash,createHash('sha256').update(JSON.stringify(state.requests)).digest('hex'));
    assert(!bytes.includes('do-not-export'));
    assert.equal(statSync(out).mode&0o777,0o600);
    assert.throws(()=>exportAudit(source,out),/EEXIST/);
    assert.equal(readFileSync(out,'utf8'),bytes);
    state.phase='chapter';state.snapshot=null;
    db.prepare('UPDATE game SET state=? WHERE id=1').run(JSON.stringify(state));
    assert.throws(()=>exportAudit(source,join(dir,'no.json')),/frozen/);
    assert.equal(existsSync(join(dir,'no.json')),false);
    assert.equal(JSON.parse(db.prepare('SELECT state FROM game').get().state).phase,'chapter');
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
