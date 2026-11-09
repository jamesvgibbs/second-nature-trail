import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from '../server.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('timer skips idle and paused serialization but commits each due boundary once',async()=>{
  const app=createGameServer({dbPath:':memory:',demo:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  let now=1000000,ticks=0,serializations=0;
  app.engine.now=()=>now;
  const tick=app.engine.tick.bind(app.engine),stringify=JSON.stringify;
  app.engine.tick=()=>{ticks++;return tick()};
  JSON.stringify=function(value,...rest){if(value===app.engine.state)serializations++;return stringify(value,...rest)};
  try {
    app.engine.host('test',{type:'lobby',reason:'Fixture',requestId:'lobby'});
    app.engine.host('test',{type:'start',reason:'Fixture',requestId:'start'});
    ticks=serializations=0;
    await delay(280);
    assert.equal(ticks,0);assert.equal(serializations,0);
    now=app.engine.state.deadline;
    await delay(280);
    assert.equal(ticks,1);assert.equal(serializations,2);
    assert.equal(app.engine.state.phase,'chapter');
    const saved=JSON.parse(app.db.prepare('SELECT state FROM game WHERE id=1').get().state);
    assert.equal(saved.phase,'chapter');
    app.engine.host('test',{type:'pause',reason:'Fixture',requestId:'pause'});
    ticks=serializations=0;now+=30000;
    await delay(280);
    assert.equal(ticks,0);assert.equal(serializations,0);assert.equal(app.engine.state.phase,'paused');
    app.engine.host('test',{type:'resume',reason:'Fixture',requestId:'resume'});
    ticks=serializations=0;now=app.engine.state.deadline;
    await delay(280);
    assert.equal(ticks,1);assert.equal(serializations,2);assert.equal(app.engine.state.phase,'brag');
  } finally {JSON.stringify=stringify;await app.close();}
});
