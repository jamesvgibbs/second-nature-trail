// A visibility projection only. Positions, roster membership and game actions stay authoritative.
export function overviewCrowd(view, { presentation = false } = {}) {
  const valid = (p) =>
    p?.id &&
    p.connected !== false &&
    p.setup !== false &&
    Number.isFinite(p.position?.x) &&
    Number.isFinite(p.position?.y);
  const roster = [
    ...new Map(
      (view?.players || []).filter(valid).map((p) => [p.id, p]),
    ).values(),
  ].sort((a, b) => String(a.id).localeCompare(String(b.id), "en"));
  const self =
    !presentation &&
    Number.isFinite(view?.me?.position?.x) &&
    Number.isFinite(view?.me?.position?.y)
      ? { ...roster.find((p) => p.id === view.me.id), ...view.me }
      : null;
  const phase =
    view?.event?.phase === "paused"
      ? view.event.pausedPhase
      : view?.event?.phase;
  const places = ["chapter", "brag"].includes(phase)
    ? [
        view?.chapter?.task?.target,
        ...(view?.chapter?.locations ||
          view?.world?.find((c) => c.index === view?.event?.chapter)
            ?.locations ||
          []),
      ].filter(Boolean)
    : [];
  const center = self?.position || places[0] || { x: 600, y: 380 };
  const peers = roster.filter((p) => p.id !== self?.id);
  const nearby = peers.filter(
    (p) => Math.hypot(p.position.x - center.x, p.position.y - center.y) <= 220,
  );
  const shown = [];
  for (const peer of nearby) {
    // Keep approach markers clear and do not pile sprites on the local player or one another.
    if (
      places.some(
        (p) => Math.hypot(p.x - peer.position.x, p.y - peer.position.y) < 45,
      )
    )
      continue;
    if (
      [...(self ? [self] : []), ...shown].some(
        (p) =>
          Math.hypot(
            p.position.x - peer.position.x,
            p.position.y - peer.position.y,
          ) < 36,
      )
    )
      continue;
    shown.push(peer);
    if (shown.length === (self ? 3 : 4)) break;
  }
  return {
    players: [...shown, ...(self ? [self] : [])],
    total: roster.length,
    nearby: nearby.length,
    hidden: Math.max(0, roster.length - shown.length - (self ? 1 : 0)),
    selfId: self?.id || null,
  };
}
