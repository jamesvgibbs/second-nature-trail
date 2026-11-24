import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Engine,shortcutWheelIncident} from '../engine.mjs';
import {RULES,CHAPTERS} from '../content.mjs';
import {findPath,waypointReached} from '../public/world.mjs';
function fixture(incident=false) {
 let time=100000,seq=0;let e=new Engine({now:()=>time});
 e.state.seed='nov24-fixed-test-seed';let id;
 for(let i=0;!id;i++)if(shortcutWheelIncident(e.state.seed,'p'+i,0)===incident)id='p'+i;
 e.addPlayer(id,'Player');e.dispatch(id,{type:'setup',requestId:'setup',character:0,palette:0,insects:false});
 const act=(type,fields={})=>e.dispatch(id,{type,requestId:'a'+(++seq),expectedChapter:e.state.chapter,...(type==='task'?{expectedStep:e.get(id).progress[0].step,expectedStage:e.chapterView(e.get(id)).task?.stage}:{}),...fields});
 const host=(type,fields={})=>e.host('host',{type,requestId:'h'+(++seq),reason:'Nov24 isolated fixture',...fields});
 const walk=target=>{const path=findPath(e.get(id).position,target);assert(path);for(const point of path){let safety=0;while(!waypointReached(e.get(id).position,point)){assert(++safety<50);time+=1000;act('move',point);}}};
 return {get e(){return e;},id,act,host,walk,advance:ms=>time+=ms,start(){host('lobby');host('start');time+=RULES.countdownMs;e.tick();},restore(){e=new Engine({state:structuredClone(e.state),now:()=>time});},task(choice=0,extra={}){const t=e.chapterView(e.get(id)).task;walk(t.target);return act('task',{choice,...extra});}};
}
test('personal destination arrivals require accepted physical movement, never a click, snapshot load, rescue or team completion',()=>{
 const f=fixture();const p=f.e.get(f.id);assert.deepEqual(f.e.view(f.id).me.visitedDestinations,{});
 const before=structuredClone(p.visitedDestinations);f.act('move',{x:160,y:160});assert.deepEqual(p.visitedDestinations,before,'same clock has no movement, even when distant target requested');
 assert.throws(()=>f.act('visit',{key:'160,160'}),/Unknown action/);f.e.state.contributions.fill(1);assert.deepEqual(p.visitedDestinations,{});
 f.walk(CHAPTERS[0].locations[0]);assert(p.visitedDestinations['160,160']);assert(!p.visitedDestinations['1080,630']);const arrived=structuredClone(p.visitedDestinations);f.restore();assert.deepEqual(f.e.view(f.id).me.visitedDestinations,arrived);
 f.host('rescue',{playerId:f.id});assert.deepEqual(f.e.get(f.id).visitedDestinations,arrived);const legacy=structuredClone(f.e.state);legacy.players[f.id].position={x:160,y:160};delete legacy.players[f.id].visitedDestinations;const restored=new Engine({state:legacy});assert.deepEqual(restored.view(f.id).me.visitedDestinations,{},'legacy position at a door is not historical arrival evidence');assert.equal(restored.state.contentHash,f.e.state.contentHash);
});
test('visits are first-arrival records per destination and successful physical interactions can establish a legacy visit',()=>{
 const f=fixture();f.start();f.walk(CHAPTERS[0].locations[0]);const first=f.e.get(f.id).visitedDestinations['160,160'];f.advance(1000);f.task(0);assert.deepEqual(f.e.get(f.id).visitedDestinations['160,160'],first);assert.equal(f.e.state.actions.filter(a=>a.type==='destinationVisited'&&a.key==='160,160').length,1);
 delete f.e.get(f.id).visitedDestinations;f.restore();assert.deepEqual(f.e.view(f.id).me.visitedDestinations,{});f.task(1);assert(f.e.get(f.id).visitedDestinations['160,160']);assert(!f.e.get(f.id).visitedDestinations['300,160']);
});
test('quarter-chance draw matches independent HMAC bucket and differs by trip without consuming mutable randomness',()=>{
 for(let i=0;i<100;i++)for(let trip=0;trip<3;trip++){
  const expected=createHmac('sha256','seed').update(JSON.stringify(['move-day-wheel-v1','p'+i,trip])).digest().readUInt32BE(0)%4===0;
  assert.equal(shortcutWheelIncident('seed','p'+i,trip),expected);
 }
});
for(const unlucky of [false,true])test(`shortcut ${unlucky?'unlucky':'normal'} crossing is checked once, survives retry/restart, and preserves published cargo points`,()=>{
 const f=fixture(unlucky);f.start();f.task(0);f.task(1);assert.equal(f.e.get(f.id).progress[0].delivery.incident,null,'route selection does not reveal or roll incident');
 const pre=structuredClone(f.e.state);assert.throws(()=>f.act('task',{choice:0,requestId:'too-far'}),/closer/);assert.deepEqual(f.e.state,pre);
 f.walk(RULES.deliveryCheckpoints.shortcut);const action={type:'task',requestId:'crossing',choice:0,expectedChapter:0,expectedStep:0,expectedStage:'travel'};const result=f.e.dispatch(f.id,action);assert.equal(f.e.get(f.id).progress[0].delivery.stage,unlucky?'repair':'deliver');
 const crossed=structuredClone(f.e.get(f.id).progress[0].delivery);assert.equal(f.e.state.actions.filter(a=>a.type==='deliveryCrossing').length,1);assert.deepEqual(f.e.dispatch(f.id,action),result);f.restore();assert.deepEqual(f.e.get(f.id).progress[0].delivery,crossed);assert.deepEqual(f.e.dispatch(f.id,action),result);assert.equal(f.e.state.actions.filter(a=>a.type==='deliveryCrossing').length,1);
 if(unlucky){assert.throws(()=>f.act('task',{choice:0,expectedStage:'deliver'}),/stage changed/);const inv=f.e.view(f.id).me.inventory;f.task(0,{requestId:'reseat'});assert.deepEqual(f.e.view(f.id).me.inventory,inv);assert.equal(f.e.get(f.id).progress[0].score,0);assert(Number.isFinite(f.e.get(f.id).progress[0].delivery.incident.repairedAt));f.restore();assert.equal(f.e.chapterView(f.e.get(f.id)).task.stage,'deliver');}
 f.task();const r=f.e.get(f.id).progress[0];assert.equal(r.step,1);assert.equal(r.primary,6);assert.equal(r.score,10);assert.equal(f.e.view(f.id).me.inventory.parts,1);assert.equal(r.deliveryHistory.length,1);assert.equal(!!r.deliveryHistory[0].incident,unlucky);assert.match(r.delivery.journal.text,/\+10 points, 6 useful value/);f.restore();assert.equal(f.e.get(f.id).progress[0].delivery.journal.title,'Delivery complete');
});
test('paved crossing never triggers a wheel incident even for an unlucky identity',()=>{const f=fixture(true);f.start();f.task(0);f.task(0);f.task();assert.equal(f.e.get(f.id).progress[0].delivery.stage,'deliver');assert.equal(f.e.get(f.id).progress[0].delivery.incident,null);f.task();assert.equal(f.e.get(f.id).progress[0].score,17);assert.equal(f.e.get(f.id).progress[0].primary,10);});
