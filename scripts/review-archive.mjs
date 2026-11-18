// Read-only visual wrapper around a verified historical event snapshot.
// The awards and scores are preserved; this is not a new played event or DB restore.
import http from 'node:http';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extname} from 'node:path';
import {Engine} from '../engine.mjs';
import {verifyResults} from './verify-results.mjs';
const root=new URL('../',import.meta.url),port=Number(process.env.ARCHIVE_REVIEW_PORT||4222);
const prefix='test-results/capacity-current-f7ea6a8',exported=JSON.parse(readFileSync(new URL(prefix+'.export.json',root))),journal=JSON.parse(readFileSync(new URL(prefix+'.journal.json',root)));
const proof=verifyResults(exported,{requireFifteen:true,journal});
assert(proof.rankingPass&&proof.fullActionReconciliationPass&&proof.fifteenQualifyingDistinctRecipients,'Historical results failed independent verification');
const engine=new Engine();assert.equal(engine.state.contentHash,exported.contentHash,'Current presentation content differs from archived rules');
const s=engine.state;s.name='Archived normal-run results';s.phase='awards';s.chapter=7;s.seed=exported.seed;s.ranked=structuredClone(exported.ranked);s.players=Object.fromEntries(exported.players.map(p=>[p.id,structuredClone(p)]));s.participantCount=exported.players.length;s.awards=structuredClone(exported.awards);s.snapshot=structuredClone(journal.snapshot);s.actions=structuredClone(exported.actions);s.audit=structuredClone(exported.audit);s.contributions=Array.from({length:8},(_,i)=>exported.players.filter(p=>p.progress[i].complete).length);s.broadcast='ARCHIVED RESULTS · Verified100-player normal event (f7ea6a8). Current artwork; scores and awards unchanged. Finale outcome was not retained; no new gameplay.';
const originalAwards=JSON.stringify(exported.awards),epoch='archived-'+createHash('sha256').update(originalAwards).digest('hex').slice(0,20);
let projectionVersion=0;
function projection(){const view=engine.presentation();assert.equal(JSON.stringify(view.event.awards),originalAwards);view.players=[];view.event.archive={source:'f7ea6a8',finaleRecorded:false};return{...view,projectionEpoch:epoch,projectionVersion:++projectionVersion};}
const streams=new Set();let closing=false;
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(req.method!=='GET'){res.writeHead(405);res.end('Read-only archived review');return;}if(url.pathname==='/api/presentation'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(projection()));return;}if(url.pathname==='/api/archive-proof'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({label:'Read-only historical results shown by current frontend; no new gameplay',source:prefix,awardCount:exported.awards.filter(a=>a.playerId).length,snapshotHash:journal.snapshotHash,awardsHash:createHash('sha256').update(originalAwards).digest('hex'),independentRanking:proof.rankingPass,independentFullActionReconciliation:proof.fullActionReconciliationPass}));return;}if(url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});res.write('event: state\ndata: '+JSON.stringify(projection())+'\n\n');streams.add(res);req.on('close',()=>streams.delete(res));return;}
 const file=['/','/presentation'].includes(url.pathname)?'index.html':url.pathname.slice(1);if(!/^[\w.-]+\.(html|js|mjs|css|svg|png|ico)$/.test(file)){res.writeHead(404);res.end();return;}try{const bytes=readFileSync(new URL('public/'+file,root));res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'})[extname(file)]);res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.end(bytes);}catch{res.writeHead(404);res.end();}});
const heartbeat=setInterval(()=>{for(const res of streams)res.write(': archived review\n\n');},15000);
server.listen(port,'127.0.0.1',()=>console.log('READONLY ARCHIVED AWARDS http://archive.localhost:'+server.address().port+'/presentation ·15realverifiedrecipients · no mutations accepted'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(closing)return;closing=true;clearInterval(heartbeat);for(const res of streams)res.end();server.close();server.closeAllConnections();});
