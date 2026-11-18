import test from 'node:test';import assert from 'node:assert/strict';import {awaitReviewSetup,createReviewHostQueue}from'../scripts/review-setup.mjs';
const ready={event:{phase:'paused'},players:[{id:'human',setup:true}],connections:['human']};
test('manual pause cancels auto-play even when its state read was already pending',async()=>{let current=true,resolveRead,resumes=0;const wait=awaitReviewSetup({readState:()=>new Promise(resolve=>resolveRead=resolve),isCurrent:()=>current,humanId:'human',resume:async()=>{resumes++;},pause:async()=>{}});current=false;resolveRead(ready);assert.equal(await wait,false);assert.equal(resumes,0);});
test('auto-play requires both human setup and the live lease, then passes its cancellation guard to the host queue',async()=>{let reads=0,resumes=0,guard;const result=await awaitReviewSetup({readState:async()=>++reads===1?{...ready,connections:[]}:ready,isCurrent:()=>true,humanId:'human',resume:async valid=>{guard=valid;resumes++;},pause:async()=>{}});assert.equal(result,true);assert.equal(reads,2);assert.equal(resumes,1);assert.equal(guard(),true);});

test('Pause waits for a dispatched automatic Resume before checking whether the event is already paused',async()=>{let phase='paused',finishResume,startedResume;const started=new Promise(r=>startedResume=r),calls=[];const send=createReviewHostQueue({readState:async()=>({event:{phase}}),send:async type=>{calls.push(type);if(type==='resume'){startedResume();await new Promise(r=>finishResume=r);phase='chapter';}else if(type==='pause')phase='paused';}});const resume=send('resume');await started;const pause=send('pause');assert.equal(phase,'paused','Resume has been sent but not committed');finishResume();await Promise.all([resume,pause]);assert.deepEqual(calls,['resume','pause']);assert.equal(phase,'paused');await send('pause');assert.deepEqual(calls,['resume','pause'],'Already-paused operation is idempotent after prior commands settle');});

test('finale launch waits for the complete connected roster and uses normal phase advances',async()=>{
 const {launchReviewFinale}=await import('../scripts/review-setup.mjs');let phase='paused',crowd=false;const calls=[],ids=Array.from({length:100},(_,i)=>'p'+i);
 const result=await launchReviewFinale({readState:async()=>({event:{phase,chapter:7,finale:{target:60}},players:ids.map(id=>({id,setup:true})),connections:crowd?ids:ids.slice(0,1)}),connectCrowd:async()=>{crowd=true;},host:async(type,fields,guard)=>{assert(guard());calls.push(type);phase=type==='resume'?'chapter':phase==='chapter'?'brag':'finale';},isCurrent:()=>true,expectedTarget:60,participantIds:ids});
 assert.equal(result,true);assert.equal(phase,'finale');assert.deepEqual(calls,['resume','advance','advance']);
});
test('cancelled or incomplete finale attendance cannot freeze scoring',async()=>{
 const {launchReviewFinale}=await import('../scripts/review-setup.mjs');let current=true,calls=0;
 assert.equal(await launchReviewFinale({readState:async()=>{throw Error('Cancelled launch must stop');},connectCrowd:async()=>{current=false;},host:async()=>calls++,isCurrent:()=>current,participantIds:['human']}),false);assert.equal(calls,0);
 await assert.rejects(launchReviewFinale({readState:async()=>({event:{phase:'paused',chapter:7},players:[{id:'human',setup:true}],connections:[]}),connectCrowd:async()=>{},host:async()=>calls++,isCurrent:()=>true,participantIds:['human']}),/every intended participant/);assert.equal(calls,0);
});

test('finale attendance race reports the actual frozen target without refreezing',async()=>{
 const {launchReviewFinale}=await import('../scripts/review-setup.mjs');let phase='brag',advances=0;
 await assert.rejects(launchReviewFinale({readState:async()=>({event:{phase,chapter:7,finale:{target:1}},players:[{id:'human',setup:true}],connections:['human']}),connectCrowd:async()=>{},host:async()=>{advances++;phase='finale';},isCurrent:()=>true,participantIds:['human'],expectedTarget:60}),/attendance changed/);assert.equal(advances,1);assert.equal(phase,'finale');
});
