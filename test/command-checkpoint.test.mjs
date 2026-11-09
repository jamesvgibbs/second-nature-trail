import test from 'node:test';
import assert from 'node:assert/strict';
import { types } from 'node:util';
import { createCommandCheckpoint } from '../command-checkpoint.mjs';
import { Engine } from '../engine.mjs';
function small() {return {players:{a:{id:'a',nested:{n:1},items:[]},b:{id:'b',nested:{n:2},items:[]}},phase:'chapter',trades:{},actions:[],audit:[],requests:{},snapshot:null};}
function run(holder,fn,key='request') {
  const {actions,audit,requests}=holder.state,actionCount=actions.length,auditCount=audit.length,had=Object.hasOwn(requests,key),prior=requests[key];
  const checkpoint=createCommandCheckpoint(holder.state,key);
  try{return checkpoint.run(fn,()=>holder.state)}catch(error){holder.state=checkpoint.rollback();actions.length=actionCount;audit.length=auditCount;if(had)requests[key]=prior;else delete requests[key];throw error}
}
test('player reads/descriptors capture once, success retains plain map and untouched identities',()=>{
  const holder={state:small()},map=holder.state.players,untouched=map.b,original=structuredClone;
  let copies=0;
  globalThis.structuredClone=value=>{if(value?.id==='a')copies++;return original(value)};
  try {
    run(holder,()=>{const a=holder.state.players.a;assert.equal(Object.getOwnPropertyDescriptor(holder.state.players,'a').value,a);holder.state.players.a.nested.n++;a.items.push('one');return {ok:true}});
    assert.equal(copies,1);assert.equal(holder.state.players,map);assert.equal(map.b,untouched);assert.equal(map.a.nested.n,2);assert(!types.isProxy(holder.state.players));assert.doesNotThrow(()=>structuredClone(holder.state));
  } finally {globalThis.structuredClone=original;}
});
test('failure restores nested aliases, descriptor access, add/replace/delete and other mutable fields',()=>{
  const holder={state:small()},before=structuredClone(holder.state),history={actions:holder.state.actions,audit:holder.state.audit,requests:holder.state.requests,snapshot:holder.state.snapshot};
  assert.throws(()=>run(holder,()=>{
    const a=Object.getOwnPropertyDescriptor(holder.state.players,'a').value,alias=a.nested;alias.n=9;
    holder.state.players.a={id:'replacement'};delete holder.state.players.b;
    holder.state.players.c={id:'c'};
    Object.defineProperty(holder.state.players,'d',{value:{id:'d'},configurable:true,writable:true,enumerable:true});
    holder.state.trades.changed=true;holder.state.actions.push({x:1});holder.state.audit.push({x:1});holder.state.requests.request={result:{ok:true}};
    throw Error('invalid');
  }),/invalid/);
  assert.deepEqual(holder.state,before);
  for(const key of Object.keys(history))assert.equal(holder.state[key],history[key]);
});
test('unexpected map/root/history replacement, async callbacks and proxy escapes fail closed',async()=>{
  const cases=[
    h=>{h.state.players={}},h=>{h.state={...h.state}},h=>{h.state.actions=[]},
    h=>{h.state.snapshot={leak:h.state.players}},h=>{h.state.actions.push({leak:h.state.players})},
    h=>{h.state.requests.request={leak:h.state.players}},h=>{h.state.players.a.leak=h.state.players},
    h=>({leak:h.state.players}),h=>({hidden:new Map([['leak',h.state.players]])}),h=>({hidden:new Set([h.state.players])}),h=>Object.preventExtensions(h.state.players),
    h=>Object.defineProperty(h.state.players,'a',{value:{id:'a'},configurable:false}),
    h=>{h.state.players.a.nested.n=9;return Promise.resolve('unexpected')},
  ];
  for(const fn of cases){const holder={state:small()},before=structuredClone(holder.state);assert.throws(()=>run(holder,()=>fn(holder)));assert.deepEqual(holder.state,before);assert.doesNotThrow(()=>structuredClone(holder.state));}
  const holder={state:small()};let invoked=false;
  const checkpoint=createCommandCheckpoint(holder.state,'async');
  assert.throws(()=>checkpoint.run(async()=>{invoked=true;holder.state.players.a.nested.n=9}),/synchronous/);
  holder.state=checkpoint.rollback();assert.equal(invoked,false);assert.equal(holder.state.players.a.nested.n,1);
});
test('Object.values captures every player and new snapshot/result are ordinary cloneable data',()=>{
  const holder={state:small()};
  const result=run(holder,()=>{const rows=Object.values(holder.state.players).map(p=>({...structuredClone(p)}));holder.state.snapshot={players:rows};return {players:rows}});
  assert.doesNotThrow(()=>structuredClone(result));assert.doesNotThrow(()=>structuredClone(holder.state));
  assert.equal(result.players.length,2);
});
function enginePair() {
  let now=1000000;const a=new Engine({now:()=>now});
  for(const id of ['a','b']){a.addPlayer(id,id);a.dispatch(id,{type:'setup',character:0,palette:0,insects:false,requestId:'setup'});}
  a.host('test',{type:'lobby',reason:'Fixture',requestId:'lobby'});a.host('test',{type:'start',reason:'Fixture',requestId:'start'});now+=10000;a.tick();
  const {tradeId}=a.dispatch('a',{type:'tradeOffer',target:'b',give:{item:'cable',qty:1},receive:{item:'parts',qty:1},expectedChapter:0,requestId:'offer'});
  const b=new Engine({now:()=>now});b.state=structuredClone(a.state);
  function command(id,action,{fail=false,host=false}={}) {
    const key=host?`host:test:${action.requestId}`:`${id}:${action.requestId}`;
    let left,right,errorLeft,errorRight;
    try{left=run(a,()=>{const result=host?a.host('test',action):a.dispatch(id,action);if(fail)throw Error('injected after mutation');return result},key)}catch(e){errorLeft=e.message}
    const before=structuredClone(b.state);
    try{right=host?b.host('test',action):b.dispatch(id,action);if(fail)throw Error('injected after mutation')}catch(e){errorRight=e.message;b.state=before}
    assert.equal(errorLeft,errorRight);if(!errorLeft)assert.deepEqual(left,right);assert.deepEqual(a.state,b.state);assert.doesNotThrow(()=>structuredClone(a.state));
    return left;
  }
  return {a,b,tradeId,command,advance:n=>{now+=n}};
}
test('real Engine barter, supplier credit, assist completion and rejected mutations match full-state rollback',()=>{
  const f=enginePair();let seq=0;
  for(const id of ['a','b'])f.command(id,{type:'tradeConfirm',tradeId:f.tradeId,expectedChapter:0,requestId:`confirm-${id}`});
  f.command('b',{type:'help',preset:0,requestId:'help'});
  f.command('a',{type:'assist',target:'b',expectedChapter:0,requestId:'assist'});
  for(let trip=0;trip<3;trip++)for(let stage=0;stage<4;stage++) {
    const task=f.a.chapterView(f.a.get('b')).task;
    for(const e of [f.a,f.b])e.get('b').position={...task.target};
    const action={type:'task',choice:task.stage==='load'?2:0,expectedChapter:0,expectedStep:task.step,expectedStage:task.stage,requestId:`task-${seq++}`};
    if(task.stage==='deliver')f.command('b',action,{fail:true});
    f.command('b',action);
    if(task.stage==='deliver')f.command('b',action); // idempotent replay
  }
  assert.equal(f.a.get('a').progress[0].assists.length,1);
  assert.equal(f.a.get('a').suppliedConsumed,1);
  f.command(null,{type:'endScoring',reason:'Fixture',requestId:'freeze'},{host:true,fail:true});
  f.command(null,{type:'endScoring',reason:'Fixture',requestId:'freeze'},{host:true});
  assert(f.a.state.snapshot);assert.doesNotThrow(()=>structuredClone(f.a.state.snapshot));
});
test('due boundary reads and failure match full rollback without leaking scoped map',()=>{
  const f=enginePair();f.advance(300000);
  f.command('a',{type:'quiz',index:0,choice:0,expectedChapter:0,requestId:'late'});
  assert.equal(f.a.state.phase,'chapter'); // rejected command rolled back its tick
  f.command(null,{type:'broadcast',message:'Boundary',reason:'Fixture',requestId:'boundary'},{host:true});
  assert.equal(f.a.state.phase,'brag');assert.doesNotThrow(()=>structuredClone(f.a.state));
});
