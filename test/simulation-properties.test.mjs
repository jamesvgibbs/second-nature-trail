import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createGameServer } from '../server.mjs';
import { RULES } from '../content.mjs';
import { findPath } from '../public/world.mjs';
import { nextWaypoint } from '../scripts/load-navigation.mjs';
import { verifyResults } from '../scripts/verify-results.mjs';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const seeds = [1, 17, 42, 138, 503, 7920, 65536, 99991];
function generator(seed) { let value=seed>>>0; return n=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value%n;}; }

function invariants(state, baseline, frozen) {
  const held=new Map(), consumed=new Set();
  for(const action of state.actions) if(action.type==='consume'&&action.source==='inventory') {
    assert(!consumed.has(action.itemId),'original supply consumed twice'); consumed.add(action.itemId);
  }
  for(const player of Object.values(state.players)) {
    assert(player.items.length<=RULES.storageLimit,'storage limit');
    for(const item of player.items) {
      assert(baseline.has(item.id),'new original supply manufactured');
      assert(!held.has(item.id),'same original supply held twice');
      assert(!consumed.has(item.id),'consumed supply remains held'); held.set(item.id,player.id);
    }
    for(const progress of player.progress) {
      assert(Object.values(progress.reserve).every(n=>Number.isInteger(n)&&n>=0&&n<=RULES.reservePerChapter),'reserve bounds');
      assert(progress.score>=0&&Number.isFinite(progress.score),'score bounds');
      assert(Number.isInteger(progress.step)&&progress.step>=0,'step bounds');
    }
  }
  assert.equal(held.size+consumed.size,baseline.size,'exact original supply conservation');
  const owners=new Map(baseline);
  for(const action of state.actions) {
    if(action.type==='tradeCompleted') {
      for(const id of action.give){assert.equal(owners.get(id),action.from);owners.set(id,action.to);}
      for(const id of action.receive){assert.equal(owners.get(id),action.to);owners.set(id,action.from);}
    }
    if(action.type==='consume'&&action.source==='inventory'){assert.equal(owners.get(action.itemId),action.playerId);owners.delete(action.itemId);}
  }
  assert.deepEqual([...owners].sort(),[...held].sort(),'item transfer provenance');
  const winners=state.awards.map(a=>a.playerId).filter(Boolean);
  assert.equal(new Set(winners).size,winners.length,'one prize per identity');
  if(frozen)assert.equal(JSON.stringify(state.snapshot),frozen,'frozen competitive inputs changed');
  return held;
}

test('seeded HTTP actions preserve exact supplies, rollback, immutable answers and lifecycle snapshots', {timeout:180000}, async()=>{
  const report={label:'Bounded seeded HTTP property simulation; injected clock, real movement and SQLite; not exhaustive state-space or capacity proof',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim(),sourceHashes:Object.fromEntries(['server.mjs','engine.mjs','content.mjs','test/simulation-properties.test.mjs'].map(f=>[f,createHash('sha256').update(readFileSync(new URL('../'+f,import.meta.url))).digest('hex')])),startedAt:new Date().toISOString(),seeds:[],passed:false};
  try {
    for(const seed of seeds) {
      const dir=mkdtempSync(join(tmpdir(),'trail-property-')),dbPath=join(dir,'event.sqlite'),random=generator(seed);
      let clock=Date.now()-3600000,seq=0,app,origin,hostCookie,frozen=null;
      const streams=[],players=[],trace=[];
      const evidence={seed,accepted:0,rejected:0,duplicates:0,concurrentPairs:0,concurrentTradeRaces:0,steps:0,reopened:false,independent:false};report.seeds.push(evidence);
      const options={dbPath,demo:false,hostTokens:['property-primary-000000000000000000','property-backup-0000000000000000000'],presentationToken:'property-display-000000000000000000'};
      const http=async(path,body,cookie,client)=>{const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...(client?{'x-trail-client':client}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
      const refresh=async p=>{const r=await http('/api/state',undefined,p.cookie);assert.equal(r.status,200);p.state=r.data;};
      const refreshAll=()=>Promise.all(players.map(refresh));
      const host=async(type,fields={})=>{const r=await http('/api/host/action',{type,reason:`Seeded developer scenario ${seed}`,requestId:`h${++seq}`,...fields},hostCookie);assert.equal(r.status,200,JSON.stringify(r));await refreshAll();return r;};
      const make=(p,type,fields={})=>({type,requestId:`p${++seq}`,expectedChapter:p.state.event.chapter,...(type==='task'?{expectedStep:p.state.me.progress[p.state.event.chapter].step,expectedStage:p.state.chapter.task?.stage||null,...(p.state.event.chapter===4?{expectedRound:p.state.chapter.task?.round}:{})}:{}),...(type==='move'?{movementSequence:++p.moveSeq}:{}),...fields});
      let baseline;
      const check=(before)=>{
        const after=app.engine.state;invariants(after,baseline,frozen);
        for(const[id,p]of Object.entries(before.players))for(let c=0;c<8;c++){
          const prior=p.progress[c],current=after.players[id].progress[c];
          if(prior.complete)assert(current.complete,'completed objective reverted');
          assert(current.step>=prior.step,'step regressed');
          for(let q=0;q<2;q++)if(prior.quiz[q])assert.deepEqual(current.quiz[q],prior.quiz[q],'first quiz changed');
        }
        if(after.snapshot&&!frozen)frozen=JSON.stringify(after.snapshot);
      };
      const dispatch=async(p,a)=>{
        await sleep(18); // Keep normal public rate limits intact, including invalid attempts.
        const before=structuredClone(app.engine.state),r=await http('/api/action',a,p.cookie,p.id);
        trace.push({player:p.id,action:a,status:r.status,error:r.data.error});
        if(r.status===200){evidence.accepted++;if(a.type!=='move')p.accepted.push(a);}
        else {assert.equal(r.status,400,JSON.stringify(r));evidence.rejected++;assert.deepEqual(app.engine.state,before,'rejected request partially mutated game');}
        check(before);await refreshAll();return r;
      };
      const act=(p,type,fields)=>dispatch(p,make(p,type,fields));
      const travel=async(p,target)=>{let guard=0;while(Math.hypot(p.state.me.position.x-target.x,p.state.me.position.y-target.y)>25){assert(++guard<30);clock+=1000;const path=findPath(p.state.me.position,target);assert(path);const r=await act(p,'move',nextWaypoint(p.state.me.position,path)||target);assert.equal(r.status,200);}};
      const endStreams=async()=>{for(const controller of streams)controller.abort();streams.length=0;await sleep(10);};
      try{
        app=createGameServer(options);app.engine.now=()=>clock;origin=await new Promise(r=>app.server.listen(0,'127.0.0.1',()=>r(`http://127.0.0.1:${app.server.address().port}`)));
        for(let n=0;n<3;n++)app.addInvitation(`p${n}`,`Property neighbor ${n}`,`property-${n}`);
        const login=await http('/api/host/login',{token:options.hostTokens[0]});assert.equal(login.status,200);hostCookie=login.cookie;
        for(let n=0;n<3;n++){
          const joined=await http('/api/join',{token:`property-${n}`});assert.equal(joined.status,200);
          const p={id:`p${n}`,cookie:joined.cookie,moveSeq:0,accepted:[]};players.push(p);
          const controller=new AbortController();streams.push(controller);const r=await fetch(origin+`/api/events?client=${p.id}`,{headers:{Cookie:p.cookie},signal:controller.signal});assert.equal(r.status,200);const reader=r.body.getReader();await reader.read();void(async()=>{try{while(!(await reader.read()).done){}}catch{}})();
          await refresh(p);
          const setup=await http('/api/action',make(p,'setup',{character:n,palette:n,insects:false,settingsSequence:1}),p.cookie,p.id);assert.equal(setup.status,200);await refresh(p);
        }
        baseline=new Map(Object.values(app.engine.state.players).flatMap(p=>p.items.map(item=>[item.id,p.id])));
        await host('lobby');await host('start');await host('advance');
        // Two overlapping offers compete for the same actor inventory version.
        const offers=[];
        for(const target of players.slice(1)){
          const offered=await act(players[0],'tradeOffer',{target:target.id,give:{item:'parts',qty:1},receive:{item:'cable',qty:1}});
          assert.equal(offered.status,200);const tradeId=offered.data.result.tradeId;
          assert.equal((await act(players[0],'tradeConfirm',{tradeId})).status,200);offers.push({target,tradeId});
        }
        const order=seed%2?offers:[...offers].reverse(),beforeRace=structuredClone(app.engine.state);
        const confirmations=await Promise.all(order.map(({target,tradeId})=>http('/api/action',make(target,'tradeConfirm',{tradeId}),target.cookie,target.id)));
        assert.deepEqual(confirmations.map(r=>r.status).sort(),[200,400]);
        assert.equal(offers.filter(o=>app.engine.state.trades[o.tradeId].status==='complete').length,1);
        assert.equal(offers.filter(o=>app.engine.state.trades[o.tradeId].status==='cancelled').length,1);
        check(beforeRace);await refreshAll();evidence.concurrentTradeRaces++;
        // Each seed first earns a real objective so later lifecycle tests have real inventory and score to preserve.
        const scorer=players[0];
        let deliveryActions=0;
        for(;deliveryActions<15&&!scorer.state.me.progress[0].complete;deliveryActions++){
          const task=scorer.state.chapter.task;await travel(scorer,task.target);clock+=RULES.taskCooldownMs;
          const choice=task.stage==='load'?random(3):task.stage==='route'?random(2):0;
          assert.equal((await act(scorer,'task',{choice})).status,200);
        }
        assert(scorer.state.me.progress[0].complete);
        assert.equal(deliveryActions,12+scorer.state.me.progress[0].deliveryHistory.filter(trip=>trip.incident&&Number.isFinite(trip.incident.repairedAt)).length);
        for(let step=0;step<90;step++){
          clock+=100;const p=players[random(3)],other=players[(players.indexOf(p)+1)%3],kind=random(13);
          if(kind===0){const target=p.state.chapter.task?.target||{x:600,y:380},path=findPath(p.state.me.position,target);await act(p,'move',nextWaypoint(p.state.me.position,path)||target);}
          else if(kind===1)await act(p,'task',{choice:random(4)});
          else if(kind===2)await act(p,'quiz',{index:random(3),choice:random(4)});
          else if(kind===3)await act(p,'help',{preset:random(4)});
          else if(kind===4)await act(p,'assist',{target:other.id});
          else if(kind===5)await act(p,'tradeOffer',{target:other.id,give:{item:['parts','cable'][random(2)],qty:1+random(4)},receive:{item:['food','filters'][random(2)],qty:1+random(4)}});
          else if(kind===6||kind===7){const ids=Object.keys(app.engine.state.trades),id=ids.length?ids[random(ids.length)]:'missing';await act(p,kind===6?'tradeConfirm':'tradeCancel',{tradeId:id});}
          else if(kind===8)await act(p,'secret');
          else if(kind===9)await act(p,'challenge',{choice:random(4)});
          else if(kind===10&&p.accepted.length){const a=p.accepted[random(p.accepted.length)],before=structuredClone(app.engine.state),r=await dispatch(p,a);assert.equal(r.status,200);assert.deepEqual(app.engine.state,before,'same accepted request changed game');evidence.duplicates++;}
          else if(kind===11&&p.accepted.length){const a=p.accepted[random(p.accepted.length)],r=await dispatch(p,{...a,unexpectedField:'changed'});assert.equal(r.status,400);}
          else {
            const a=make(p,'quiz',{index:random(2),choice:random(3)}),before=structuredClone(app.engine.state);
            const responses=await Promise.all([http('/api/action',a,p.cookie,p.id),http('/api/action',a,p.cookie,p.id)]);
            assert(responses.every(r=>r.status===200));assert.deepEqual(responses[0].data.result,responses[1].data.result);check(before);await refreshAll();evidence.concurrentPairs++;
          }
          evidence.steps++;
        }
        // Different seeds vary skip versus ranked continuation and ordering of recovery controls.
        await host('pause');clock+=12345;await act(players[1],'task',{choice:0});await host('rescue',{playerId:players[1].id});assert.deepEqual(players[1].state.me.position,{x:600,y:380});
        await host('shorten',{seconds:30});await host('resume');
        if(seed%2){await host('skip');assert.equal(app.engine.state.ranked[0],false);await host('advance');}else{await host('advance');await host('advance');}
        await host('endScoring');frozen=JSON.stringify(app.engine.state.snapshot);
        await host('pause');const before=structuredClone(app.engine.state);const rejected=await http('/api/host/action',{type:'endScoring',reason:'Do not refreeze',requestId:`h${++seq}`},hostCookie);assert.equal(rejected.status,400);assert.deepEqual(app.engine.state,before);
        await host('resume');if(seed%2===0)for(const p of players)assert.equal((await act(p,'finale')).status,200);
        if(seed%2===0)assert(app.engine.state.finale.ending);else assert.equal(app.engine.state.finale.ending,null);
        evidence.ending=seed%2===0?'threshold-reached':'fallback';
        await host('advance');assert(app.engine.state.finale.ending);assert.equal(app.engine.state.phase,'awards');invariants(app.engine.state,baseline,frozen);
        const snapshot=app.engine.exportResults(),state=app.engine.state;
        const journal={snapshot:state.snapshot,snapshotHash:hash(state.snapshot),requests:state.requests,requestsHash:hash(state.requests),snapshotAt:state.snapshot.at,contentHash:state.contentHash,seed:state.seed,capturedAt:new Date().toISOString(),phase:state.phase};
        const audit=verifyResults(snapshot,{journal});assert(audit.fullActionReconciliationPass,JSON.stringify(audit));evidence.independent=true;
        await host('close');const final=structuredClone(app.engine.state);await endStreams();await app.close();app=createGameServer(options);app.engine.now=()=>clock;
        assert.deepEqual(app.engine.state,JSON.parse(JSON.stringify(final)),'closed JSON event changed on SQLite reopen');evidence.reopened=true;
      }catch(error){evidence.failure={message:error.stack,lastActions:trace.slice(-12)};throw error;}
      finally{await endStreams();await app?.close();rmSync(dir,{recursive:true,force:true});}
    }
    assert(report.seeds.every(s=>s.accepted>12&&s.rejected>5&&s.duplicates>0&&s.concurrentPairs>0&&s.concurrentTradeRaces===1&&s.reopened&&s.independent));report.passed=true;
  }finally{
    report.finishedAt=new Date().toISOString();
    if(process.env.SIM_PROPERTY_REPORT)writeFileSync(process.env.SIM_PROPERTY_REPORT,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  }
});
