import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('crowd Play connects 99 neighbors after human setup for finale, chapter and practice lobby',async()=>{
 const child=spawn(process.execPath,['scripts/review-events.mjs','--port-base','0','--control-port','0','--only','crowdfinale,crowd3,crowdentry','--prefix','test-'],{cwd:new URL('..',import.meta.url),stdio:['ignore','pipe','pipe']});let out='',err='',abort;const extras=[];
 child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);
 try{
  for(let i=0;i<800&&!out.includes('REVIEW READY');i++){assert.equal(child.exitCode,null,err);await delay(20);}
  assert(out.includes('REVIEW READY'),out+err);const origin=out.match(/CONTROLS (http:\/\/127\.0\.0\.1:\d+)/)[1];
  const status=async()=>(await(await fetch(origin+'/status')).json()).find(row=>row.key==='test-crowdfinale');let s=await status();assert.equal(s.key,'test-crowdfinale');assert.equal(s.phase,'paused');
  assert.equal((await fetch(origin+'/launch',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:s.key})})).status,303);
  await delay(150);assert.equal((await status()).phase,'paused');assert.equal((await status()).botConnections,0,'Human setup must precede automatic crowd connection');
  const game='http://127.0.0.1:'+new URL(s.url).port;
  const joined=await fetch(game+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:s.key+'-invite-1'})});assert.equal(joined.status,200);await joined.json();
  const cookie=joined.headers.get('set-cookie').split(';')[0];abort=new AbortController();const stream=await fetch(game+'/api/events?client=finale-review-test',{headers:{Cookie:cookie},signal:abort.signal});const reader=stream.body.getReader();await reader.read();void(async()=>{try{while(!(await reader.read()).done){}}catch{}})();
  const setup=await fetch(game+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'x-trail-client':'finale-review-test'},body:JSON.stringify({type:'setup',requestId:'finale-review-setup',settingsSequence:1,character:0,palette:0,insects:false})});assert.equal(setup.status,200);await setup.json();
  for(let i=0;i<300&&(s=await status()).phase!=='finale';i++)await delay(100);
  assert.equal(s.phase,'finale',JSON.stringify(s));assert.equal(s.connected,100);assert.equal(s.botConnections,99);assert.deepEqual(s.errors,[]);
  const view=await(await fetch(game+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(view.event.finale.target,60);assert.equal(view.event.finale.contributors.length,0);assert(view.me.progress.every(p=>p.step===0&&!p.complete));assert(view.event.awards.every(a=>!a.playerId));
  for(const [key,phase] of [['test-crowd3','chapter'],['test-crowdentry','lobby']]) {
   const row=(await(await fetch(origin+'/status')).json()).find(x=>x.key===key),base='http://127.0.0.1:'+new URL(row.url).port;
   const j=await fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:key+'-invite-1'})});assert.equal(j.status,200);await j.json();const c=j.headers.get('set-cookie').split(';')[0],a=new AbortController();extras.push(a);
   const r=await fetch(base+'/api/events?client=launch-test',{headers:{Cookie:c},signal:a.signal}),rr=r.body.getReader();await rr.read();void(async()=>{try{while(!(await rr.read()).done){}}catch{}})();
   assert.equal((await fetch(origin+'/launch',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:key})})).status,303);
   await delay(150);let before=(await(await fetch(origin+'/status')).json()).find(x=>x.key===key);assert.equal(before.botConnections,0,'No crowd before the human finishes setup');
   const configured=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Cookie:c,'x-trail-client':'launch-test'},body:JSON.stringify({type:'setup',requestId:'launch-setup',settingsSequence:1,character:0,palette:0,insects:false})});assert.equal(configured.status,200);await configured.json();
   let mid;for(let i=0;i<100;i++){mid=(await(await fetch(origin+'/status')).json()).find(x=>x.key===key);if(mid.botConnections>0&&mid.botConnections<99)break;await delay(20);}
   assert(mid.botConnections>0&&mid.botConnections<99,'Exercise the second Play while the99-neighbor connection is still in flight');
   assert.equal((await fetch(origin+'/launch',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:key})})).status,303,'Second Play during crowd connection shares the same join operation');
   let ready;for(let i=0;i<250;i++){ready=(await(await fetch(origin+'/status')).json()).find(x=>x.key===key);if(ready.botConnections===99&&ready.status==='Ready'&&ready.phase===phase)break;await delay(100);}
   assert.equal(ready.botConnections,99);assert.equal(ready.connected,100);assert.equal(ready.phase,phase);assert.deepEqual(ready.errors,[]);
   const actual=await(await fetch(base+'/api/state',{headers:{Cookie:c}})).json();assert(actual.me.progress.every(p=>p.step===0&&!p.complete));assert(actual.event.contributions.every(n=>n===0));
  }

 }finally{abort?.abort();for(const a of extras)a.abort();const done=once(child,'exit');child.kill('SIGTERM');const [code]=await done;assert.equal(code,0,err);}
});
