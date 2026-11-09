// Independent evidence auditor: deliberately does not import the engine or content.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CHAPTER_NAMES = ['Move day mayhem', 'The great filter shortage', 'Attack of the clones', 'RIP, my apartment', 'Pest resistance', 'Credit where it’s due', 'Rewards rebellion', 'Reconnect humanity'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const unique = (xs) => [...new Set(xs)];
const draw = (seed, category, id) => createHash('sha256').update(`${seed}:${category}:${id}`).digest('hex');

export function verifyResults(snapshot, { requireFifteen = false, journal = null } = {}) {
  const rankingErrors = [], inventoryErrors = [], actionErrors = [], evidenceGaps = [], objectiveTimeObservations = [];
  const gap = (s) => { if (!evidenceGaps.includes(s)) evidenceGaps.push(s); };
  const rules = snapshot.rules;
  const evidenceLimits = ['Outcome replay uses recorded server correctness; it does not independently prove authored-answer correctness, physical proximity, browser behavior, or human acceptance.'];
  const accepted = [];
  let journalBound = false;
  if (journal) {
    const frozen = { ...snapshot }; delete frozen.operationalAudit;
    const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    journalBound = journal.snapshotHash === hash(journal.snapshot) && journal.snapshotHash === hash(frozen)
      && journal.contentHash === snapshot.contentHash && journal.seed === snapshot.seed
      && journal.snapshotAt === snapshot.at && ['finale','awards','closed'].includes(journal.phase)
      && Date.parse(journal.capturedAt) >= snapshot.at && journal.requestsHash === hash(journal.requests);
    if (!journalBound) actionErrors.push('Supplemental journal binding failed: snapshot/hash/event/capture metadata differs');
    else {
      for (const [key, entry] of Object.entries(journal.requests || {})) {
        let request;
        try { request = JSON.parse(entry.fingerprint); } catch { actionErrors.push(`Malformed accepted request ${key}`); continue; }
        const suffix = ':' + request.requestId;
        if (typeof request.requestId !== 'string' || !key.endsWith(suffix)) { actionErrors.push(`Accepted request identity mismatch ${key}`); continue; }
        accepted.push({ playerId: key.slice(0,-suffix.length), request, result: entry.result });
      }
    }
  }

  if (snapshot.version !== 'trail-0.3.0-draft' || rules.version !== snapshot.version)
    rankingErrors.push('Unsupported or inconsistent rules version; manually review the independent category definitions.');
  if (!Array.isArray(snapshot.ranked) || snapshot.ranked.length !== 8) throw Error('Eight ranked flags required');
  const ranked = snapshot.ranked.map((v, i) => v ? i : -1).filter(i => i >= 0);
  const players = snapshot.players;
  if (new Set(players.map(p => p.id)).size !== players.length) rankingErrors.push('Duplicate player identities');
  const metrics = new Map(players.map(p => {
    const rs = ranked.map(i => p.progress[i]);
    const trades = snapshot.actions.filter(a => a.type === 'qualifyingTrade' && a.supplier === p.id && snapshot.ranked[a.chapter]);
    for (const i of ranked) for(const field of ['score','primary','mistakes','step','budget']) if(!Number.isFinite(p.progress[i][field])) rankingErrors.push(`${p.id}: chapter ${i} ${field} is not finite`);
    const m = {
      inventoryValue: p.items.reduce((n, item) => n + rules.values[item.kind], 0),
      completed: rs.filter(r => r.complete).length,
      total: rs.reduce((n, r) => n + r.score, 0),
      timeMs: rs.reduce((n, r) => n + (r.timeMs || 0), 0),
      assists: rs.reduce((n, r) => n + r.assists.length, 0),
      assistRecipients: unique(rs.flatMap(r => r.assists)).length,
      correct: rs.reduce((n, r) => n + r.quiz.filter(q => q?.correct).length, 0),
      secrets: rs.filter(r => r.secret).length + (p.mystery && ranked.length === 8 ? 1 : 0),
      traders: unique(trades.map(a => a.recipient)).length,
      suppliedConsumed: trades.length,
      mean: ranked.length ? ranked.reduce((n, i) => n + Math.min(100, p.progress[i].score / rules.chapterMaxima[i] * 100), 0) / ranked.length : 0,
    };
    for (const [key, value] of Object.entries(m)) if (p.metrics?.[key] !== value) rankingErrors.push(`${p.id}: frozen metric ${key} differs from independent recomputation`);
    return [p.id, m];
  }));
  const used = new Set(), expectedAwards = [], rankings = [];
  function allocate(category, primary, secondary, qualifies, chapter) {
    const raw = players.filter(qualifies).map(p => ({ id: p.id, name: p.name, metric: primary(p), secondary: secondary(p), draw: draw(snapshot.seed, category, p.id) }));
    raw.sort((a, b) => b.metric - a.metric || b.secondary - a.secondary || (a.draw < b.draw ? -1 : a.draw > b.draw ? 1 : 0));
    rankings.push({ category, ...(chapter === undefined ? {} : { chapter }), rows: raw.map(r => ({ ...r, eligible: !used.has(r.id) })) });
    const winner = raw.find(p => !used.has(p.id));
    if (winner) used.add(winner.id);
    expectedAwards.push({ category, playerId: winner?.id ?? null, name: winner?.name ?? null, metric: winner?.metric ?? null, secondary: winner?.secondary ?? null, reason: winner ? 'Qualified' : 'No qualifying recipient', draw: winner?.draw ?? null, ...(chapter === undefined ? {} : { chapter }) });
  }
  for (const c of ranked) allocate(CHAPTER_NAMES[c], p => p.progress[c].primary, p => c === 5 ? p.progress[c].budget : -p.progress[c].mistakes, p => p.progress[c].complete, c);
  const defs = [
    ['Top hoarder', 'inventoryValue', 'completed', m => m.completed > 0],
    ['Trailblazer', 'timeMs', 'total', m => ranked.length > 0 && m.completed === ranked.length],
    ['Neighborhood hero', 'assists', 'assistRecipients', m => m.assists > 0],
    ['Human intelligence champion', 'correct', 'completed', m => m.correct > 0],
    ['Easter egg hunter', 'secrets', 'completed', m => m.secrets > 0],
    ['Master trader', 'traders', 'suppliedConsumed', m => m.traders > 0],
    ['All-round survivor', 'mean', 'completed', m => m.completed > 0],
  ];
  for (const [name, primary, secondary, eligible] of defs) allocate(name, p => metrics.get(p.id)[primary] * (primary === 'timeMs' ? -1 : 1), p => metrics.get(p.id)[secondary], p => eligible(metrics.get(p.id)));
  if (snapshot.awards.length !== expectedAwards.length) rankingErrors.push('Award count differs from ranked chapters plus seven event categories');
  expectedAwards.forEach((expected, i) => {
    for (const [key, value] of Object.entries(expected)) if (snapshot.awards[i]?.[key] !== value) rankingErrors.push(`Award ${i} ${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(snapshot.awards[i]?.[key])}`);
    if (!Object.hasOwn(expected, 'chapter') && Object.hasOwn(snapshot.awards[i] || {}, 'chapter')) rankingErrors.push(`Award ${i}: unexpected chapter field`);
  });
  const actualIds = snapshot.awards.map(a => a.playerId).filter(Boolean);
  if (new Set(actualIds).size !== actualIds.length) rankingErrors.push('An employee received more than one prize');
  if (requireFifteen && (ranked.length !== 8 || expectedAwards.filter(a => a.playerId).length !== 15)) rankingErrors.push('Normal-event requirement: fifteen distinct qualifying recipients not demonstrated');

  // Item lineage is replayed independently, including the first-transfer-only supplier rule.
  const items = new Map(), allocatedIds = new Set(), consumedCredits = [], loggedCredits = [], reserve = new Map(), tradeIds = new Set();
  for (const a of snapshot.actions) {
    if (a.type === 'join') for (const item of a.allocation) {
      if (allocatedIds.has(item.id)) inventoryErrors.push(`Duplicate allocated item ${item.id}`);
      allocatedIds.add(item.id);
      if (!Object.hasOwn(rules.values,item.kind)) inventoryErrors.push(`Unknown allocated item kind ${item.kind}`);
      items.set(item.id, { ...item, owner: a.playerId });
    }
    if (a.type === 'tradeCompleted') {
      if (tradeIds.has(a.tradeId)) inventoryErrors.push(`Trade committed twice: ${a.tradeId}`);
      tradeIds.add(a.tradeId);
      if (a.from === a.to) inventoryErrors.push(`Self trade ${a.tradeId}`);
      for (const [ids, from, to] of [[a.give, a.from, a.to], [a.receive, a.to, a.from]]) {
        if (ids.length < 1 || ids.length > rules.tradeMaxQuantity) inventoryErrors.push(`Trade quantity invalid: ${a.tradeId}`);
        for (const id of ids) {
          const item = items.get(id);
          if (!item || item.owner !== from) { inventoryErrors.push(`Invalid ownership transfer ${id}`); continue; }
          item.supplier = item.traded ? null : from;
          item.traded = true;
          item.owner = to;
        }
      }
      for (const owner of [a.from, a.to]) if ([...items.values()].filter(i => i.owner === owner).length > rules.storageLimit) inventoryErrors.push(`Cart capacity exceeded after ${a.tradeId}`);
    }
    if (a.type === 'consume') {
      if (a.source === 'inventory') {
        const item = items.get(a.itemId);
        if (!item || item.owner !== a.playerId || item.kind !== a.kind) inventoryErrors.push(`Invalid consumption ${a.itemId}`);
        else if (item.supplier && item.supplier !== a.playerId) consumedCredits.push({ supplier: item.supplier, recipient: a.playerId, itemId: a.itemId, chapter: a.chapter });
        items.delete(a.itemId);
      } else if (a.source === 'personal reserve') {
        if (!Object.hasOwn(rules.values,a.kind)) inventoryErrors.push(`Unknown reserve item kind ${a.kind}`);
        const key = `${a.playerId}:${a.chapter}:${a.kind}`, n = (reserve.get(key) || 0) + 1;
        reserve.set(key, n);
        if (n > rules.reservePerChapter) inventoryErrors.push(`Reserve exceeded: ${key}`);
      } else inventoryErrors.push('Unknown item consumption source');
    }
    if (a.type === 'qualifyingTrade') loggedCredits.push({ supplier: a.supplier, recipient: a.recipient, itemId: a.itemId, chapter: a.chapter });
  }
  if (!same(consumedCredits, loggedCredits)) inventoryErrors.push('Qualifying trade credits do not match consumed first-transfer provenance');
  for (const p of players) {
    const actual = [...items.values()].filter(i => i.owner === p.id).sort((a,b) => a.id.localeCompare(b.id));
    const recorded = [...p.items].sort((a,b) => a.id.localeCompare(b.id));
    if (actual.length !== recorded.length) inventoryErrors.push(`${p.id}: final inventory count differs`);
    recorded.forEach((item, i) => {
      for (const key of ['id', 'kind', 'supplier', 'traded']) if ((actual[i]?.[key] ?? null) !== (item[key] ?? null)) inventoryErrors.push(`${p.id}: final item ${item.id} ${key} differs`);
    });
  }
  if ([...items.values()].some(i => !players.some(p => p.id === i.owner))) inventoryErrors.push('Inventory belongs to unknown player');

  // Replay scored outcomes, not answer-key correctness: the immutable ledger records
  // correctness but generally omits the submitted authored answer/puzzle contents.
  const replay = new Map(players.map(p => [p.id, Array.from({length:8}, () => ({ score:0, primary:0, mistakes:0, step:0, hits:0, budget:0, quiz:[null,null], secret:false, assists:[], complete:false, at:null, unknownPrimary:false }))]));
  const completions = [3,6,6,6,3,3,7,3];
  function finish(r, c, at) { r.step++; if (r.step === completions[c]) { r.complete = true; r.at = at; } }
  const maxCargo = Math.max(...rules.cargoPlans.map(plan => Object.entries(plan).reduce((n,[kind,qty]) => n + rules.values[kind]*qty,0)));
  for (const a of snapshot.actions) {
    const r = replay.get(a.playerId)?.[a.chapter];
    if (!r) continue;
    const penalize = () => { r.mistakes++; r.score = Math.max(0, r.score-rules.mistakePenalty); };
    if (a.type === 'quiz') {
      if (r.quiz[a.index] !== null) actionErrors.push(`${a.playerId}: repeated scored quiz ${a.chapter}/${a.index}`);
      r.quiz[a.index] = a.correct;
      if (a.correct) r.score += rules.quizPoints;
    } else if (a.type === 'secret') r.secret = true;
    else if (a.type === 'challenge') { if (a.correct) r.score += rules.challengePoints; else penalize(); }
    else if (a.type === 'assistCompleted') {
      if (r.assists.includes(a.target) || replay.get(a.target)?.[a.chapter].assists.includes(a.playerId)) actionErrors.push('Duplicate or reciprocal assist credited');
      if (!r.assists.length) r.score += rules.assistPoints;
      r.assists.push(a.target);
    } else if (a.type === 'delivery') {
      r.primary += a.value; r.score += Math.round(a.value/maxCargo*rules.taskPoints); finish(r, a.chapter, a.at);
    } else if (a.type === 'spatialTask') {
      if (a.correct) { r.primary += a.chapter === 3 ? rules.spatialTaskPoints : 1; r.score += rules.spatialTaskPoints; finish(r,a.chapter,a.at); }
      else { penalize(); if (a.chapter !== 2) r.primary--; else if (typeof a.falseAccusation === 'boolean') r.primary -= Number(a.falseAccusation); else { r.unknownPrimary=true; gap('Wrong clone submissions omit falseAccusation; clone primary cannot be replayed for affected players.'); } }
    } else if (a.type === 'target') {
      if (a.correct) { r.primary++; r.hits++; if (r.hits % rules.targetHitsPerSite === 0) { r.score += rules.taskPoints; finish(r,a.chapter,a.at); } }
      else { r.primary--; penalize(); }
    } else if (a.type === 'route') {
      if (a.correct) { r.primary++; r.score += rules.taskPoints; finish(r,a.chapter,a.at); } else { r.primary--; penalize(); }
    } else if (a.type === 'payment') {
      r.budget=a.retained; if(a.onTime) { r.primary++; r.score += rules.taskPoints; } else r.mistakes++;
      finish(r,a.chapter,a.at);
    } else if (a.type === 'rewardRedeemed' && !r.complete) finish(r,a.chapter,a.at);
  }
  const chapterOpenings = new Map(snapshot.actions.filter(a => a.type === 'phase' && a.phase === 'chapter').map(a => [a.chapter, a.boundary-(a.chapter === 0 ? rules.countdownMs : 0)]));
  const intervened = (snapshot.audit || []).some(a => ['pause','resume','advance','shorten','skip','endScoring'].includes(a.type));
  const completionRecords = new Map();
  for (const record of snapshot.actions.filter(a => a.type === 'objectiveCompleted')) {
    const key = `${record.playerId}:${record.chapter}`;
    if (completionRecords.has(key)) actionErrors.push(`Duplicate exact objective completion: ${key}`);
    completionRecords.set(key,record);
    const player = players.find(p => p.id === record.playerId);
    if (!player?.progress[record.chapter]?.complete) actionErrors.push(`Exact completion for unknown or incomplete objective: ${key}`);
    if (![record.at,record.completedAt,record.chapterOpenedAt,record.timeMs].every(Number.isFinite)
      || record.at !== record.completedAt || record.timeMs < 0
      || record.completedAt > snapshot.at
      || record.timeMs !== record.completedAt-record.chapterOpenedAt)
      actionErrors.push(`Invalid exact objective completion: ${key}`);
  }
  for (const p of players) {
    const mysteryEvents = snapshot.actions.filter(a => a.type === 'mystery' && a.playerId === p.id && a.correct);
    const mysteryRequests = accepted.filter(a => a.playerId === p.id && a.request.type === 'mystery' && a.request.expectedChapter === 7 && a.result?.correct === true && a.result?.ok === true);
    if (p.mystery && !mysteryEvents.length && !mysteryRequests.length) {
      gap('Successful mystery input is absent from actions/bound journal; discovery mystery credit relies on the frozen player flag.');
      if (journalBound) actionErrors.push(`${p.id}: bound complete accepted-request journal has no mystery success`);
    }
    if (p.mystery && p.progress.some(r => !r.secret)) actionErrors.push(`${p.id}: mystery credit without all eight secrets`);
    if (!p.mystery && (mysteryEvents.length || mysteryRequests.length)) actionErrors.push(`${p.id}: accepted mystery success missing from frozen progress`);
    if (journalBound) {
      for (const acceptedQuiz of accepted.filter(a => a.playerId===p.id && a.request.type==='quiz' && a.result?.first)) {
        const a=acceptedQuiz;
        const q=p.progress[a.request.expectedChapter]?.quiz[a.request.index];
        if(q?.correct !== a.result.correct || q?.choice !== a.request.choice) actionErrors.push(`${p.id}: accepted first quiz input/result differs from snapshot`);
      }
      p.progress.forEach((r,c) => r.quiz.forEach((q,index) => {
        if(q && !accepted.some(a => a.playerId===p.id && a.request.type==='quiz' && a.request.expectedChapter===c && a.request.index===index && a.result?.first)) actionErrors.push(`${p.id}: scored quiz lacks accepted first submission in journal`);
      }));
    }
    p.progress.forEach((actual,c) => {
      const r = replay.get(p.id)[c];
      for (const key of ['score','mistakes','step','complete','secret']) if (actual[key] !== r[key]) actionErrors.push(`${p.id} chapter ${c}: ${key} differs from action replay`);
      if (!r.unknownPrimary && actual.primary !== r.primary) actionErrors.push(`${p.id} chapter ${c}: primary differs from action replay`);
      if (!same(actual.assists,r.assists)) actionErrors.push(`${p.id} chapter ${c}: assists differ from action replay`);
      if (!same(actual.quiz.map(q => q?.correct ?? null),r.quiz)) actionErrors.push(`${p.id} chapter ${c}: quizzes differ from action replay`);
      if(c===4 && actual.targetHits!==r.hits) actionErrors.push(`${p.id}: target hits differ`);
      if(c===5 && actual.budget!==r.budget) actionErrors.push(`${p.id}: retained budget differs`);
      if(r.complete) {
        const exact=completionRecords.get(`${p.id}:${c}`);
        if(exact) {
          if(actual.timeMs!==exact.timeMs) actionErrors.push(`${p.id} chapter ${c}: frozen objective time differs from exact completion record`);
          if(!intervened && c>0 && chapterOpenings.has(c) && exact.chapterOpenedAt!==chapterOpenings.get(c)) actionErrors.push(`${p.id} chapter ${c}: exact opening differs from normal chapter boundary`);
          objectiveTimeObservations.push({playerId:p.id,chapter:c,source:'objectiveCompleted',frozenTimeMs:actual.timeMs,completedAt:exact.completedAt,chapterOpenedAt:exact.chapterOpenedAt,outcomeLoggedAt:r.at,logDelayMs:r.at-exact.completedAt});
        } else if(intervened) gap('Legacy objective times after operator recovery require a separate schedule reconstruction; exact completion records are absent.');
        else if(!chapterOpenings.has(c)) gap('Chapter boundary records missing; objective times cannot all be replayed.');
        else {
          const impliedCompletion=chapterOpenings.get(c)+actual.timeMs;
          objectiveTimeObservations.push({playerId:p.id,chapter:c,source:'legacy frozen progress',frozenTimeMs:actual.timeMs,outcomeLoggedAt:r.at,impliedCompletionAt:impliedCompletion,logDelayMs:r.at-impliedCompletion});
          if(!Number.isFinite(actual.timeMs) || actual.timeMs<0) actionErrors.push(`${p.id} chapter ${c}: invalid frozen objective time`);
          gap('Legacy objective completion time is stored in frozen progress, but outcome logs use a separate clock read (before cargo completion, after other completions). Exact objective-time action replay is unavailable.');
        }
      }
    });
  }
  return {
    rankingPass: rankingErrors.length===0,
    rankingQualification: 'Independent allocation conditional on frozen player inputs and recorded outcomes; not proof of authored-answer correctness.',
    inventoryReplayPass: inventoryErrors.length===0,
    recordedOutcomeReplayPass: actionErrors.length===0,
    fullActionReconciliationPass: actionErrors.length===0 && evidenceGaps.length===0,
    fifteenQualifyingDistinctRecipients: expectedAwards.filter(a=>a.playerId).length===15 && used.size===15,
    rankingErrors, inventoryErrors, actionErrors, evidenceGaps, evidenceLimits, journalBound,
    expectedAwards, rankings,
    independentMetrics: Object.fromEntries(metrics), objectiveTimeObservations,
  };
}

export function auditPhases(report, rules, { playerCount=100 }={}) {
  const errors=[], expectedIds=[...Array.from({length:playerCount},(_,i)=>`load-player-${i}`),'operator-one','operator-two','presentation'];
  const expected=[];
  let offset=0;
  for(let c=0;c<8;c++) {
    expected.push({phase:'chapter',offset});
    offset+=rules.chapterMs-(c===0 ? rules.countdownMs : 0);
    expected.push({phase:'brag',offset});
    offset+=rules.breakMs;
  }
  expected.push({phase:'finale',offset}); offset+=rules.finaleMs;
  expected.push({phase:'awards',offset});
  const first=report.phaseSamples.find(s=>s.client==='presentation' && s.phase==='chapter' && Number.isFinite(s.previousDeadline));
  if(!first) errors.push('Presentation first timed boundary missing');
  const origin=first?.previousDeadline;
  let maxLag=null, negatives=0, observations=0;
  const perClient=[];
  for(const id of expectedIds) {
    const all=report.phaseSamples.filter(s=>s.client===id);
    const timed=all.filter(s=>Number.isFinite(s.previousDeadline));
    if(timed.length!==expected.length) errors.push(`${id}: ${timed.length}/${expected.length} timed observations`);
    if(all.at(-1)?.phase!=='awards') errors.push(`${id}: did not observe final awards phase`);
    timed.forEach((s,i)=>{
      observations++;
      if(s.phase!==expected[i]?.phase) errors.push(`${id}: boundary ${i} wrong phase`);
      if(origin!==undefined && s.previousDeadline!==origin+expected[i]?.offset) errors.push(`${id}: boundary ${i} scheduled deadline differs`);
      const lag=s.receivedAt-s.previousDeadline;
      if(!Number.isFinite(s.receivedAt) || !Number.isFinite(s.serverTime)) errors.push(`${id}: missing receipt/server time`);
      if(!Number.isFinite(s.arrivalLagMs) || Math.abs(lag-s.arrivalLagMs)>2) errors.push(`${id}: inconsistent recorded lag`);
      if(lag<0) { negatives++; errors.push(`${id}: early transition ${lag}ms`); }
      if(lag>1000) errors.push(`${id}: transition delayed ${lag}ms`);
      if(Number.isFinite(lag)) maxLag=maxLag===null ? lag : Math.max(maxLag,lag);
    });
    perClient.push({id,timedObservations:timed.length,lastPhase:all.at(-1)?.phase??null});
  }
  for(const id of unique(report.phaseSamples.map(s=>s.client))) if(!expectedIds.includes(id)) errors.push(`Unexpected connection identity ${id}`);
  return {pass:errors.length===0,qualification:'Localhost Node SSE receipt only; no browser painting or representative-network clock claim. Raw samples omit chapter IDs; expected schedule is checked using phase sequence and deadlines.',expectedConnections:expectedIds.length,expectedTimedBoundariesPerConnection:expected.length,observations,maxLagMs:maxLag,negativeLags:negatives,errors,perClient};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [exportPath, reportPath, outputPath, journalPath]=process.argv.slice(2);
  if(!exportPath) throw Error('Usage: node scripts/verify-results.mjs EXPORT.json [LOAD_REPORT.json] [OUTPUT.json] [JOURNAL.json]');
  const snapshot=JSON.parse(readFileSync(exportPath,'utf8'));
  const result={...verifyResults(snapshot,{requireFifteen:!!reportPath,journal:journalPath ? JSON.parse(readFileSync(journalPath,'utf8')) : null}),...(reportPath ? {phases:auditPhases(JSON.parse(readFileSync(reportPath,'utf8')),snapshot.rules)} : {})};
  const json=JSON.stringify(result,null,2)+'\n';
  if(outputPath) writeFileSync(outputPath,json,{flag:'wx',mode:0o600}); else process.stdout.write(json);
  // Exit distinguishes demonstrable contradictions from explicitly reported missing evidence.
  if(!result.rankingPass || !result.inventoryReplayPass || !result.recordedOutcomeReplayPass || result.phases?.pass===false) process.exitCode=1;
}
