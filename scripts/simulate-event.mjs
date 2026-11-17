// Explicit synthetic-clock behavioral simulation, never normal pacing/capacity evidence.
// All player/host mutations use HTTP; only the server clock is injected.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createGameServer } from '../server.mjs';
import { CHAPTERS, RULES, SPATIAL_CHAPTERS } from '../content.mjs';
import { findPath } from '../public/world.mjs';
import { nextWaypoint } from './load-navigation.mjs';
import { solveRoute } from './load-routing.mjs';
import { exportAudit } from './export-audit.mjs';
import { verifyResults } from './verify-results.mjs';

const out = resolve(process.argv[2] || 'test-results/simulation-mixed-latest.json');
const dir = mkdtempSync(join(tmpdir(), 'trail-mixed-simulation-'));
const dbPath = join(dir, 'event.sqlite');
const count = Number(process.env.SIM_PLAYERS || 24);
assert(Number.isInteger(count) && count >= 20 && count <= 100);
const sourceCommit = execFileSync('git', ['rev-parse','HEAD'], {cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim();
const files = ['engine.mjs','server.mjs','content.mjs','command-checkpoint.mjs','public/world.mjs','scripts/simulate-event.mjs','scripts/verify-results.mjs'];
const sourceHashes = Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(new URL('../'+f,import.meta.url))).digest('hex')]));
let time = Date.now() - 7200000, app, origin, sequence=0, hostCookies=[], stopped=false;
const hostTokens = ['mixed-primary-operator-000000000000','mixed-backup-operator-0000000000000'];
const presentationToken='mixed-safe-presentation-00000000000';
const players=[], streams=[], coverage=[], expectedRejections=[];
const report={label:'Synthetic-clock24-player mixed-decision HTTP/SSE event; not normal pacing, full-capacity, browser or human acceptance',sourceCommit,sourceHashes,node:process.version,startedAt:new Date().toISOString(),players:count,clockInjected:true,positionsAssigned:false,scoresSeeded:false,coverage,expectedRejections,chapters:[],errors:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(){app=createGameServer({dbPath,hostTokens,presentationToken,demo:false});app.engine.now=()=>time;origin=await new Promise(r=>app.server.listen(0,'127.0.0.1',()=>r(`http://127.0.0.1:${app.server.address().port}`)));}
async function http(path,body,cookie,client){const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...(client?{'x-trail-client':client}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function stream(cookie,path){const controller=new AbortController();streams.push(controller);const r=await fetch(origin+path,{headers:{Cookie:cookie},signal:controller.signal});assert.equal(r.status,200);const reader=r.body.getReader();await reader.read();void(async()=>{try{while(!(await reader.read()).done){}}catch(e){if(e.name!=='AbortError'&&!stopped)report.errors.push(e.message);}})();return controller;}
async function refresh(p){const r=await http('/api/state',undefined,p.cookie);assert.equal(r.status,200);p.state=r.data;assert.equal(p.state.me.id,p.id);const c=p.state.chapter;if(c){for(const t of [c.task,c.challenge].filter(Boolean))for(const k of ['answer','item','falseAccusations'])assert(!Object.hasOwn(t,k));for(const [i,q]of(c.questions||[]).entries()){assert(!Object.hasOwn(q,'answer'));if(!p.state.me.progress[p.state.event.chapter].quiz[i])assert(!Object.hasOwn(q,'explanation'));}}return p.state;}
const allRefresh=()=>Promise.all(players.map(refresh));
async function host(type,extra={},who=0){const r=await http('/api/host/action',{type,reason:'Isolated synthetic-clock behavioral simulation',requestId:`host-${++sequence}`,...extra},hostCookies[who]);assert.equal(r.status,200,JSON.stringify(r.data));await allRefresh();return r.data;}
function body(p,type,fields={}){const c=p.state.event.chapter,t=p.state.chapter?.task;return{type,requestId:`mixed-${++sequence}`,expectedChapter:c,...(type==='task'?{expectedStep:p.state.me.progress[c].step,expectedStage:t?.stage||null,...(c===4?{expectedRound:t.round}:{})}:{}),...(type==='move'?{movementSequence:++p.moveSeq}:{}),...fields};}
async function send(p,a,{reject}={}){const wait=Math.max(0,(p.nextRequestAt||0)-Date.now());p.nextRequestAt=Date.now()+wait+45;if(wait)await sleep(wait);const r=await http('/api/action',a,p.cookie,p.id);if(reject){assert(r.status>=400,JSON.stringify(r));assert.match(r.data.error,reject);expectedRejections.push({type:a.type,error:r.data.error});}else assert.equal(r.status,200,JSON.stringify({player:p.id,action:a,error:r.data}));await refresh(p);return r;}
const act=(p,type,fields,options)=>send(p,body(p,type,fields),options);
async function walk(destinations){let guard=0;while(true){const moving=players.filter((p,i)=>destinations[i]&&Math.hypot(p.state.me.position.x-destinations[i].x,p.state.me.position.y-destinations[i].y)>25);if(!moving.length)return;assert(++guard<50,'movement did not converge');time+=1000;await Promise.all(moving.map(p=>{const d=destinations[players.indexOf(p)],path=findPath(p.state.me.position,d);assert(path);return act(p,'move',nextWaypoint(p.state.me.position,path)||d);}));}}
const walkTask=()=>walk(players.map(p=>p.state.chapter.task?.target||CHAPTERS[p.state.event.chapter].locations[0]));
async function batchTask(choice){time+=RULES.taskCooldownMs;await allRefresh();await Promise.all(players.filter(p=>!p.state.me.progress[p.state.event.chapter].complete).map((p,i)=>act(p,'task',choice(p,i))));}
function mark(id,assertions){coverage.push({id,status:'verified',assertions});}
async function disconnectStreams(){for(const s of streams)s.abort();streams.length=0;await sleep(20);}
async function restart(){await allRefresh();const before=players.map(p=>structuredClone(p.state.me));const epoch=players[0].state.projectionEpoch;await disconnectStreams();await app.close();await boot();for(const p of players){p.moveSeq=0;await stream(p.cookie,`/api/events?client=${p.id}`);await refresh(p);assert.deepEqual(p.state.me.progress,before[players.indexOf(p)].progress);assert.deepEqual(p.state.me.inventory,before[players.indexOf(p)].inventory);}assert.notEqual(players[0].state.projectionEpoch,epoch);mark('sqlite-restart',['same player cookies accepted','all progress and inventory preserved','fresh projection epoch','no position/score fixture assignment']);}
try{
 await boot();for(let i=0;i<count;i++)app.addInvitation(`mixed-${i}`,`Mixed neighbor ${i}`,`mixed-invite-${i}`);
 for(const token of hostTokens){const r=await http('/api/host/login',{token});assert.equal(r.status,200);hostCookies.push(r.cookie);await stream(r.cookie,`/api/events?client=operator-${hostCookies.length}`);}
 const display=await http('/api/presentation/login',{token:presentationToken});assert.equal(display.status,200);await stream(display.cookie,'/api/events?presentation=1');
 await host('lobby');
 for(let i=0;i<count;i++){const joined=await http('/api/join',{token:`mixed-invite-${i}`});assert.equal(joined.status,200);const p={id:`mixed-${i}`,n:i,cookie:joined.cookie,moveSeq:0};players.push(p);await stream(p.cookie,`/api/events?client=${p.id}`);await refresh(p);await act(p,'setup',{character:i%12,palette:i%6,insects:i%2===0,settingsSequence:1,settings:{control:i%2?'pointer':'keyboard',reducedMotion:i%2===0}});await sleep(50);}
 time+=1000;await Promise.all(players.map(p=>act(p,'move',{x:640,y:380})));
 for(const step of RULES.tutorial){if(step==='help')await Promise.all(players.map(p=>act(p,'help',{preset:0})));await Promise.all(players.map(p=>act(p,'tutorial',{step,...(step==='answer'?{choice:0}:{})})));}
 await Promise.all(players.map(p=>act(p,'ready')));assert(players.every(p=>p.state.me.ready));mark('normal-entry',['24 invitations+sessions+SSE','both operators and safe display','setup and earned tutorial readiness']);
 await host('start');assert.equal(players[0].state.event.phase,'countdown');time+=RULES.countdownMs;await host('broadcast',{message:'SYNTHETIC CLOCK: automated behavior check'});
 for(let c=0;c<8;c++){
  assert.equal(players[0].state.event.chapter,c);assert.equal(players[0].state.event.phase,'chapter');console.log(`CHAPTER ${c+1} mixed simulation`);
  await walk(players.map(()=>CHAPTERS[c].locations[0]));
  // All assist credit requires a later objective completion; no fabricated score.
  await Promise.all(players.map(p=>act(p,'help',{preset:0})));
  await Promise.all(players.map((p,i)=>act(p,'assist',{target:players[(i+1)%count].id})));
  // Wrong first quiz remains immutable even when a later attempt is correct.
  for(let index=0;index<2;index++)await Promise.all(players.map(p=>act(p,'quiz',{index,choice:p.n===0&&index===0?(CHAPTERS[c].questions[index].answer+1)%CHAPTERS[c].questions[index].options.length:CHAPTERS[c].questions[index].answer})));
  const saved=structuredClone(players[0].state.me.progress[c].quiz[0]);const score=players[0].state.me.progress[c].score;
  const retry=await act(players[0],'quiz',{index:0,choice:CHAPTERS[c].questions[0].answer});assert.equal(retry.data.result.first,false);assert.deepEqual(players[0].state.me.progress[c].quiz[0],saved);assert.equal(players[0].state.me.progress[c].score,score);
  if(c===0){
   const total=players.map(p=>p.state.me.inventory).reduce((s,x)=>s+Object.values(x).reduce((a,b)=>a+b,0),0);
   for(let i=0;i<count;i+=2){const a=players[i],b=players[i+1],r=await act(a,'tradeOffer',{target:b.id,give:{item:'parts',qty:1},receive:{item:'cable',qty:1}}),id=r.data.result.tradeId;await Promise.all([act(a,'tradeConfirm',{tradeId:id}),act(b,'tradeConfirm',{tradeId:id})]);}
   await allRefresh();assert.equal(players.reduce((s,p)=>s+Object.values(p.state.me.inventory).reduce((a,b)=>a+b,0),0),total);mark('concurrent-barter',['12 dual-confirm transfers','aggregate inventory conserved','later supplied-item consumption reconciled independently']);
   const before=structuredClone(players[0].state.me.progress[0]);await host('pause');time+=30000;await act(players[0],'task',{choice:0},{reject:/paused|frozen|running|closed/i});assert.deepEqual(players[0].state.me.progress[0],before);await host('resume',{},1);mark('pause-resume',['wrong-phase task rejected without mutation','backup operator resumes','pause duration excluded from objective timer']);
  }
  if(c===4){
   await walkTask();time=Math.max(time,players[0].state.chapter.task.actionAllowedAt);await allRefresh();
   const t=players[0].state.chapter.task;await act(players[0],'task',{choice:t.targets.findIndex(x=>!x.marked)});assert.equal(players[0].state.me.progress[c].targetHits,0);await act(players[0],'task',{choice:t.targets.findIndex(x=>x.marked)},{reject:/round|wait|resolved/});
   let rounds=0;while(players.some(p=>!p.state.me.progress[c].complete)){
    assert(++rounds<23);await walkTask();time=Math.max(time,...players.filter(p=>!p.state.me.progress[c].complete).map(p=>p.state.chapter.task.nextRoundAt+RULES.targetTelegraphMs));await allRefresh();
    await Promise.all(players.filter(p=>!p.state.me.progress[c].complete).map(p=>act(p,'task',{choice:p.state.chapter.task.targets.findIndex(x=>x.marked)})));
   }
   assert(players.every(p=>p.state.me.progress[c].targetHits===18));assert.equal(players[0].state.me.progress[c].primary,17);mark('timed-targeting',['18 correct signals per player across3 physical sites','one accepted miss costs primary','same-round retry rejected']);
  }else if(c===5){
   for(let step=0;step<3;step++){
    await walkTask();time=Math.max(time,...players.map(p=>p.state.chapter.task.opensAt));await allRefresh();
    if(step===0){const early=players[0].state.chapter.task.opensAt;assert(time>=early);}
    for(const p of players.filter(p=>!(step===2&&p.n===0)))await act(p,'task',{choice:step===0&&p.n===1?2:step===0&&p.n===2?1:0});
    if(step===2){time=Math.max(time,players[0].state.chapter.task.dueAt+1);await act(players[0],'task',{choice:0});}
    await allRefresh();
   }
   assert.equal(players[0].state.me.progress[c].primary,2);assert.equal(players[1].state.me.progress[c].primary,2);assert.equal(players[2].state.me.progress[c].primary,3);assert(players[2].state.me.progress[c].budget<players[3].state.me.progress[c].budget);mark('payment-cycles',['partial payment loses on-time credit','late full payment loses on-time credit','optional expense changes retained budget','all3 cycles completed']);
  }else{
   let iterations=0,wrong=false,duplicate=false;
   while(players.some(p=>!p.state.me.progress[c].complete)){
    assert(++iterations<35);await walkTask();time+=RULES.taskCooldownMs;await allRefresh();
    if(c!==0&&!wrong&&(!SPATIAL_CHAPTERS.includes(c)||players[0].state.chapter.task.stage==='decide')){
     const p=players[0],r=p.state.me.progress[c],step=r.step,old=structuredClone(r),task=p.state.chapter.task;
     const fields=c===7?{path:[task.source,task.destination]}:{choice:(CHAPTERS[c].tasks[step].answer+1)%CHAPTERS[c].tasks[step].options.length};
     const failed=await act(p,'task',fields);assert.equal(failed.data.result.correct,false);assert.equal(p.state.me.progress[c].step,old.step);assert.equal(p.state.me.progress[c].mistakes,old.mistakes+1);wrong=true;time+=RULES.taskCooldownMs;
    }
    await Promise.all(players.filter(p=>!p.state.me.progress[c].complete).map(async p=>{
     const t=p.state.chapter.task,r=p.state.me.progress[c];let fields;
     if(c===0)fields={choice:t.stage==='load'?r.step%3:t.stage==='route'?p.n%2:0};
     else if(c===7)fields={path:solveRoute(t)};
     else fields={choice:t.stage==='inspect'?0:t.stage==='redeem'?p.n%3:CHAPTERS[c].tasks[r.step].answer};
     if(c===0&&p.n===0&&!duplicate){duplicate=true;const a=body(p,'task',fields),before=r.step;const replies=await Promise.all([http('/api/action',a,p.cookie,p.id),http('/api/action',a,p.cookie,p.id)]);assert(replies.every(x=>x.status===200));assert.deepEqual(replies[0].data.result,replies[1].data.result);await refresh(p);assert.equal(p.state.me.progress[c].step,before);assert.equal(p.state.chapter.task.stage,'route');await send(p,{...a,choice:2},{reject:/different|request|reuse/i});}
     else await act(p,'task',fields);
    }));
   }
  }
  assert(players.every(p=>p.state.me.progress[c].complete));
  if(c===0){assert.equal(players[0].state.me.progress[c].primary,33);assert.equal(players[1].state.me.progress[c].primary,19);mark('cargo-route-consequences',['all three distinct cargo plans','protected vs shortcut primary33 vs19','same request concurrent retry only loads once','conflicting request reuse rejected']);await restart();}
  await walk(players.map(()=>CHAPTERS[c].locations[1]));time+=RULES.taskCooldownMs;
  await Promise.all(players.map(p=>act(p,'secret')));const clueCount=players[0].state.me.clues.length;await act(players[0],'secret');assert.equal(players[0].state.me.clues.length,clueCount);
  const wrongChallenge=(CHAPTERS[c].challenge.answer+1)%CHAPTERS[c].challenge.options.length;const old=players[0].state.me.progress[c].score;await act(players[0],'challenge',{choice:wrongChallenge});assert.equal(players[0].state.me.progress[c].challenge,false);assert.equal(players[0].state.me.progress[c].score,Math.max(0,old-RULES.mistakePenalty));time+=RULES.taskCooldownMs;
  await Promise.all(players.map(p=>act(p,'challenge',{choice:CHAPTERS[c].challenge.answer})));assert(players.every(p=>p.state.me.progress[c].challenge&&p.state.me.progress[c].secret));
  if(c===6){for(const p of players.filter(p=>p.n%3===0)){const score=p.state.me.progress[c].score;await act(p,'rewardRedeem',{choice:1});assert.equal(p.state.me.progress[c].rewardBalance,0);assert.equal(p.state.me.progress[c].score,score);await act(p,'rewardRedeem',{choice:1},{reject:/already/});}mark('reward-decisions',['all3 authored projects funded','garden+welcome spends12 without extra points','duplicate project rejected']);}
  if(c===7){for(const p of players){assert.equal(p.state.me.clues.length,8);const wrong=await act(p,'mystery',{answer:'ROBOT'});assert.equal(wrong.data.result.correct,false);await act(p,'mystery',{answer:'NEIGHBOR'});assert(p.state.me.mystery);}mark('all-secrets-mystery',['8 distinct clues per identity','duplicate secret adds no clue','incorrect mystery rejected as outcome','correct complete mystery earned']);}
  report.chapters.push({chapter:c+1,completed:players.filter(p=>p.state.me.progress[c].complete).length,quizFirstWrongImmutable:true,secretCount:players.filter(p=>p.state.me.progress[c].secret).length,challengeCount:players.filter(p=>p.state.me.progress[c].challenge).length,firstPlayer:structuredClone(players[0].state.me.progress[c])});
  await host('advance');assert.equal(players[0].state.event.phase,'brag');await host('advance');
 }
 assert.equal(players[0].state.event.phase,'finale');const frozen=JSON.stringify(app.engine.state.snapshot);await act(players[0],'quiz',{index:0,choice:0},{reject:/finished|frozen|scoring|chapter/i});await Promise.all(players.map(p=>act(p,'finale')));assert.equal(JSON.stringify(app.engine.state.snapshot),frozen);await host('advance');assert.equal(players[0].state.event.phase,'awards');
 const exported=(await http('/api/host/export',undefined,hostCookies[0]));assert.equal(exported.status,200);const snapshot=exported.data;assert.equal(snapshot.awards.filter(a=>a.playerId).length,15);assert.equal(new Set(snapshot.awards.map(a=>a.playerId)).size,15);
 mkdirSync(resolve(out,'..'),{recursive:true});const journalPath=out.replace(/\.json$/,'.journal.json');exportAudit(dbPath,journalPath,{sourceCommit});const journal=JSON.parse(readFileSync(journalPath,'utf8'));report.independent=verifyResults(snapshot,{requireFifteen:true,journal});assert(report.independent.fullActionReconciliationPass,JSON.stringify(report.independent));assert(report.independent.fifteenQualifyingDistinctRecipients);writeFileSync(out.replace(/\.json$/,'.export.json'),JSON.stringify(snapshot,null,2),{flag:'wx',mode:0o600});mark('immutable-finale-awards-export',['24 real contributors','frozen scoring unchanged','15 unique qualifying winners','independent inventory/outcome/ranking reconciliation']);report.passed=true;
}catch(error){report.errors.push(error.stack);report.passed=false;process.exitCode=1;console.error(error.stack);}finally{stopped=true;await disconnectStreams();await app?.close();report.finishedAt=new Date().toISOString();report.syntheticTime=new Date(time).toISOString();mkdirSync(resolve(out,'..'),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});rmSync(dir,{recursive:true,force:true});console.log(JSON.stringify({passed:report.passed,chapters:report.chapters.length,coverage:coverage.map(x=>x.id),errors:report.errors,report:out}));}
