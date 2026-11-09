// Pure browser-independent UI policy, shared by the client and acceptance tests.
export function classifyDevice({
  userAgent = "",
  maxTouchPoints = 0,
  coarsePointer = false,
  anyCoarsePointer = coarsePointer,
  mobileHint = false,
} = {}) {
  const touch = maxTouchPoints > 1;
  const mobileUA = /Android|iPhone|iPad|iPod/i.test(userAgent);
  const iPadDesktop =
    /Macintosh/.test(userAgent) && touch && (coarsePointer || anyCoarsePointer);
  return (mobileUA && (touch || coarsePointer || mobileHint)) || iPadDesktop
    ? "unsupported-mobile"
    : "desktop";
}
export function readStoredPreferences(storage) {
  try {
    const value = JSON.parse(storage.getItem("trail-prefs") || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
export function serverPreferences(v) {
  return {
    ...v,
    textSize: v.textSize / 16,
    control: v.controls,
    music: v.music / 100,
    effects: v.effects / 100,
  };
}
export function clientPreferences(v = {}) {
  return {
    ...v,
    textSize: v.textSize <= 2 ? v.textSize * 16 : v.textSize || 16,
    controls: v.control || v.controls || "keyboard",
    music: (v.music || 0) * 100,
    effects: (v.effects || 0) * 100,
  };
}
export function isValidKeyMap(map) {
  const values = Object.values(map).map((v) => String(v).toLowerCase());
  return (
    values.every((v) => v.trim().length === 1) &&
    new Set(values).size === values.length
  );
}
export function readSafeOverride(storage) {
  try {
    return storage.getItem("trail-safe-override") === "1";
  } catch {
    return true;
  }
}
export function writeSafeOverride(storage, enabled) {
  try {
    if (enabled) storage.setItem("trail-safe-override", "1");
    else storage.removeItem("trail-safe-override");
  } catch {}
}

// All restoration inputs come from the server; connection counts never change progress.
export function restorationProgress(event = {}) {
  const total = Math.max(1, Number(event?.restoration?.perDistrict || 1));
  const counts = Array.from({ length: 8 }, (_, i) =>
    Math.max(0, Number(event?.contributions?.[i] || 0)),
  );
  const districts = counts.map((count) => Math.min(1, count / total));
  const completed = counts.reduce((a, b) => a + b, 0);
  const percent = Math.round((districts.reduce((a, b) => a + b, 0) / 8) * 100);
  return { districts, completed, percent };
}

export function routeSummary(task, path) {
  let cost = 0,
    invalid = false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    const matches = (e) => e.includes(a) && e.includes(b) && a !== b;
    const edge = task.edgeCosts?.find((e) => matches([e.from, e.to]));
    if (
      !(task.edges || []).some(matches) ||
      (task.blockedEdges || []).some(matches)
    )
      invalid = true;
    cost += edge?.cost || 0;
  }
  return {
    cost,
    invalid,
    missing: (task.requiredNodes || []).filter((id) => !path.includes(id)),
  };
}
