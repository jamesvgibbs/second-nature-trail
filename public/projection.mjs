// Transport ordering is independent of wall time and movement request ordering.
const coreKeys = ["serverTime", "event", "me", "chapter", "trades"];
const metadata = new Set(["projectionEpoch", "projectionVersion"]);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function createProjection() {
  return {
    state: null,
    epoch: null,
    fullVersion: 0,
    coreVersion: 0,
    positionVersion: 0,
  };
}

export function reduceProjection(
  current,
  incoming,
  { kind = "full", allowEpoch = false } = {},
) {
  if (
    !["full", "patch", "move"].includes(kind) ||
    !incoming ||
    typeof incoming.projectionEpoch !== "string" ||
    !incoming.projectionEpoch ||
    !Number.isSafeInteger(incoming.projectionVersion) ||
    incoming.projectionVersion < 1
  )
    return current;
  const version = incoming.projectionVersion;
  const epochChanged = incoming.projectionEpoch !== current.epoch;
  if (epochChanged && !(kind === "full" && allowEpoch)) return current;
  const base = epochChanged ? createProjection() : current;
  if (!base.state && kind !== "full") return current;

  const full = kind === "full" && version > base.fullVersion;
  const core = kind !== "move" && version > base.coreVersion;
  const candidatePosition =
    kind === "move" ? incoming.position : incoming.me?.position;
  const position = candidatePosition && version > base.positionVersion;
  if (!full && !core && !position) return current;

  const state = { ...(base.state || {}) };
  const priorPosition = base.state?.me?.position;
  if (full) {
    // Older full views may still carry the newest available peer presence.
    for (const [key, value] of Object.entries(incoming)) {
      if (!metadata.has(key) && !coreKeys.includes(key)) state[key] = value;
    }
  }
  if (core) {
    for (const key of coreKeys)
      if (own(incoming, key)) state[key] = incoming[key];
  }
  const selectedPosition = position ? candidatePosition : priorPosition;
  if (state.me && selectedPosition)
    state.me = { ...state.me, position: selectedPosition };
  if (state.me && Array.isArray(state.players)) {
    state.players = state.players.map((player) =>
      player.id === state.me.id
        ? { ...player, position: state.me.position }
        : player,
    );
  }
  state.projectionEpoch = incoming.projectionEpoch;
  state.projectionVersion = Math.max(base.coreVersion, core ? version : 0);
  return {
    state,
    epoch: incoming.projectionEpoch,
    fullVersion: full ? version : base.fullVersion,
    coreVersion: core ? version : base.coreVersion,
    positionVersion: position ? version : base.positionVersion,
  };
}
