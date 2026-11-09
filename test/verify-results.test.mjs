import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyResults, auditPhases } from '../scripts/verify-results.mjs';

const eventNames=['Top hoarder','Trailblazer','Neighborhood hero','Human intelligence champion','Easter egg hunter','Master trader','All-round survivor'];
const rules={version:'trail-0.3.0-draft',values:{parts:5,filters:4,food:3,cable:6},chapterMaxima:Array(8).fill(95),tradeMaxQuantity:3,storageLimit:12,reservePerChapter:6,cargoPlans:[{parts:2},{parts:1,food:2},{cable:2}],taskPoints:20,spatialTaskPoints:10,quizPoints:10,assistPoints:5,challengePoints:10,mistakePenalty:5,targetHitsPerSite:6,chapterMs:300000,countdownMs:10000,breakMs:120000,finaleMs:240000};
const empty=()=>({score:0,primary:0,mistakes:0,step:0,complete:false,timeMs:null,secret:false,assists:[],quiz:[null,null],targetHits:0,budget:0});
const unawarded=category=>({category,playerId:null,name:null,metric:null,secondary:null,reason:'No qualifying recipient',draw:null});
function fixture() {
  const players=['alpha','beta'].map(id=>({id,name:id,items:[],mystery:false,progress:Array.from({length:8},empty),metrics:{inventoryValue:0,completed:1,total:51,timeMs:100,assists:0,assistRecipients:0,correct:0,secrets:0,traders:0,suppliedConsumed:0,mean:51/95*100}}));
  const actions=[{type:'phase',phase:'chapter',chapter:0,boundary:10000,at:10000}];
  for(const p of players) {
    Object.assign(p.progress[0],{score:51,primary:30,step:3,complete:true,timeMs:100});
    actions.push({type:'join',playerId:p.id,allocation:[],at:0});
    for(let n=0;n<3;n++)actions.push({type:'delivery',playerId:p.id,chapter:0,value:10,at:100,step:n+1});
  }
  const awards=[
    {category:'Move day mayhem',playerId:'beta',name:'beta',metric:30,secondary:0,reason:'Qualified',draw:'42f06f4cf17e39060de2a1cb157125666d3697488e4bb421f0702af1e687977b',chapter:0},
    {category:'Top hoarder',playerId:'alpha',name:'alpha',metric:0,secondary:1,reason:'Qualified',draw:'a2633563ff648e00f0cb25df96d4a31903af3fa9eb73de367bc952c09bfb4e10'},
    ...eventNames.slice(1).map(unawarded),
  ];
  return {at:500000,version:rules.version,contentHash:'fixture-content',seed:'fixture',ranked:[true,...Array(7).fill(false)],rules:structuredClone(rules),players,actions,awards,audit:[]};
}
function bindJournal(snapshot,requests={}) {
  return {snapshot:structuredClone(snapshot),snapshotHash:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),snapshotAt:snapshot.at,contentHash:snapshot.contentHash,seed:snapshot.seed,requestsHash:createHash('sha256').update(JSON.stringify(requests)).digest('hex'),phase:'finale',capturedAt:new Date(snapshot.at+1).toISOString(),requests};
}
test('independent seeded tie selects known beta; used winner excluded and exhausted categories stay empty',()=>{
  const result=verifyResults(fixture());
  assert.equal(result.rankingPass,true,JSON.stringify(result.rankingErrors));
  assert.equal(result.recordedOutcomeReplayPass,true,JSON.stringify(result.actionErrors));
  assert.equal(result.inventoryReplayPass,true);
  assert.equal(result.expectedAwards[0].playerId,'beta');
  assert.equal(result.expectedAwards[1].playerId,'alpha');
  assert(result.expectedAwards.slice(2).every(a=>a.playerId===null));
  assert.equal(result.rankings[1].rows.find(p=>p.id==='beta').eligible,false);
  assert.equal(result.fifteenQualifyingDistinctRecipients,false);
  assert.equal(verifyResults(fixture(),{requireFifteen:true}).rankingPass,false);
});
test('chapter qualification beats a higher incomplete primary; secondary metric precedes seeded draw',()=>{
  const s=fixture();
  s.players[1].progress[0].complete=false;
  s.players[1].progress[0].primary=999;
  assert.equal(verifyResults(s).expectedAwards[0].playerId,'alpha');
  const t=fixture();
  t.players[1].progress[0].mistakes=1;
  assert.equal(verifyResults(t).expectedAwards[0].playerId,'alpha');
});
test('unranked chapter contributes no prize, quiz, discovery or aggregate score',()=>{
  const s=fixture();
  Object.assign(s.players[0].progress[7],{score:900,primary:900,complete:true,secret:true,quiz:[{correct:true},{correct:true}],assists:['beta']});
  const r=verifyResults(s);
  assert.equal(r.independentMetrics.alpha.total,51);
  assert.equal(r.independentMetrics.alpha.correct,0);
  assert.equal(r.independentMetrics.alpha.secrets,0);
  assert.equal(r.independentMetrics.alpha.assists,0);
  assert.equal(r.expectedAwards.length,8);
  assert.equal(r.rankingPass,true);
});
test('mutated award, derived metric and duplicated winner cannot pass',()=>{
  const s=fixture();s.awards[0].playerId='alpha';
  assert.equal(verifyResults(s).rankingPass,false);
  const t=fixture();t.players[0].metrics.total=999;
  assert.equal(verifyResults(t).rankingPass,false);
  const u=fixture();u.awards[1].metric=99;
  assert.equal(verifyResults(u).rankingPass,false);
});
test('inventory replay validates first-transfer consumed provenance and rejects forged supplier',()=>{
  const s=fixture();
  const a={id:'item-a',kind:'parts',supplier:null,traded:false},b={id:'item-b',kind:'food',supplier:null,traded:false};
  s.actions.find(x=>x.type==='join'&&x.playerId==='alpha').allocation=[a];
  s.actions.find(x=>x.type==='join'&&x.playerId==='beta').allocation=[b];
  s.actions.push({type:'tradeCompleted',tradeId:'t',from:'alpha',to:'beta',give:['item-a'],receive:['item-b'],chapter:0}, {type:'consume',playerId:'alpha',itemId:'item-b',kind:'food',source:'inventory',chapter:0}, {type:'qualifyingTrade',supplier:'beta',recipient:'alpha',itemId:'item-b',chapter:0});
  s.players[1].items=[{...a,supplier:'alpha',traded:true}];
  assert.equal(verifyResults(s).inventoryReplayPass,true);
  s.actions.at(-1).supplier='alpha';
  assert.equal(verifyResults(s).inventoryReplayPass,false);
  s.actions.at(-1).supplier='beta';s.players[1].items[0].traded=false;
  assert.equal(verifyResults(s).inventoryReplayPass,false);
});
test('repeated barter removes supplier eligibility',()=>{
  const s=fixture();
  const a={id:'a',kind:'parts',supplier:null,traded:false},b={id:'b',kind:'food',supplier:null,traded:false};
  s.actions.find(x=>x.type==='join'&&x.playerId==='alpha').allocation=[a];
  s.actions.find(x=>x.type==='join'&&x.playerId==='beta').allocation=[b];
  s.actions.push({type:'tradeCompleted',tradeId:'one',from:'alpha',to:'beta',give:['a'],receive:['b'],chapter:0},{type:'tradeCompleted',tradeId:'two',from:'beta',to:'alpha',give:['a'],receive:['b'],chapter:0},{type:'consume',playerId:'alpha',itemId:'a',kind:'parts',source:'inventory',chapter:0});
  s.players[1].items=[{...b,traded:true,supplier:null}];
  assert.equal(verifyResults(s).inventoryReplayPass,true);
  s.actions.push({type:'qualifyingTrade',supplier:'beta',recipient:'alpha',itemId:'a',chapter:0});
  assert.equal(verifyResults(s).inventoryReplayPass,false);
});
test('bound journal supplies missing mystery success and tampered binding fails closed',()=>{
  const s=fixture();s.players[0].mystery=true;
  for(let c=0;c<8;c++) {s.players[0].progress[c].secret=true;s.actions.push({type:'secret',playerId:'alpha',chapter:c});}
  assert(verifyResults(s).evidenceGaps.some(g=>g.includes('mystery')));
  const requests={'alpha:req':{fingerprint:JSON.stringify({type:'mystery',expectedChapter:7,answer:'NEIGHBOR',requestId:'req'}),result:{ok:true,correct:true}}};
  const j=bindJournal(s,requests);
  const r=verifyResults(s,{journal:j});
  assert.equal(r.journalBound,true);
  assert(!r.evidenceGaps.some(g=>g.includes('mystery')));
  for(const field of ['seed','contentHash','snapshotAt','snapshotHash','requestsHash','phase']) {
    const changed=structuredClone(j);changed[field]='tampered';
    assert.equal(verifyResults(s,{journal:changed}).recordedOutcomeReplayPass,false,field);
  }
  const alteredRequests=structuredClone(j);alteredRequests.requests['alpha:req'].result.correct=false;
  assert.equal(verifyResults(s,{journal:alteredRequests}).journalBound,false);
  const changed=structuredClone(j);changed.snapshot.players[0].mystery=false;
  assert.equal(verifyResults(s,{journal:changed}).journalBound,false);
});
test('missing request success cannot manufacture mystery evidence; accepted success cannot disappear',()=>{
  const s=fixture();s.players[0].mystery=true;
  const j=bindJournal(s,{'alpha:r':{fingerprint:JSON.stringify({type:'mystery',expectedChapter:7,requestId:'r'}),result:{ok:true,correct:false}}});
  assert(verifyResults(s,{journal:j}).evidenceGaps.some(g=>g.includes('mystery')));
  const t=fixture();
  const k=bindJournal(t,{'alpha:r':{fingerprint:JSON.stringify({type:'mystery',expectedChapter:7,requestId:'r'}),result:{ok:true,correct:true}}});
  assert.equal(verifyResults(t,{journal:k}).recordedOutcomeReplayPass,false);
});
function phaseReport() {
  const phaseSamples=[];
  for(const client of [...Array.from({length:100},(_,i)=>`load-player-${i}`),'operator-one','operator-two','presentation']) {
    let deadline=1010000;
    function emit(phase){phaseSamples.push({client,phase,previousDeadline:deadline,receivedAt:deadline+200,serverTime:deadline+150,arrivalLagMs:200});}
    for(let c=0;c<8;c++){emit('chapter');deadline+=c===0?290000:300000;emit('brag');deadline+=120000;}
    emit('finale');deadline+=240000;emit('awards');
  }
  return {phaseSamples};
}
test('phase audit requires all 103 identities and 18 scheduled boundaries each',()=>{
  const r=auditPhases(phaseReport(),rules);
  assert.equal(r.pass,true,JSON.stringify(r.errors));
  assert.equal(r.observations,1854);
  assert.equal(r.maxLagMs,200);
  const missing=phaseReport();missing.phaseSamples=missing.phaseSamples.filter(s=>s.client!=='operator-two');
  assert.equal(auditPhases(missing,rules).pass,false);
  const skipped=phaseReport();skipped.phaseSamples.splice(5,1);
  assert.equal(auditPhases(skipped,rules).pass,false);
});
test('phase audit rejects negative lag, >1s, inconsistent timestamps and shifted schedules',()=>{
  for(const [field,value] of [['receivedAt',1009999],['receivedAt',1011001],['arrivalLagMs',0],['previousDeadline',1010001]]) {
    const report=phaseReport();report.phaseSamples[0][field]=value;
    assert.equal(auditPhases(report,rules).pass,false,field);
  }
});

test('consumed item IDs cannot be allocated again and altered scoring outcomes are detected',()=>{
  const s=fixture();
  const item={id:'spent',kind:'parts',supplier:null,traded:false};
  s.actions.push({type:'join',playerId:'alpha',allocation:[item]}, {type:'consume',playerId:'alpha',source:'inventory',itemId:'spent',kind:'parts',chapter:0}, {type:'join',playerId:'alpha',allocation:[item]});
  s.players[0].items=[item];
  assert.equal(verifyResults(s).inventoryReplayPass,false);
  const t=fixture();t.players[0].progress[0].score++;
  assert.equal(verifyResults(t).recordedOutcomeReplayPass,false);
});
test('legacy separate clock reads remain explicitly qualified instead of claiming exact timing',()=>{
  const s=fixture();
  s.actions.filter(a=>a.type==='delivery'&&a.step===3).forEach(a=>a.at++);
  const r=verifyResults(s);
  assert.equal(r.recordedOutcomeReplayPass,true);
  assert.equal(r.fullActionReconciliationPass,false);
  assert(r.objectiveTimeObservations.every(o=>o.logDelayMs===1));
  assert(r.evidenceGaps.some(g=>g.includes('separate clock read')));
});

test('exact completion records remove legacy timing gap and reject duplicate or inconsistent durations',()=>{
  const s=fixture();
  for(const p of s.players)s.actions.push({type:'objectiveCompleted',playerId:p.id,chapter:0,at:100,completedAt:100,chapterOpenedAt:0,timeMs:100});
  const r=verifyResults(s);
  assert.equal(r.recordedOutcomeReplayPass,true,JSON.stringify(r.actionErrors));
  assert.equal(r.fullActionReconciliationPass,true);
  assert(r.objectiveTimeObservations.every(o=>o.source==='objectiveCompleted'));
  const duplicate=structuredClone(s);duplicate.actions.push(structuredClone(duplicate.actions.at(-1)));
  assert.equal(verifyResults(duplicate).recordedOutcomeReplayPass,false);
  for(const [field,value]of[['timeMs',101],['completedAt',101],['chapterOpenedAt',-1],['at',101],['playerId','unknown']]){
    const mutated=structuredClone(s);mutated.actions.at(-1)[field]=value;
    assert.equal(verifyResults(mutated).recordedOutcomeReplayPass,false,field);
  }
  const paused=structuredClone(s);paused.audit.push({type:'pause'});
  const completion=paused.actions.at(-1);completion.completedAt=completion.at=30100;completion.chapterOpenedAt=30000;
  assert.equal(verifyResults(paused).fullActionReconciliationPass,true);
});
