// Pure browser-independent UI policy, shared by the client and acceptance tests.
export function classifyDevice({
  userAgent = "",
  maxTouchPoints = 0,
  coarsePointer = false,
  mobileHint = false,
} = {}) {
  const touch = maxTouchPoints > 1;
  const mobileUA = /Android|iPhone|iPad|iPod/i.test(userAgent);
  const iPadDesktop = /Macintosh/.test(userAgent) && touch && coarsePointer;
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
