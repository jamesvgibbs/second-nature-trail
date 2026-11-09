import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function launch(args) {
  const child=spawn(process.execPath,['scripts/preview-chapter.mjs',...args],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0'},stdio:['pipe','pipe','pipe']});
  let output='',errors='';
  child.stderr.on('data',data=>{errors+=data});
  const origin=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Preview did not start: '+output+errors)),5000);
    child.stdout.on('data',data=>{
      output+=data;
      const match=output.match(/http:\/\/localhost:(\d+)/);
      if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}
    });
    child.once('exit',code=>{clearTimeout(timer);reject(Error('Preview exited '+code+errors));});
  });
  const joined=await fetch(origin+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'demo-1'})});
  assert.equal(joined.status,200);
  const cookie=joined.headers.get('set-cookie').split(';')[0];
  return {child,output:()=>output,state:async()=>await(await fetch(origin+'/api/state',{headers:{cookie}})).json(),close:async()=>{const exited=once(child,'exit');child.kill('SIGTERM');const [code]=await exited;assert.equal(code,0,errors);}};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('waiting preview remains in lobby until newline, then starts chapter6 once with its normal clock',async()=>{
  const app=await launch(['6','--wait-for-start']);
  try {
    assert.equal((await app.state()).event.phase,'lobby');
    await delay(300);
    const before=await app.state();
    assert.equal(before.event.phase,'lobby');
    assert.equal(before.event.deadline,null);
    assert(app.output().includes('press Enter'));
    app.child.stdin.write('\n');
    let state;
    for(let i=0;i<20;i++){state=await app.state();if(state.event.phase==='chapter')break;await delay(10);}
    assert.equal(state.event.phase,'chapter');
    assert.equal(state.event.chapter,5);
    assert(state.event.remainingMs>299000 && state.event.remainingMs<=300000);
    assert(state.chapter.task.dueAt-state.serverTime>44000);
    assert(state.me.progress.slice(0,5).every(r=>!r.complete&&r.score===0));
    assert(state.event.broadcast.includes('earlier chapters are intentionally unplayed'));
    const deadline=state.event.deadline;
    app.child.stdin.write('\n');await delay(30);
    assert.equal((await app.state()).event.deadline,deadline);
    assert.equal(app.output().split('preview started.').length-1,1);
  } finally {await app.close();}
});
test('immediate preview retains its previous offset behavior',async()=>{
  const app=await launch(['6']);
  try {
    const state=await app.state();
    assert.equal(state.event.phase,'chapter');assert.equal(state.event.chapter,5);
    assert(state.event.remainingMs>289000&&state.event.remainingMs<=290000);
  } finally {await app.close();}
});
test('stdin EOF alone does not start a waiting preview',async()=>{
  const app=await launch(['1','--wait-for-start']);
  try {app.child.stdin.end();await delay(30);assert.equal((await app.state()).event.phase,'lobby');}
  finally {await app.close();}
});
