import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('mixed HTTP event reconciles all eight earned objectives, mistakes, recovery and fifteen unique awards', {timeout:180000}, async () => {
  const dir=mkdtempSync(join(tmpdir(),'trail-mixed-regression-'));
  const reportPath=join(dir,'report.json'),sentinel=join(dir,'untouched.sqlite');
  writeFileSync(sentinel,'existing user game must not be opened');
  const child=spawn(process.execPath,['scripts/simulate-event.mjs',reportPath],{
    cwd:new URL('../',import.meta.url),env:{...process.env,SIM_PLAYERS:'24',DB_PATH:sentinel},stdio:['ignore','pipe','pipe'],
  });
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  try {
    const [code]=await once(child,'exit');assert.equal(code,0,stderr+stdout);
    const result=JSON.parse(readFileSync(reportPath,'utf8'));
    assert.equal(result.passed,true);assert.deepEqual(result.errors,[]);
    assert.equal(result.clockInjected,true);assert.equal(result.positionsAssigned,false);assert.equal(result.scoresSeeded,false);
    assert.equal(result.chapters.length,8);
    for(const chapter of result.chapters){assert.equal(chapter.completed,24);assert.equal(chapter.secretCount,24);assert.equal(chapter.challengeCount,24);assert.equal(chapter.firstPlayer.quiz[0].correct,false);assert.equal(chapter.quizFirstWrongImmutable,true);}
    assert.equal(result.independent.fullActionReconciliationPass,true);
    assert.equal(result.independent.fifteenQualifyingDistinctRecipients,true);
    assert.deepEqual(result.independent.evidenceGaps,[]);
    for(const id of ['normal-entry','concurrent-barter','pause-resume','cargo-route-consequences','sqlite-restart','timed-targeting','payment-cycles','reward-decisions','all-secrets-mystery','immutable-finale-awards-export']) assert(result.coverage.some(row=>row.id===id&&row.status==='verified'),id);
    assert(result.expectedRejections.length>=12);
    assert.equal(readFileSync(sentinel,'utf8'),'existing user game must not be opened');
  } finally {if(child.exitCode===null)child.kill('SIGTERM');rmSync(dir,{recursive:true,force:true});}
});
