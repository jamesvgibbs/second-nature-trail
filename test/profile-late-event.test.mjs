import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Engine } from '../engine.mjs';
import { reconstructProfileState,runLateEventProfile } from '../scripts/profile-late-event.mjs';
function journal() {
  let now=Date.now();const e=new Engine({now:()=>now});
  for(let n=0;n<2;n++){const id=`profile-${n}`;e.addPlayer(id,id);e.dispatch(id,{type:'setup',character:0,palette:0,insects:false,requestId:`setup-${n}`});}
  e.host('test',{type:'lobby',reason:'Fixture',requestId:'lobby'});
  e.host('test',{type:'start',reason:'Fixture',requestId:'start'});
  now+=10000;e.tick();e.host('test',{type:'endScoring',reason:'Fixture',requestId:'end'});
  const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
  return {contentHash:e.state.contentHash,seed:e.state.seed,snapshotAt:e.state.snapshot.at,snapshot:structuredClone(e.state.snapshot),snapshotHash:hash(e.state.snapshot),requests:structuredClone(e.state.requests),requestsHash:hash(e.state.requests)};
}
test('late-event fixture retains captured history and labels reconstructed state without mutating evidence',()=>{
  const j=journal(),before=JSON.stringify(j),s=reconstructProfileState(j,1000);
  assert.equal(JSON.stringify(j),before);
  assert.equal(s.phase,'chapter');assert.equal(s.chapter,7);assert.equal(s.deadline,241000);
  assert.equal(s.snapshot,null);assert.equal(s.broadcast.startsWith('SYNTHETIC'),true);
  assert.deepEqual(s.requests,j.requests);assert.deepEqual(s.actions,j.snapshot.actions);
  assert.equal(Object.keys(s.players).length,2);
  s.actions.push({type:'changed'});assert.equal(JSON.stringify(j),before);
  j.requests.tampered={};assert.throws(()=>reconstructProfileState(j),/hashes differ/);
});
test('small synthetic profile exercises durable routing with two operators/display and reports measured stages',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'trail-profile-test-')),input=join(dir,'journal.json'),output=join(dir,'profile.json'),cpu=join(dir,'cpu.cpuprofile');
  writeFileSync(input,JSON.stringify(journal()));
  const beforeClone=globalThis.structuredClone,beforeStringify=JSON.stringify;
  try {
    const result=await runLateEventProfile({journalPath:input,outputPath:output,waves:1,warmupWaves:0,waveGapMs:300,movement:true,cpuProfilePath:cpu,label:'tiny fixture test'});
    assert.equal(result.players,2);assert.equal(result.operatorConnections,2);assert.equal(result.presentationConnections,1);
    assert.equal(result.scoringLatencyMs.count,2);assert.deepEqual(result.errors,[]);
    assert.equal(result.streams.length,5);assert(result.streams.every(s=>s.frames>=1&&!s.ended));
    assert(result.stageTimingMs.batchBackupClone.count>=1);
    assert(result.stageTimingMs.commandCheckpointClone.count>=2);
    assert(result.stageTimingMs.stateSerialization.count>=1);
    assert(result.stageTimingMs.sqliteStateWrite.count>=1);
    assert(result.batches.some(b=>b.commands===2&&b.ending==='COMMIT'));
    assert(JSON.parse(readFileSync(cpu)).nodes.length>0);
    assert.equal(JSON.parse(readFileSync(output)).candidate,'tiny fixture test');
  } finally {assert.equal(globalThis.structuredClone,beforeClone);assert.equal(JSON.stringify,beforeStringify);rmSync(dir,{recursive:true,force:true});}
});
