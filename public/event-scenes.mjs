// Shared arrival and intermission artwork. This model deliberately reads only
// public event/roster fields; it never reads task options, answers or inventories.
const C = Object.freeze({ ink:'#203536', sky:'#bcc9b1', far:'#81958c', grass:'#789170', shade:'#647f65', paper:'#f3e9ca', wood:'#aa875d', timber:'#80654b', roof:'#304e50', wall:'#657773', amber:'#d29a55', mint:'#b6d18f', path:'#c5b88f' });
export function eventSceneModel(view = {}, {mode} = {}) {
  const e = view.event || {}, phase = e.phase === 'paused' ? e.pausedPhase : e.phase;
  mode ||= phase === 'brag' ? 'break' : phase === 'countdown' ? 'countdown' : 'gathering';
  const chapter = Number.isInteger(e.chapter) ? Math.max(0, Math.min(7,e.chapter)) : 0;
  const total = Math.max(1, Number(e.restoration?.perDistrict) || 1);
  const completed = Array.from({length:8},(_,i)=>Math.max(0,Math.min(total,Number(e.contributions?.[i])||0)));
  const connected = (view.players || []).filter(p=>p.connected !== false).length;
  const headline = ({arrival:'A neighborhood worth saving',setup:'Make yourself at home',gathering:'Meet at Bragging Square',countdown:'The trail starts together',break:'Every repair has a story',operator:'Neighborhood field station'})[mode] || 'One shared neighborhood';
  return {mode,phase,chapter,paused:e.phase==='paused'||!!e.paused,headline,connected,total,completed,
    completeDistricts:completed.filter(n=>n>=total).length,
    ready:(view.players||[]).filter(p=>p.ready).length,
    remainingMs:Number.isFinite(e.remainingMs)?Math.max(0,e.remainingMs):null,
    title:String(view.chapter?.title || view.world?.find(c=>c.index===chapter)?.title || ''),
    nextTitle:String(view.world?.find(c=>c.index===chapter+1)?.title || 'The neighborhood finale')};
}
export function drawEventScene(ctx,view={},options={}) {
  const m=eventSceneModel(view,options),r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
  const text=(value,x,y,size=24,color=C.ink,align='left')=>{ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);};
  ctx.save?.();ctx.imageSmoothingEnabled=false;ctx.textBaseline='alphabetic';
  ctx.clearRect(0,0,1200,800);r(0,0,1200,800,C.sky);
  // A continuous horizon and trees tie the event screens to the chapter scenes.
  for(let i=0;i<10;i++){const x=i*140-50,y=184+(i%3)*16;r(x,y,148,116,C.far);r(x+20,y-24,100,32,C.far);}
  r(0,284,1200,516,C.grass);r(0,304,1200,12,'#90a37b');
  const house=(x,y,lit)=>{r(x+8,y+12,156,132,C.shade);r(x,y,152,128,C.wall);for(let n=0;n<5;n++)r(x-12+n*12,y-12-n*8,176-n*24,12,C.roof);r(x+16,y+32,32,36,C.ink);r(x+20,y+36,24,28,lit?C.amber:'#91a59b');r(x+104,y+32,32,36,C.ink);r(x+108,y+36,24,28,lit?C.amber:'#91a59b');r(x+60,y+56,36,72,C.ink);r(x+84,y+92,4,4,C.paper);r(x+56,y+128,44,20,C.path);};
  house(52,240,m.completed[0]>0);house(996,240,m.completed[7]>0);
  r(0,460,1200,76,C.path);r(0,460,1200,8,'#ddd0aa');r(528,480,144,320,C.path);
  // The central board carries eight real district totals, never invented wins.
  r(284,176,632,292,C.timber);r(300,192,600,252,C.paper);r(312,204,576,44,C.roof);
  text(m.mode==='arrival'||m.mode==='setup'?'SECOND NATURE TRAIL':'THE NEIGHBORHOOD NOTICEBOARD',600,234,24,C.paper,'center');
  if(m.mode==='countdown'){text(String(Math.ceil((m.remainingMs||0)/1000)),600,376,112,C.roof,'center');text(m.paused?'COUNTDOWN PAUSED':'SETTING OUT TOGETHER',600,420,20,C.ink,'center');}
  else for(let i=0;i<8;i++){const x=328+(i%4)*136,y=268+Math.floor(i/4)*76;const level=m.completed[i]/m.total;r(x,y,112,48,C.wall);r(x+8,y+8,96,8,C.ink);r(x+8,y+8,Math.round(96*level/4)*4,8,C.mint);text(String(i+1),x+12,y+40,20,C.paper);if(!['arrival','setup'].includes(m.mode))text(`${m.completed[i]}/${m.total}`,x+100,y+40,16,C.paper,'right');}
  r(304,468,16,84,C.timber);r(880,468,16,84,C.timber);
  // A useful cart and three residents are scenic figures, never copied player IDs.
  r(136,584,180,12,C.ink);r(152,540,148,48,C.wood);r(160,548,132,4,C.paper);r(164,592,28,28,C.ink);r(264,592,28,28,C.ink);r(300,556,76,8,C.timber);
  for(const [x,y,shirt]of[[824,568,'#e88960'],[932,600,'#79b8af'],[1032,568,'#d5b84e']]){r(x-20,y+28,48,12,C.shade);r(x-8,y-12,12,40,C.ink);r(x+12,y-12,12,40,C.ink);r(x-16,y-56,48,48,shirt);r(x-8,y-88,32,32,'#d8b686');r(x-12,y-92,40,12,C.timber);r(x,y-72,4,4,C.ink);r(x+16,y-72,4,4,C.ink);}
  r(24,684,1152,92,C.paper);r(24,684,8,92,C.wood);
  text(m.headline,56,724,28);
  const detail=m.paused?'The host has paused the event. Your progress is kept.':m.mode==='break'?`Up next: ${m.nextTitle}`:m.mode==='countdown'?'A fresh district opens for everyone at once.':m.mode==='operator'?`${m.connected} connected · ${m.completeDistricts} districts restored`:m.mode==='setup'?'Choose your look. All neighbors have the same abilities.':m.mode==='arrival'?'Pack useful supplies. Make a choice. Help someone get home.':`${m.connected} connected neighbors · practice before the trail begins`;
  text(detail.length>78?detail.slice(0,75)+'…':detail,56,756,20);
  ctx.restore?.();
  return m;
}
