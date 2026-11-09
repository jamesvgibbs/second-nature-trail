// Copy-kernel experiment only. Does not change server rollback or run a game.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFileSync,writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Engine } from '../engine.mjs';
import { reconstructProfileState } from './profile-late-event.mjs';
const jsonCopy=value=>JSON.parse(JSON.stringify(value));
const parts=state=>{const {actions,audit,requests,snapshot,...mutable}=state;return {mutable,history:{actions,audit,requests,snapshot}}};
export function verifyCopyEquivalence(state) {
  const {mutable,history}=parts(state),native=structuredClone(mutable),json=jsonCopy(mutable);
  assert.deepStrictEqual(json,native);
  const checkpoint={...json,...history};
  for(const key of ['actions','audit','requests','snapshot'])assert.strictEqual(checkpoint[key],state[key]);
  return {mutableBytes:Buffer.byteLength(JSON.stringify(mutable)),historyReferencesPreserved:true,deepStrictEqual:true};
}
export function representativeStates() {
  let now=1000000;const e=new Engine({now:()=>now}),cases=[];
  const capture=name=>cases.push({name,state:structuredClone(e.state)});
  capture('draft');
  for(let n=0;n<2;n++){e.addPlayer(`copy-${n}`,`Copy ${n}`);e.dispatch(`copy-${n}`,{type:'setup',character:0,palette:0,insects:false,requestId:`setup-${n}`});}
  e.host('test',{type:'lobby',reason:'Copy fixture',requestId:'lobby'});capture('lobby');
  e.host('test',{type:'start',reason:'Copy fixture',requestId:'start'});capture('countdown');
  now+=10000;e.tick();capture('chapter');
  const {tradeId}=e.dispatch('copy-0',{type:'tradeOffer',target:'copy-1',give:{item:'parts',qty:1},receive:{item:'food',qty:1},expectedChapter:0,requestId:'offer'});
  e.dispatch('copy-0',{type:'tradeConfirm',tradeId,expectedChapter:0,requestId:'confirm-one'});capture('partially-confirmed-trade');
  e.dispatch('copy-1',{type:'tradeConfirm',tradeId,expectedChapter:0,requestId:'confirm-two'});capture('committed-trade');
  e.host('test',{type:'pause',reason:'Copy fixture',requestId:'pause'});capture('paused');
  now+=30000;e.host('test',{type:'resume',reason:'Copy fixture',requestId:'resume'});now=e.state.deadline;e.tick();capture('brag');
  e.host('test',{type:'endScoring',reason:'Copy fixture',requestId:'end'});capture('frozen-finale');
  return cases;
}
export function benchmarkCopies(journal,{rounds=6,copiesPerRound=50}={}) {
  const state=reconstructProfileState(journal),cases=[{name:'actual-history-synthetic-late-mutable',state},...representativeStates()];
  const equivalence=cases.map(({name,state})=>({name,...verifyCopyEquivalence(state)}));
  const {mutable}=parts(state),rows=[];
  for(let i=0;i<10;i++){structuredClone(mutable);jsonCopy(mutable)}
  for(let round=0;round<rounds;round++)for(const method of round%2?['jsonRoundtrip','structuredClone']:['structuredClone','jsonRoundtrip']) {
    const copy=method==='structuredClone'?structuredClone:jsonCopy,samples=[];let last;
    for(let i=0;i<copiesPerRound;i++){const begin=performance.now();last=copy(mutable);samples.push(performance.now()-begin)}
    assert.deepStrictEqual(last,mutable);
    samples.sort((a,b)=>a-b);
    rows.push({round,method,count:samples.length,totalMs:samples.reduce((a,b)=>a+b,0),p50Ms:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)]});
  }
  return {label:'Synthetic copy-kernel microbenchmark; not confirmed-action latency or acceptance evidence',nodeVersion:process.version,equivalence,rounds,copiesPerRound,rows,limitations:['Measured JSON-shaped captured state and representative live engine states only.','JSON cannot preserve undefined, NaN, bigint, cycles or object alias topology; persisted game state must remain JSON-compatible.','History references remain unchanged; no runtime copy method changed by this script.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const[input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/benchmark-checkpoint-copy.mjs JOURNAL.json OUTPUT.json');
  const bytes=readFileSync(input),report=benchmarkCopies(JSON.parse(bytes));
  report.journalSha256=createHash('sha256').update(bytes).digest('hex');
  report.sourceHashes=Object.fromEntries(['server.mjs','engine.mjs','scripts/benchmark-checkpoint-copy.mjs'].map(path=>[path,createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex')]));
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
