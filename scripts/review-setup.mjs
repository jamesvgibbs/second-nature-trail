// Cancel-safe local launcher wait. The caller owns the generation and normal
// operator API; no event state is mutated here.
export async function awaitReviewSetup({readState,isCurrent,resume,pause,humanId}) {
  while (isCurrent()) {
    const state = await readState();
    // A manual Pause/Restart may have cancelled this launch during the read.
    if (!isCurrent()) return false;
    if (!['paused','lobby'].includes(state.event.phase)) return false;
    const human = state.players.find(player => player.id === humanId);
    if (human?.setup && state.connections.includes(human.id)) {
      await resume(isCurrent);
      return isCurrent();
    }
    await pause();
  }
  return false;
}

// Serialize only short operator requests, not long gameplay workers. In
// particular, inspect Pause's current phase after an in-flight Resume commits.
export function createReviewHostQueue({readState,send}) {
  let tail = Promise.resolve();
  const run = (type,extra={},guard=()=>true) => {
    const next = tail.then(async () => {
      if (!guard()) return;
      if (type === 'pause' && (await readState()).event.phase === 'paused') return;
      if (!guard()) return;
      await send(type,extra);
    });
    tail = next.catch(() => {});
    return next;
  };
  run.idle = () => tail;
  return run;
}


// Enter a fresh finale through normal host actions only after all intended
// participants have both setup and a live connection. A cancelled Play cannot
// freeze a partial crowd or override a newer Pause.
export async function launchReviewFinale({readState,connectCrowd,host,isCurrent,participantIds,expectedTarget}) {
  if (!isCurrent()) return false;
  await connectCrowd();
  if (!isCurrent()) return false;
  let state = await readState();
  if (!isCurrent()) return false;
  for (const id of participantIds) {
    if (!state.players.some(player => player.id === id && player.setup) || !state.connections.includes(id))
      throw Error('Finale launch requires every intended participant to finish setup and connect');
  }
  if (state.event.phase === 'paused') {
    await host('resume', {}, isCurrent);
    state = await readState();
    if (!isCurrent()) return false;
  }
  if (state.event.phase === 'finale' || state.event.phase === 'awards' || state.event.phase === 'closed') return true;
  if (state.event.chapter !== 7 || !['chapter', 'brag'].includes(state.event.phase))
    throw Error('Finale review must start from chapter eight');
  if (state.event.phase === 'chapter') {
    await host('advance', {}, isCurrent);
    state = await readState();
    if (!isCurrent()) return false;
  }
  if (state.event.phase !== 'brag') throw Error('Finale review needs the chapter-eight break');
  // Recheck attendance immediately before the scoring freeze.
  for (const id of participantIds) {
    if (!state.players.some(player => player.id === id && player.setup) || !state.connections.includes(id))
      throw Error('A participant disconnected before the finale could start');
  }
  await host('advance', {}, isCurrent);
  if (!isCurrent()) return false;
  state = await readState();
  if (!isCurrent()) return false;
  if (state.event.phase !== 'finale' || state.event.finale?.target !== expectedTarget)
    throw Error('Finale attendance changed during launch; inspect the frozen target without restarting scoring');
  return true;
}

// Ordinary crowd chapters and the practice lobby use the same setup-safe Play
// contract. Connecting neighbors never starts the lobby or assigns progress.
export async function launchReviewChapter({readState,connectCrowd,host,isCurrent,participantIds}) {
  if (!isCurrent()) return false;
  await connectCrowd();
  if (!isCurrent()) return false;
  const state = await readState();
  if (!isCurrent()) return false;
  for (const id of participantIds) {
    if (!state.players.some(player => player.id === id && player.setup) || !state.connections.includes(id))
      throw Error('Review launch requires every intended participant to finish setup and connect');
  }
  if (state.event.phase === 'paused') await host('resume', {}, isCurrent);
  return isCurrent();
}
