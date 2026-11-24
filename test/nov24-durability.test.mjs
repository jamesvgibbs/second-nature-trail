import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGameServer} from '../server.mjs';
import {shortcutWheelIncident} from '../engine.mjs';

test('first arrival and crossing are durable before success; failed arrival commit rolls back and same sequence retries; restart keeps repair journal and deduplication',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'trail-nov24-')),dbPath=join(directory,'event.sqlite');let app,origin,now=100000,seq=0,cookie,hostCookie,stream;
 const boot=async()=>{const interval=globalThis.setInterval;globalThis.setInterval=(fn,ms,...args)=>interval(ms===250?()=>{}:fn,ms===250?3600000:ms,...args);try{app=createGameServer({dbPath,demo:true});}finally{globalThis.setInterval=interval;}app.engine.now=()=>now;await new Promise(r=>app.server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+app.server.address().port;};
 const request=async(path,body,auth=cookie)=>{const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(auth?{Cookie:auth}:{}),'x-trail-client':'nov24'},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const connect=async()=>{stream=new AbortController();const r=await fetch(origin+'/api/events?client=nov24',{headers:{Cookie:cookie},signal:stream.signal}),reader=r.body.getReader();await reader.read();void(async()=>{try{while(!(await reader.read()).done){}}catch{}})();};
 const host=async type=>{const r=await request('/api/host/action',{type,requestId:'host'+(++seq),reason:'Isolated Nov24 persistence test'},hostCookie);assert.equal(r.status,200,JSON.stringify(r.body));};
 const act=async(type,fields={})=>{const p=app.engine.get('neighbor-1');const a={type,requestId:'a'+(++seq),expectedChapter:app.engine.state.chapter,...(type==='task'?{expectedStep:p.progress[0].step,expectedStage:app.engine.chapterView(p).task?.stage}:{}),...fields};const result=await request('/api/action',a);assert.equal(result.status,200,JSON.stringify(result.body));return a;};
 const disk=()=>JSON.parse(app.db.prepare('SELECT state FROM game WHERE id=1').get().state);
 try{
  await boot();cookie=(await request('/api/join',{token:'demo-1'},null)).cookie;await connect();await act('setup',{settingsSequence:1,character:0,palette:0,insects:false});hostCookie=(await request('/api/host/login',{token:'local-host-one'},null)).cookie;
  // The initial position is explicit test setup. Every arrival below comes from
  // accepted movement, with the production periodic save suppressed.
  app.engine.get('neighbor-1').position={x:80,y:160};app.engine.get('neighbor-1').lastMoveAt=now;
  app.db.prepare('UPDATE game SET state=? WHERE id=1').run(JSON.stringify(app.engine.state));
  app.db.exec("CREATE TRIGGER reject_arrival BEFORE UPDATE ON game BEGIN SELECT RAISE(ABORT,'disk unavailable'); END");
  now+=1000;const move={type:'move',requestId:'arrival',movementSequence:1,x:100,y:160};assert.equal((await request('/api/action',move)).status,400);assert.deepEqual(app.engine.get('neighbor-1').visitedDestinations,{});assert.deepEqual(app.engine.get('neighbor-1').position,{x:80,y:160});assert.deepEqual(disk().players['neighbor-1'].visitedDestinations,{});
  app.db.exec('DROP TRIGGER reject_arrival');assert.equal((await request('/api/action',move)).status,200);const arrived=disk().players['neighbor-1'].visitedDestinations;assert(arrived['160,160']);assert(!arrived['300,160']);assert.equal((await request('/api/action',move)).body.result.ignored,true);assert.equal(app.engine.state.actions.filter(a=>a.type==='destinationVisited').length,1);
  for(let n=0;;n++){const seed='nov24-disk-'+n;if(shortcutWheelIncident(seed,'neighbor-1',0)){app.engine.state.seed=seed;break;}}
  await host('lobby');await host('start');now+=10000;await act('task',{choice:0});await act('task',{choice:1});
  now+=1000;await act('move',{movementSequence:2,x:230,y:160});
  const crossing={type:'task',requestId:'crossing-retry',choice:0,expectedChapter:0,expectedStep:0,expectedStage:'travel'};
  app.db.exec("CREATE TRIGGER reject_crossing BEFORE UPDATE ON game BEGIN SELECT RAISE(ABORT,'disk unavailable'); END");
  assert.equal((await request('/api/action',crossing)).status,400);assert.equal(app.engine.get('neighbor-1').progress[0].delivery.stage,'travel');assert.equal(app.engine.get('neighbor-1').progress[0].delivery.crossingChecked,false);assert.equal(app.engine.state.actions.filter(a=>a.type==='deliveryCrossing').length,0);
  app.db.exec('DROP TRIGGER reject_crossing');assert.equal((await request('/api/action',crossing)).status,200);const saved=disk().players['neighbor-1'].progress[0].delivery;assert.equal(saved.stage,'repair');assert.equal(saved.journal.title,'A wheel came loose');assert(saved.crossingChecked);assert.equal(saved.incident.repairedAt,null);
  stream.abort();await app.close();await boot();await connect();const projected=(await request('/api/state')).body;assert.deepEqual(projected.me.progress[0].delivery,saved);assert.deepEqual(projected.me.visitedDestinations,arrived);assert.equal((await request('/api/action',crossing)).status,200);assert.equal(app.engine.state.actions.filter(a=>a.type==='deliveryCrossing').length,1);
  const repair=await act('task',{choice:0});assert.equal((await request('/api/action',repair)).status,200);assert.equal(app.engine.state.actions.filter(a=>a.type==='deliveryRepair').length,1);assert.equal(disk().players['neighbor-1'].progress[0].delivery.stage,'deliver');assert.equal(disk().players['neighbor-1'].progress[0].delivery.journal.title,'Wheel reseated');
  now+=1000;await act('move',{movementSequence:3,x:300,y:160});await act('task',{choice:0});const delivered=disk().players['neighbor-1'];assert(delivered.visitedDestinations['300,160']);assert.equal(delivered.progress[0].score,10);assert.equal(delivered.progress[0].primary,6);assert.match(delivered.progress[0].delivery.journal.text,/\+10 points/);
 }finally{stream?.abort();if(app)await app.close();rmSync(directory,{recursive:true,force:true});}
});
