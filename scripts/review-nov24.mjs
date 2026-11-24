// Durable, loopback-only Nov24 review. All progress uses normal game actions.
// Two explicitly labelled QA identities select opposite first-crossing outcomes;
// the ordinary demo identity has the normal unselected one-in-four chance.
import http from 'node:http';
import {randomBytes, randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createGameServer} from '../server.mjs';
import {shortcutWheelIncident} from '../engine.mjs';
import {awaitReviewSetup, createReviewHostQueue} from './review-setup.mjs';

const directory=resolve('data/nov24-review');
mkdirSync(directory,{recursive:true,mode:0o700});
const manifestPath=resolve(directory,'access.json');
const saveManifest=()=>writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
const manifest=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):{};
const events=new Map();
let closing=false;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function request(f,path,body){
 const r=await fetch(f.origin+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(f.cookie?{Cookie:f.cookie}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json(); if(!r.ok)throw Error(data.error||String(r.status));
 return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const state=f=>request(f,'/api/host/state').then(r=>r.data);
try {
for(const [key,port,wanted] of [['normal',4230,false],['incident',4231,true],['demo',4233,null]]){
 const saved=manifest[key], tokens=saved?.tokens||[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')];
 const displayToken=saved?.displayToken||randomBytes(32).toString('hex');
 const app=createGameServer({dbPath:resolve(directory,key+'.sqlite'),demo:false,hostTokens:tokens,presentationToken:displayToken,secure:false});
 let id=saved?.id||'demo-player';
 if(!saved&&wanted!==null){for(let n=0;n<10000;n++){const candidate=`review-${key}-${n}`;if(shortcutWheelIncident(app.engine.state.seed,candidate,0)===wanted){id=candidate;break;}}}
 const invite=saved?.invite||randomBytes(18).toString('hex');
 if(!saved)app.addInvitation(id,wanted===null?'Your demo neighbor':'Route review neighbor',invite);
 const f={key,app,id,invite,tokens,port,origin:`http://127.0.0.1:${port}`,ticket:0,error:null};events.set(key,f);
 manifest[key]={id,invite,tokens,displayToken,port};saveManifest();
 await new Promise((yes,no)=>{app.server.once('error',no);app.server.listen(port,'127.0.0.1',yes);});
 f.cookie=(await request(f,'/api/host/login',{token:tokens[0]})).cookie;
 f.host=createReviewHostQueue({readState:()=>state(f),send:(type,fields)=>request(f,'/api/host/action',{type,requestId:randomUUID(),reason:'Local Nov24 review control',...fields})});
 if((await state(f)).event.phase==='draft')await f.host('lobby');
}
} catch(error) {
 await Promise.allSettled([...events.values()].map(f=>f.app.close()));
 throw error;
}
async function launch(f){
 const ticket=++f.ticket, current=()=>!closing&&f.ticket===ticket;
 await awaitReviewSetup({readState:()=>state(f),isCurrent:current,humanId:f.id,pause:()=>wait(150),resume:async guard=>{
  const phase=(await state(f)).event.phase;
  if(phase==='lobby')await f.host('start',{},guard);
  else if(phase==='paused')await f.host('resume',{},guard);
 }});
}
const player=f=>`http://nov24-${f.key}.localhost:${f.port}/?invite=${f.invite}`;
const summary=async()=>Promise.all([...events.values()].map(async f=>{const s=await state(f);return {key:f.key,phase:s.event.phase,pausedPhase:s.event.pausedPhase,chapter:s.event.chapter+1,remainingMs:s.event.remainingMs,playerURL:player(f),error:f.error};}));
const control=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4232');
  if(req.method==='GET'&&url.pathname.startsWith('/evidence/')){
   const name=url.pathname.slice('/evidence/'.length)||'evidence.html';
   if(!/^[a-zA-Z0-9-]+\.(png|html|json|tap|txt)$/.test(name))throw Error('Not found');
   const file=resolve('test-results/nov24-demo',name);
   const bytes=readFileSync(file);
   const type=name.endsWith('.png')?(bytes[0]===0xff&&bytes[1]===0xd8?'image/jpeg':'image/png'):name.endsWith('.html')?'text/html; charset=utf-8':'text/plain; charset=utf-8';
   res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff'});res.end(bytes);return;
  }
  if(req.method==='GET'&&url.pathname==='/status'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(await summary()));return;}
  if(req.method==='GET'&&url.pathname==='/'){
   const statuses=(await summary()).sort((a,b)=>(a.key==='demo'?-1:b.key==='demo'?1:0));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
   res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Second Nature Trail · Nov24 review</title><style>body{background:#102731;color:#f3e9ca;font:18px/1.5 system-ui;max-width:1000px;margin:auto;padding:32px}h1,h2{font-family:monospace}section{padding:22px;background:#203d43;margin:20px 0}button,a{font:inherit;color:#bddb9b}button{padding:10px 18px;background:#102731;border:1px solid #bddb9b;cursor:pointer}form{display:inline-block;margin:8px 8px 8px 0}small{display:block}a:focus-visible,button:focus-visible{outline:3px solid #e88960}</style><h1>Your neighborhood, your trail</h1><p><a href="/evidence/">View the screenshots and developer verification</a></p><p>Personal destination visits and an unexpected shortcut setback. Play preserves progress. Complete character setup; the normal countdown starts automatically.</p>${statuses.map(s=>`<section><h2>${s.key==='demo'?'Play the demo':s.key==='normal'?'Developer case: clear crossing':'Developer case: wheel setback'}</h2><p>${s.key==='demo'?'Unselected outcome: every actual rubble crossing has its normal one-in-four chance.':'This QA identity was selected for its first-crossing outcome. No visits, actions, supplies or scores are assigned.'}</p><p>${esc(s.phase)} · Chapter ${s.chapter}${s.error?' · '+esc(s.error):''}</p>${['play','pause','resume'].map(action=>`<form method="post" action="/${action}"${action==='play'?' target="_blank"':''}><input type="hidden" name="event" value="${s.key}"><button>${action==='play'?'Play / continue':action==='pause'?'Pause':'Resume'}</button></form>`).join('')}<small>Saved locally across server restarts. These events are separate from the existing demo.</small></section>`).join('')}<p>✓ means you reached a destination; ? means unexplored. Neither means its objective is finished. Use Map for the same status in text.</p><p>Host access is stored privately in <code>data/nov24-review/access.json</code>. Hosting remains local only.</p>`);return;
  }
  if(req.method!=='POST'||!['/play','/pause','/resume'].includes(url.pathname))throw Error('Not found');
  if(req.headers.origin){const host=new URL(req.headers.origin).hostname;if(host!=='127.0.0.1'&&host!=='localhost'&&!host.endsWith('.localhost'))throw Error('Local review requests only');}
  let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw Error('Request too large');}
  const fields=req.headers['content-type']?.includes('application/json')?JSON.parse(body):Object.fromEntries(new URLSearchParams(body));
  const f=events.get(fields.event);if(!f)throw Error('Unknown review');
  if(url.pathname==='/play'){void launch(f).catch(e=>{f.error=e.message;});res.writeHead(303,{Location:player(f)});}
  else{++f.ticket;await f.host(url.pathname.slice(1));res.writeHead(303,{Location:'/'});}res.end();
 }catch(e){res.writeHead(400,{'Content-Type':'text/plain'});res.end(e.message);}
});
try { await new Promise((yes,no)=>{control.once('error',no);control.listen(4232,'127.0.0.1',yes);}); } catch(error) {
 await Promise.allSettled([...events.values()].map(f=>f.app.close()));
 throw error;
}
console.log('Nov24 review: http://127.0.0.1:4232');
console.log('Private access: '+manifestPath);
async function close(){if(closing)return;closing=true;control.close();await Promise.all([...events.values()].map(f=>f.app.close()));}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void close();});
