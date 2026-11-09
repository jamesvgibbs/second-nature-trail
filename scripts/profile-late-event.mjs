// Synthetic profiling fixture, never capacity, timing, controls, or release evidence.
// Reuses captured players/history, reconstructs missing top-level/trade fields, and
// resets routing opportunities between synchronized HTTP waves. No production hooks.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { performance, monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks';
import { Session } from 'node:inspector';
import { Engine } from '../engine.mjs';
import { createGameServer } from '../server.mjs';
import { RULES } from '../content.mjs';
import { solveRoute } from './load-routing.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const clone = structuredClone;
const stringify = JSON.stringify;
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
const percentile = (xs,q) => xs.length ? [...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*q))] : null;
const distribution = xs => ({count:xs.length,p50:percentile(xs,.5),p95:percentile(xs,.95),p99:percentile(xs,.99),max:xs.length?xs.reduce((a,b)=>Math.max(a,b),-Infinity):null,total:xs.reduce((a,b)=>a+b,0)});

export function reconstructProfileState(journal, now=Date.now()) {
  if(journal.snapshotHash!==sha(stringify(journal.snapshot)) || journal.requestsHash!==sha(stringify(journal.requests))) throw Error('Captured journal hashes differ');
  const state=new Engine().state;
  if(journal.contentHash!==state.contentHash || journal.snapshot.contentHash!==state.contentHash) throw Error('Fixture requires matching frozen content and rules');
  if(journal.snapshot.seed!==journal.seed || journal.snapshot.at!==journal.snapshotAt) throw Error('Journal event binding differs');
  const snapshot=journal.snapshot;
  state.seed=snapshot.seed;
  state.phase='chapter';state.chapter=7;
  state.chapterOpenedAt=now-60000;state.deadline=now+240000;
  state.players=Object.fromEntries(snapshot.players.map(p=>{const {metrics,...player}=clone(p);return [p.id,player]}));
  state.participantCount=snapshot.players.length;
  state.ranked=clone(snapshot.ranked);
  state.actions=clone(snapshot.actions);
  state.requests=clone(journal.requests);
  state.audit=clone(snapshot.audit);
  state.awards=clone(snapshot.awards.filter(a=>Number.isInteger(a.chapter)&&a.chapter<7));
  state.contributions=Array.from({length:8},(_,c)=>snapshot.players.filter(p=>p.progress[c].complete).length);
  state.broadcast='SYNTHETIC LATE-EVENT PROFILE: history retained; opportunities, clock and missing top-level state reconstructed.';
  const completed=new Set(snapshot.actions.filter(a=>a.type==='tradeCompleted').map(a=>a.tradeId));
  for(const [key,entry]of Object.entries(journal.requests)) {
    const request=JSON.parse(entry.fingerprint);
    if(request.type!=='tradeOffer'||!entry.result?.tradeId)continue;
    const from=key.slice(0,-(':'+request.requestId).length),to=request.target,id=entry.result.tradeId;
    state.trades[id]={id,from,to,give:clone(request.give),receive:clone(request.receive),confirmed:completed.has(id)?[from,to]:[],versions:[state.players[from]?.inventoryVersion??0,state.players[to]?.inventoryVersion??0],status:completed.has(id)?'complete':'cancelled'};
  }
  return state;
}

export function instrumentProfile(app, { preparedStatements = [] } = {}) {
  const samples={},batches=[],requestArrivals=new Map();
  let enabled=false,currentBatch=null,restored=false;
  const record=(name,ms)=>{if(enabled)(samples[name]??=[]).push(ms)};
  const measure=(name,fn)=>{const start=performance.now();try{return fn()}finally{record(name,performance.now()-start)}};
  function finishCommandScope() {
    if(enabled && currentBatch?.commandStartedAt!==undefined) {
      const ms=performance.now()-currentBatch.commandStartedAt;
      record('commandScopeIncludingValidation',ms);currentBatch.commandScopeMs+=ms;delete currentBatch.commandStartedAt;
    }
  }
  const originalClone=globalThis.structuredClone,originalStringify=JSON.stringify;
  globalThis.structuredClone=function(value,...rest){
    const category=value===app.engine.state?'batchBackupClone':value?.ranked&&value?.phase&&!value.event&&!value.actions&&!value.requests?'commandCheckpointClone':value?.id&&Array.isArray(value.progress)&&Array.isArray(value.items)?'commandPlayerClone':'otherClone';
    if(enabled && category==='batchBackupClone')currentBatch={commands:0,startedAt:performance.now(),commandScopeMs:0,backupCloneMs:0,checkpointCloneMs:0,playerCloneMs:0,dispatchMs:0,serializationMs:0,sqliteWriteMs:0,commitMs:0};
    if(enabled && currentBatch && category==='commandCheckpointClone'){finishCommandScope();currentBatch.commandStartedAt=performance.now()}
    const start=performance.now();try{return originalClone(value,...rest)}finally{
      const ms=performance.now()-start;record(category,ms);
      if(enabled&&currentBatch){if(category==='batchBackupClone')currentBatch.backupCloneMs+=ms;if(category==='commandCheckpointClone'){currentBatch.checkpointCloneMs+=ms;currentBatch.commands++}if(category==='commandPlayerClone'){currentBatch.checkpointCloneMs+=ms;currentBatch.playerCloneMs+=ms}}
    }
  };
  JSON.stringify=function(value,...rest){
    if(value!==app.engine.state)return originalStringify(value,...rest);
    finishCommandScope();
    const start=performance.now();try{return originalStringify(value,...rest)}finally{
      const ms=performance.now()-start;record('stateSerialization',ms);if(enabled&&currentBatch)currentBatch.serializationMs+=ms;
    }
  };
  const wrapped=[];
  function wrap(object,name,fn){const original=object[name];object[name]=fn(original);wrapped.push(()=>{object[name]=original})}
  wrap(app.engine,'dispatch',original=>function(id,action){
    const start=performance.now(),scoring=action.type!=='move';
    if(enabled&&scoring&&requestArrivals.has(action.requestId))record('httpArrivalToDispatch',start-requestArrivals.get(action.requestId));
    try{return original.call(this,id,action)}finally{
      const ms=performance.now()-start;record(scoring?'scoringDispatch':'movementDispatch',ms);if(enabled&&currentBatch&&scoring)currentBatch.dispatchMs+=ms;
    }
  });
  for(const method of ['view','actionView','hostView','presentation','tick'])wrap(app.engine,method,original=>function(...args){return measure('engine.'+method,()=>original.apply(this,args))});
  const observedStatements=new WeakSet();
  function observeStatement(statement) {
    if(observedStatements.has(statement))return statement;
    observedStatements.add(statement);
    const run=statement.run;
    statement.run=function(...args){const start=performance.now();try{return run.apply(this,args)}finally{const ms=performance.now()-start;record('sqliteStateWrite',ms);if(enabled&&currentBatch)currentBatch.sqliteWriteMs+=ms}};
    wrapped.push(()=>{statement.run=run});
    return statement;
  }
  for(const statement of preparedStatements)observeStatement(statement);
  wrap(app.db,'prepare',original=>function(sql){
    const statement=original.call(this,sql);
    return /^INSERT INTO game/i.test(sql) ? observeStatement(statement) : statement;
  });
  wrap(app.db,'exec',original=>function(sql){
    const start=performance.now();try{return original.call(this,sql)}finally{
      const ms=performance.now()-start;record('sqlite.'+sql,ms);
      if(enabled&&currentBatch&&['COMMIT','ROLLBACK'].includes(sql)){currentBatch.commitMs=ms;currentBatch.durationMs=performance.now()-currentBatch.startedAt;currentBatch.ending=sql;batches.push(currentBatch);currentBatch=null}
    }
  });
  const onRequest=(req,res)=>{
    const id=req.headers['x-profile-request'];
    if(!id||!enabled)return;
    const start=performance.now();requestArrivals.set(id,start);
    res.once('finish',()=>{record('httpArrivalToResponseFinish',performance.now()-start);requestArrivals.delete(id)});
  };
  app.server.prependListener('request',onRequest);
  return {
    start(){for(const key of Object.keys(samples))delete samples[key];batches.length=0;requestArrivals.clear();enabled=true},
    stop(){enabled=false;return {stageTimingMs:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,distribution(v)])),batches:clone(batches),notes:['Stage times overlap: commandScopeIncludingValidation includes checkpoint clones, dispatch, proxy validation and command-loop overhead; dispatch includes engine tick/clone work. Do not add every category.','httpArrivalToDispatch includes body parsing, queue delay, batch backup and preceding commands; it is not pure enqueue wait.','Hooks add measurement overhead equally to baseline/candidate; CPU-profile runs should use matching flags.']}},
    restore(){if(restored)return;restored=true;enabled=false;globalThis.structuredClone=originalClone;JSON.stringify=originalStringify;app.server.removeListener('request',onRequest);for(const undo of wrapped.reverse())undo()},
  };
}

export async function runLateEventProfile({journalPath,outputPath,waves=10,warmupWaves=2,waveGapMs=1000,movement=false,cpuProfilePath=null,label='baseline'}) {
  if(!Number.isInteger(waves)||waves<1||waves>100||!Number.isInteger(warmupWaves)||warmupWaves<0||warmupWaves>10||!Number.isFinite(waveGapMs)||waveGapMs<0)throw Error('Invalid profile options');
  const journalBytes=readFileSync(journalPath),journal=JSON.parse(journalBytes),state=reconstructProfileState(journal);
  const sourceHashes=Object.fromEntries(['engine.mjs','server.mjs','content.mjs','command-checkpoint.mjs','scripts/profile-late-event.mjs'].map(path=>[path,sha(readFileSync(new URL('../'+path,import.meta.url)))]));
  const temp=mkdtempSync(join(tmpdir(),'trail-late-profile-')),dbPath=join(temp,'event.sqlite');
  const db=new DatabaseSync(dbPath),identities=Object.keys(state.players),tokens=new Map(identities.map((id,i)=>[id,`synthetic-profile-invitation-${i}`]));
  db.exec('CREATE TABLE game(id INTEGER PRIMARY KEY,state TEXT NOT NULL);CREATE TABLE invitations(hash TEXT PRIMARY KEY,player TEXT NOT NULL,name TEXT NOT NULL)');
  db.prepare('INSERT INTO game VALUES(1,?)').run(stringify(state));
  for(const [id,token]of tokens)db.prepare('INSERT INTO invitations VALUES(?,?,?)').run(sha(token),id,state.players[id].name);
  db.close();
  const hostTokens=['synthetic-profile-host-one-000000000000','synthetic-profile-host-two-000000000000'],presentationToken='synthetic-profile-presentation-00000000000';
  // Capture even statements cached during server construction; otherwise a
  // cached-write optimization could disappear from the SQLite stage metrics.
  const preparedStatements=[],originalPrepare=DatabaseSync.prototype.prepare;
  let app;
  DatabaseSync.prototype.prepare=function(sql){const statement=originalPrepare.call(this,sql);if(/^INSERT INTO game/i.test(sql))preparedStatements.push(statement);return statement};
  try {app=createGameServer({dbPath,hostTokens,presentationToken,demo:false});}
  finally {DatabaseSync.prototype.prepare=originalPrepare;}
  const origin=await new Promise(resolve=>app.server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${app.server.address().port}`)));
  const streams=[],clients=[],errors=[],scoringSamples=[],moveSamples=[];
  const observer=instrumentProfile(app,{preparedStatements});
  let movementTimer,profileSession,seq=0,measured=false,stopping=false;
  const gc=[];
  const gcObserver=new PerformanceObserver(list=>{if(measured)for(const entry of list.getEntries())gc.push({durationMs:entry.duration,kind:entry.detail?.kind})});
  gcObserver.observe({entryTypes:['gc']});
  const loopDelay=monitorEventLoopDelay({resolution:10});
  async function request(path,body,cookie,client,measuredAction=false) {
    const begin=performance.now();
    const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...(client?{'x-trail-client':client}:{}),...(measuredAction?{'x-profile-request':body.requestId}:{})},body:body===undefined?undefined:stringify(body)});
    const value=await response.json();
    if(measuredAction)(body.type==='move'?moveSamples:scoringSamples).push(performance.now()-begin);
    if(!response.ok)errors.push({path,status:response.status,message:value.error});
    return {cookie:response.headers.get('set-cookie')?.split(';')[0],value,ok:response.ok};
  }
  async function stream(path,cookie,id) {
    const controller=new AbortController(),response=await fetch(origin+path,{headers:{Cookie:cookie},signal:controller.signal});
    if(!response.ok)throw Error(`Profile stream ${id}: ${response.status}`);
    const entry={id,controller,frames:0,bytes:0,ended:false};streams.push(entry);
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    entry.pump=(async()=>{try{while(!stopping){const {value,done}=await reader.read();if(done){entry.ended=true;break}entry.bytes+=value.length;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=frame.split('\n').find(line=>line.startsWith('data: '));if(data){JSON.parse(data.slice(6));entry.frames++}}}}catch(e){if(e.name!=='AbortError')errors.push({stream:id,message:e.message})}})();
  }
  async function wave(number,collect) {
    const step=number%3,target=RULES.routing.sites[step];
    for(const c of clients) {
      const p=app.engine.get(c.id),r=p.progress[7];
      Object.assign(r,{step,complete:false,primary:0,score:0,timeMs:null,pendingAssist:null});
      r.reserve.cable=RULES.reservePerChapter;
      p.position={x:target.x,y:target.y};c.target=target;
    }
    const path=solveRoute(app.engine.chapterView(app.engine.get(clients[0].id)).task);
    if(!path)throw Error('Synthetic routing opportunity has no valid public path');
    const responses=await Promise.all(clients.map(c=>request('/api/action',{type:'task',path,expectedChapter:7,expectedStep:step,expectedStage:null,requestId:`profile-task-${++seq}`},c.cookie,c.id,collect)));
    if(responses.some(r=>!r.ok||!r.value.result?.correct))throw Error('Profile wave did not commit every routing outcome');
    if(waveGapMs)await delay(waveGapMs);
  }
  const inspectorCall=(method,params={})=>new Promise((resolve,reject)=>profileSession.post(method,params,(err,value)=>err?reject(err):resolve(value)));
  try {
    for(const id of identities) {
      const login=await request('/api/join',{token:tokens.get(id)});
      if(!login.ok)throw Error('Synthetic fixture join failed');
      const c={id,cookie:login.cookie,sequence:0,moving:false,target:RULES.routing.sites[0]};clients.push(c);
      await stream(`/api/events?client=${encodeURIComponent(id)}`,c.cookie,id);
    }
    for(let i=0;i<2;i++){const login=await request('/api/host/login',{token:hostTokens[i]});await stream(`/api/events?client=profile-operator-${i}`,login.cookie,`operator-${i}`)}
    const display=await request('/api/presentation/login',{token:presentationToken});await stream('/api/events?presentation=1',display.cookie,'presentation');
    if(movement)movementTimer=setInterval(()=>{
      for(const c of clients){if(c.moving||stopping)continue;c.moving=true;
        const sequence=++c.sequence;
        request('/api/action',{type:'move',x:c.target.x+(sequence%2?12:-12),y:c.target.y,movementSequence:sequence,requestId:`profile-move-${++seq}`},c.cookie,c.id,measured)
          .catch(e=>errors.push({movement:c.id,message:e.message})).finally(()=>{c.moving=false});
      }
    },100);
    for(let i=0;i<warmupWaves;i++)await wave(i,false);
    if(cpuProfilePath){profileSession=new Session();profileSession.connect();await inspectorCall('Profiler.enable');await inspectorCall('Profiler.start')}
    observer.start();loopDelay.enable();loopDelay.reset();measured=true;
    const cpuStart=process.cpuUsage(),begin=performance.now(),memoryStart=process.memoryUsage();
    for(let i=0;i<waves;i++)await wave(i,true);
    measured=false;loopDelay.disable();
    const elapsedMs=performance.now()-begin,cpu=process.cpuUsage(cpuStart),instrumentation=observer.stop();
    const result={label:'SYNTHETIC late-event profile; not a normal event or acceptance run',candidate:label,journalSha256:sha(journalBytes),sourceHashes,nodeVersion:process.version,platform:process.platform,network:'localhost clients/server same process',players:clients.length,operatorConnections:2,presentationConnections:1,waves,warmupWaves,waveGapMs,movement,measuredSeconds:elapsedMs/1000,scoringLatencyMs:distribution(scoringSamples),movementLatencyMs:distribution(moveSamples),cpuMicroseconds:cpu,eventLoopDelayMs:{p50:loopDelay.percentile(50)/1e6,p95:loopDelay.percentile(95)/1e6,p99:loopDelay.percentile(99)/1e6,max:loopDelay.max/1e6},gc,memoryStart,memoryEnd:process.memoryUsage(),initialStateBytes:Buffer.byteLength(stringify(state)),finalStateBytes:Buffer.byteLength(stringify(app.engine.state)),history:{requests:Object.keys(journal.requests).length,actions:journal.snapshot.actions.length,reconstructedTrades:Object.keys(state.trades).length},streams:streams.map(({id,frames,bytes,ended})=>({id,frames,bytes,ended})),errors,...instrumentation,limitations:['Missing top-level fields and historical trade versions are reconstructed, not recovered.','Chapter8 routing steps, positions, reserve and score are reset before each wave; these are synthetic scoring opportunities.','Shared computer activity and instrumentation may affect timings.','Only paired equivalent fixtures can support optimization comparisons; a fresh complete capacity run remains required.']};
    if(profileSession){const {profile}=await inspectorCall('Profiler.stop');mkdirSync(dirname(resolve(cpuProfilePath)),{recursive:true});writeFileSync(cpuProfilePath,stringify(profile));profileSession.disconnect();profileSession=null;result.cpuProfilePath=resolve(cpuProfilePath)}
    mkdirSync(dirname(resolve(outputPath)),{recursive:true});writeFileSync(outputPath,stringify(result,null,2)+'\n');
    return result;
  } finally {
    measured=false;stopping=true;if(movementTimer)clearInterval(movementTimer);loopDelay.disable();gcObserver.disconnect();observer.restore();
    if(profileSession)profileSession.disconnect();
    for(const s of streams)s.controller.abort();
    await app.close();rmSync(temp,{recursive:true,force:true});
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const args=process.argv.slice(2),journalPath=args.shift(),outputPath=args.shift();
  const value=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]};
  if(!journalPath||!outputPath)throw Error('Usage: node scripts/profile-late-event.mjs JOURNAL.json OUTPUT.json [--waves 10] [--warmup 2] [--gap-ms 1000] [--movement] [--cpu-profile FILE] [--label NAME]');
  const result=await runLateEventProfile({journalPath,outputPath,waves:Number(value('--waves')??10),warmupWaves:Number(value('--warmup')??2),waveGapMs:Number(value('--gap-ms')??1000),movement:args.includes('--movement'),cpuProfilePath:value('--cpu-profile')??null,label:value('--label')??'baseline'});
  console.log(stringify({output:outputPath,candidate:result.candidate,scoringLatencyMs:result.scoringLatencyMs,errors:result.errors,stageTimingMs:result.stageTimingMs},null,2));
  if(result.errors.length)process.exitCode=1;
}
