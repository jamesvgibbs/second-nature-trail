// Disposable production-mode container smoke, using only synthetic identities.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { randomBytes,createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),revision=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(revision||''))throw Error('Usage: node scripts/smoke-container.mjs <full Git commit>');
const short=revision.slice(0,7),image=`second-nature-trail:${short}`;
const root=process.cwd(),temp=mkdtempSync(join(tmpdir(),`trail-container-${short}-`)),build=join(temp,'source'),suffix=process.pid;
const volume=`trail-smoke-${short}-${suffix}`,restoreVolume=`${volume}-restore`,first=`trail-smoke-${short}-${suffix}`,restored=`${first}-restored`;
const report={build:revision,startedAt:new Date().toISOString(),image,productionDeployed:false,network:'loopback HTTP; Secure cookie flag disabled only for disposable synthetic test',storage:'two disposable Docker named volumes',stopGraceSeconds:3,checks:[],sourceHashes:{},containers:[],cleanup:[]};
const tokens=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')],displayToken=randomBytes(32).toString('hex');
const envfile=join(temp,'synthetic.env');writeFileSync(envfile,`HOST_TOKENS=${tokens.join(',')}\nPRESENTATION_TOKEN=${displayToken}\nCOOKIE_SECURE=0\n`,{mode:0o600});
const streams=[];let seq=0,origin,cookieA,cookieB,hostCookie,backupCookie,displayCookie,knownTrade;
const command=async(args,options={})=>(await exec(args[0],args.slice(1),{cwd:root,maxBuffer:32*1024*1024,...options})).stdout.trim();
const docker=(...args)=>command(['docker',...args]);
const dockerLogs=async name=>{const r=await exec('docker',['logs',name],{cwd:root,maxBuffer:32*1024*1024});return r.stdout+r.stderr;};
const milestone=message=>console.log(JSON.stringify({at:new Date().toISOString(),message}));
const check=(name,data={})=>report.checks.push({name,...data});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,body,cookie,client) {
 const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...(client?{'x-trail-client':client}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json();return {status:response.status,value,cookie:response.headers.get('set-cookie')?.split(';')[0],setCookie:response.headers.get('set-cookie')};
}
async function success(path,body,cookie,client){const r=await api(path,body,cookie,client);assert.equal(r.status,200,`${path}: ${r.status} ${r.value.error}`);return r;}
const action=(cookie,id,type,fields={})=>success('/api/action',{type,requestId:`container-${++seq}`,...fields},cookie,id);
const host=(type,fields={})=>success('/api/host/action',{type,reason:'Synthetic container durability smoke',requestId:`container-host-${++seq}`,...fields},hostCookie);
async function connect(cookie,id,presentation=false) {
 const controller=new AbortController(),response=await fetch(origin+`/api/events?${presentation?'presentation=1':`client=${id}`}`,{headers:{Cookie:cookie},signal:controller.signal});assert.equal(response.status,200);
 const reader=response.body.getReader(),decoder=new TextDecoder(),entry={controller,state:null};streams.push(entry);let buffer='';
 entry.pump=(async()=>{try{while(true){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const message=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=message.split('\n').find(x=>x.startsWith('data: '));if(data)entry.state=JSON.parse(data.slice(6));}}}catch(e){if(e.name!=='AbortError'&&!String(e.message).includes('terminated'))throw e}})();
 for(let i=0;i<100&&!entry.state;i++)await sleep(20);assert(entry.state,'First SSE state missing');return entry;
}
async function disconnectAll(){for(const stream of streams)stream.controller.abort();await Promise.allSettled(streams.map(s=>s.pump));streams.length=0;}
async function startContainer(name,storage){
 await docker('run','-d','--name',name,'--env-file',envfile,'-v',`${storage}:/app/data`,'-p','127.0.0.1::4173',image);
 let binding,healthy=false;
 for(let i=0;i<100;i++){
  const status=JSON.parse(await docker('inspect','--format','{{json .State}}',name));
  if(status.Status==='exited'||status.Status==='dead')throw Error(`Container ${name} exited (${status.ExitCode}): ${await dockerLogs(name)}`);
  try{binding=await docker('port',name,'4173/tcp');if(binding.startsWith('127.0.0.1:')){origin='http://'+binding;if((await api('/health')).status===200){healthy=true;break}}}catch{}
  await sleep(100);
 }
 assert(healthy,`Container ${name} did not become healthy with a loopback port`);report.containers.push({name,loopbackBinding:binding});
 assert.equal(await docker('exec',name,'id','-u'),'1000');assert.equal(await docker('exec',name,'node','--version'),'v24.20.0');
}
async function durableState(cookie){return (await success('/api/state',undefined,cookie)).value;}
function stablePlayer(s){return {phase:s.event.phase,ready:s.me.ready,setup:s.me.setup,insects:s.me.insects,settings:s.me.settings,inventory:s.me.inventory,score:s.me.progress[0].score,quiz:s.me.progress[0].quiz,pausedRemaining:s.event.remainingMs};}
try {
 mkdirSync(build);await command(['git','archive','--format=tar',`--output=${join(temp,'source.tar')}`,revision]);await command(['tar','-xf',join(temp,'source.tar'),'-C',build]);
 for(const path of['server.mjs','engine.mjs','content.mjs','command-checkpoint.mjs','public/app.js','public/projection.mjs','scripts/backup.mjs','Dockerfile'])report.sourceHashes[path]=createHash('sha256').update(readFileSync(join(build,path))).digest('hex');
 milestone('Building exact merged source in clean archive context');
 const built=await exec('docker',['build','-t',image,'--label',`org.opencontainers.image.revision=${revision}`,build],{cwd:root,maxBuffer:32*1024*1024});writeFileSync(resolve(`test-results/container-${short}-build.log`),built.stdout+built.stderr);
 report.imageId=await docker('image','inspect','--format','{{.Id}}',image);report.imageUser=await docker('image','inspect','--format','{{.Config.User}}',image);assert.equal(report.imageUser,'node');
 report.baseImage='node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e';
 await docker('volume','create',volume);await docker('volume','create',restoreVolume);
 const roster=JSON.stringify([{id:'container-a',name:'Container Neighbor A'},{id:'container-b',name:'Container Neighbor B'}]);
 await docker('run','--rm','--env-file',envfile,'-v',`${volume}:/app/data`,image,'node','--input-type=module','-e',"import{writeFileSync}from'node:fs';writeFileSync('/app/data/roster.json',process.argv[1],{mode:0o600});",roster);
 await docker('run','--rm','--env-file',envfile,'-v',`${volume}:/app/data`,image,'node','scripts/roster.mjs','/app/data/roster.json','/app/data/invitations.json','http://localhost');
 await startContainer(first,volume);milestone('Production-mode non-root container running with offline synthetic roster');
 const invitationBytes=await docker('exec',first,'cat','/app/data/invitations.json');const invitations=JSON.parse(invitationBytes).map(x=>new URL(x.url).searchParams.get('invite'));
 hostCookie=(await success('/api/host/login',{token:tokens[0]})).cookie;backupCookie=(await success('/api/host/login',{token:tokens[1]})).cookie;displayCookie=(await success('/api/presentation/login',{token:displayToken})).cookie;
 await host('lobby');cookieA=(await success('/api/join',{token:invitations[0]})).cookie;cookieB=(await success('/api/join',{token:invitations[1]})).cookie;
 const aStream=await connect(cookieA,'container-a'),bStream=await connect(cookieB,'container-b'),display=await connect(displayCookie,'display',true);
 assert.equal(typeof aStream.state.projectionEpoch,'string');assert(Number.isInteger(aStream.state.projectionVersion));assert.equal(display.state.safeVisuals,true);assert.equal(display.state.me,undefined);
 const conflict=await api('/api/host/login',{token:tokens[0]},cookieA);assert.equal(conflict.status,409);assert.equal(conflict.value.code,'PROFILE_ROLE_CONFLICT');assert.equal(conflict.setCookie,null);
 assert.equal((await api('/api/host/state',undefined,displayCookie)).status,401);assert.equal((await success('/api/host/state',undefined,backupCookie)).value.event.phase,'lobby');
 const hostDisplay=await fetch(origin+'/api/presentation',{headers:{Cookie:hostCookie}});assert.equal(hostDisplay.status,200);assert.equal((await hostDisplay.json()).safeVisuals,true);assert.equal((await success('/api/host/state',undefined,hostCookie)).status,200);
 for(const path of['/','/app.js','/projection.mjs','/performance.mjs']){const r=await fetch(origin+path);assert.equal(r.status,200);if(path.endsWith('.mjs'))assert(r.headers.get('content-type').includes('javascript'));}
 check('non-root Node24 production-mode startup, health and public modules');check('two operators, safe display isolation and role-conflict rejection preserve original player');
 await action(cookieA,'container-a','setup',{character:1,palette:1,insects:false,settings:{reducedMotion:true,textSize:1.25},settingsSequence:2});
 const ignored=await action(cookieA,'container-a','setup',{character:1,palette:1,insects:true,settingsSequence:1});assert.equal(ignored.value.result.ignored,true);
 await action(cookieB,'container-b','setup',{character:2,palette:2,insects:false,settingsSequence:1});
 await host('start');
 let state;for(let i=0;i<150;i++){state=await durableState(cookieA);if(state.event.phase==='chapter')break;await sleep(100)}assert.equal(state.event.phase,'chapter');
 const quiz={type:'quiz',index:0,choice:0,expectedChapter:0,requestId:'container-committed-quiz'};
 const quizResult=await success('/api/action',quiz,cookieA,'container-a');assert.equal(quizResult.value.result.correct,true);
 const offered=await action(cookieA,'container-a','tradeOffer',{target:'container-b',give:{item:'parts',qty:1},receive:{item:'food',qty:1},expectedChapter:0});knownTrade=offered.value.result.tradeId;
 await action(cookieA,'container-a','tradeConfirm',{tradeId:knownTrade,expectedChapter:0});assert.equal((await action(cookieB,'container-b','tradeConfirm',{tradeId:knownTrade,expectedChapter:0})).value.result.status,'complete');
 const pending=(await action(cookieA,'container-a','tradeOffer',{target:'container-b',give:{item:'parts',qty:1},receive:{item:'food',qty:1},expectedChapter:0})).value.result.tradeId;
 await host('pause');const before=await durableState(cookieA),beforeStable=stablePlayer(before);assert.equal(before.me.progress[0].score,10);assert.equal(before.me.inventory.parts,2);assert.equal(before.me.inventory.food,4);assert(before.trades.some(t=>t.id===pending));
 await docker('exec',first,'node','scripts/backup.mjs','/app/data/event.sqlite','/app/data/event-backup.sqlite');
 let refused=false;try{await docker('exec',first,'node','scripts/backup.mjs','/app/data/event.sqlite','/app/data/event-backup.sqlite')}catch{refused=true}assert(refused);
 check('committed quiz, atomic barter, pending barter and pause saved; live-WAL backup passed integrity and refused overwrite');
 await disconnectAll(); const stopAt=Date.now();await docker('stop','--timeout','3',first);report.firstStop={elapsedMs:Date.now()-stopAt,state:JSON.parse(await docker('inspect','--format','{{json .State}}',first)),logs:await dockerLogs(first)};milestone(JSON.stringify({firstStop:report.firstStop}));assert.equal(report.firstStop.state.ExitCode,0,'graceful shutdown must complete within the explicit3-second container grace');await docker('rm',first);await startContainer(first,volume);
 await connect(cookieA,'container-a');await connect(cookieB,'container-b');const after=await durableState(cookieA);assert.deepEqual(stablePlayer(after),beforeStable);assert.notEqual(after.projectionEpoch,before.projectionEpoch);assert.equal(after.trades.length,0);
 const replay=await success('/api/action',quiz,cookieA,'container-a');assert.equal(replay.value.patch.me.progress[0].score,10);
 const obsolete=await action(cookieA,'container-a','setup',{character:1,palette:1,insects:true,settingsSequence:1});assert.equal(obsolete.value.result.ignored,true);assert.equal(obsolete.value.patch.me.insects,false);
 assert.equal((await success('/api/host/state',undefined,backupCookie)).value.event.phase,'paused');
 const persisted=JSON.parse(await docker('exec',first,'node','--input-type=module','-e',"import{DatabaseSync}from'node:sqlite';const d=new DatabaseSync('/app/data/event.sqlite',{readOnly:true});const s=JSON.parse(d.prepare('SELECT state FROM game WHERE id=1').get().state);console.log(JSON.stringify({completed:s.trades[process.argv[1]].status,pending:s.trades[process.argv[2]].status}));d.close();",knownTrade,pending));assert.deepEqual(persisted,{completed:'complete',pending:'cancelled'});
 check('container recreation preserved committed score/inventory/preferences/cursor/pause; deduplicated quiz replay; pending trade cancelled; epoch changed');milestone('Durable-volume restart checks passed');
 await disconnectAll();await docker('stop','--timeout','3',first);
 await docker('run','--rm','-v',`${volume}:/source:ro`,'-v',`${restoreVolume}:/app/data`,image,'node','--input-type=module','-e',"import{copyFileSync}from'node:fs';copyFileSync('/source/event-backup.sqlite','/app/data/event.sqlite');");
 await startContainer(restored,restoreVolume);await connect(cookieA,'container-a');await connect(cookieB,'container-b');const restoredState=await durableState(cookieA);assert.deepEqual(stablePlayer(restoredState),beforeStable);assert.equal(restoredState.trades.length,0);assert.notEqual(restoredState.projectionEpoch,after.projectionEpoch);
 assert.equal((await success('/api/action',quiz,cookieA,'container-a')).value.patch.me.progress[0].score,10);
 const integrity=await docker('exec',restored,'node','--input-type=module','-e',"import{DatabaseSync}from'node:sqlite';const d=new DatabaseSync('/app/data/event.sqlite',{readOnly:true});console.log(d.prepare('PRAGMA integrity_check').get().integrity_check);d.close();");assert.equal(integrity,'ok');
 check('backup restored into a fresh volume with intact committed state, session identities, deduplication, pause and SQLite integrity');
 report.passed=true;report.finishedAt=new Date().toISOString();milestone('Fresh-volume backup restoration passed');
} catch(error) {report.passed=false;report.error=error.message;report.finishedAt=new Date().toISOString();process.exitCode=1;}
finally {
 await disconnectAll();
 report.containerDiagnostics=[];
 for(const name of[first,restored]){try{report.containerDiagnostics.push({name,state:JSON.parse(await docker('inspect','--format','{{json .State}}',name)),logs:await dockerLogs(name)})}catch{}}
 for(const name of[first,restored]){try{await docker('rm','-f',name);report.cleanup.push({container:name,removed:true})}catch{report.cleanup.push({container:name,absent:true})}}
 for(const name of[volume,restoreVolume]){try{await docker('volume','rm',name);report.cleanup.push({volume:name,removed:true})}catch(e){report.cleanup.push({volume:name,error:e.message});process.exitCode=1}}
 rmSync(temp,{recursive:true,force:true});writeFileSync(resolve(`test-results/container-${short}.json`),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,error:report.error,image:report.image,imageId:report.imageId,checks:report.checks.length,report:`test-results/container-${short}.json`},null,2));
}
