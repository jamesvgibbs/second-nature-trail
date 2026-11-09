// Local capacity exercise. This imports authored answers only in the test process.
// A shortened run is a smoke test, never the scope's one-hour capacity evidence.
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createGameServer } from "../server.mjs";
import { CHAPTERS, RULES, ACTIVITY_STOPS } from "../content.mjs";
import { findPath, isWalkable } from "../public/world.mjs";
import { nextWaypoint } from "./load-navigation.mjs";
import { solveRoute } from "./load-routing.mjs";
import { createProjection, reduceProjection } from "../public/projection.mjs";
import {
  createTimingRecorder,
  quantile,
  SCORING_ACTIONS,
} from "./load-timings.mjs";

const sourceHashes = Object.fromEntries(
  [
    "server.mjs",
    "engine.mjs",
    "content.mjs",
    "public/world.mjs",
    "public/app.js",
    "public/helpers.mjs",
    "public/performance.mjs",
    "public/projection.mjs",
    "public/style.css",
    "scripts/load.mjs",
    "scripts/load-navigation.mjs",
    "scripts/load-routing.mjs",
    "scripts/load-timings.mjs",
  ].map((path) => [
    path,
    createHash("sha256")
      .update(readFileSync(new URL("../" + path, import.meta.url)))
      .digest("hex"),
  ]),
);
const duration = Number(process.env.LOAD_SECONDS || 3605);
const joinWindow = Number(process.env.LOAD_JOIN_SECONDS || 60);
const count = Number(process.env.LOAD_PLAYERS || 100);
const out = resolve(process.env.LOAD_OUTPUT || "test-results/load-latest.json");
const timingOut = out.replace(/\.json$/, "") + ".timings.json";
if (existsSync(timingOut))
  throw Error("Choose a fresh LOAD_OUTPUT; raw timings already exist");
const startChapter = Number(process.env.LOAD_START_CHAPTER || 0);
const variedStarts = process.env.LOAD_VARIED_STARTS === "1";
if (variedStarts && startChapter === 0)
  throw Error("Varied starts are only allowed in explicit chapter scenarios");
if (
  !Number.isFinite(duration) ||
  duration < 5 ||
  !Number.isFinite(joinWindow) ||
  joinWindow < 0 ||
  count < 2 ||
  !Number.isInteger(count) ||
  count > 100 ||
  !Number.isInteger(startChapter) ||
  startChapter < 0 ||
  startChapter > 7
)
  throw Error("Invalid load configuration");
const dir = mkdtempSync(join(tmpdir(), "trail-load-"));
const hostTokens = [
  "load-operator-one-0000000000000000",
  "load-operator-two-0000000000000000",
];
const presentationToken = "load-presentation-0000000000000000";
const app = createGameServer({
  dbPath: join(dir, "event.sqlite"),
  hostTokens,
  presentationToken,
  demo: false,
});
const origin = await new Promise((resolve) =>
  app.server.listen(0, "127.0.0.1", () =>
    resolve(`http://127.0.0.1:${app.server.address().port}`),
  ),
);
const started = Date.now(),
  samples = [],
  scoringSamples = [],
  errors = {},
  phaseSamples = [],
  clients = [],
  streams = [];
const timings = createTimingRecorder();
let requests = 0,
  seq = 0,
  stopping = false,
  tradeCompletions = 0,
  reconnects = 0,
  eventStartedAt = null,
  exported = null;
const tradeAttempts = new Set(),
  assistAttempts = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function project(c, incoming, kind, allowEpoch = false) {
  c.projection = reduceProjection(
    c.projection || createProjection(),
    incoming,
    { kind, allowEpoch },
  );
  c.state = c.projection.state;
  return c.state;
}
async function request(path, body, cookie, client) {
  const sentAt = Date.now(),
    phaseAtSend = app.engine.state.phase,
    chapterAtSend = app.engine.state.chapter;
  const begin = performance.now();
  const r = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(client ? { "x-trail-client": client } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await r.json();
  requests++;
  if (path === "/api/action" && r.ok) {
    const elapsed = performance.now() - begin;
    samples.push(elapsed);
    timings.record({
      requestId: body.requestId,
      type: body.type,
      phaseAtSend,
      chapterAtSend,
      phaseAtConfirm: app.engine.state.phase,
      chapterAtConfirm: app.engine.state.chapter,
      sentAt,
      confirmedAt: Date.now(),
      durationMs: elapsed,
      httpStatus: r.status,
      result: value.result,
    });
    if (SCORING_ACTIONS.includes(body.type)) scoringSamples.push(elapsed);
  }
  if (!r.ok) {
    const key = `${r.status}: ${value.error}`;
    errors[key] = (errors[key] || 0) + 1;
  }
  return { r, value, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
async function stream(path, cookie, owner) {
  const generation = owner
    ? (owner.streamGeneration = (owner.streamGeneration || 0) + 1)
    : 0;
  const controller = new AbortController();
  streams.push(controller);
  const response = await fetch(origin + path, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: controller.signal,
  });
  if (!response.ok) throw Error(`SSE ${response.status}`);
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  let allowEpoch = true;
  const pump = (async () => {
    try {
      while (!stopping) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = event.split("\n").find((l) => l.startsWith("data: "));
          if (data) {
            let state = JSON.parse(data.slice(6));
            if (owner) {
              if (owner.streamGeneration !== generation) continue;
              if (Number.isInteger(owner.n)) {
                state = project(owner, state, "full", allowEpoch);
                allowEpoch = false;
              }
              owner.state = state;
              const phase = state.phase || state.event?.phase;
              if (phase !== owner.phase) {
                const previousDeadline = owner.deadline;
                owner.phase = phase;
                phaseSamples.push({
                  client: owner.id,
                  phase,
                  receivedAt: Date.now(),
                  serverTime: state.serverTime ?? state.now ?? null,
                  previousDeadline,
                  arrivalLagMs: previousDeadline
                    ? Date.now() - previousDeadline
                    : null,
                });
                owner.deadline = state.event?.deadline ?? null;
                if (owner.id === "presentation")
                  console.log(
                    JSON.stringify({
                      at: new Date().toISOString(),
                      phase,
                      chapter: state.event?.chapter,
                      chapterCompletionCounts: Array.from(
                        { length: 8 },
                        (_, i) =>
                          Object.values(app.engine.state.players).filter(
                            (p) => p.progress[i].complete,
                          ).length,
                      ),
                      requests,
                      scoringSamples: scoringSamples.length,
                      scoringP95Ms: scoringSamples.length
                        ? [...scoringSamples].sort((a, b) => a - b)[
                            Math.floor(scoringSamples.length * 0.95)
                          ]
                        : null,
                      errors,
                    }),
                  );
              }
            }
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError")
        errors[`stream: ${e.message}`] =
          (errors[`stream: ${e.message}`] || 0) + 1;
    }
  })();
  return { controller, pump };
}
async function act(c, action) {
  if (action.type === "setup")
    action = {
      ...action,
      settingsSequence: (c.settingsSequence = (c.settingsSequence || 0) + 1),
    };
  if (action.type === "move")
    action = {
      ...action,
      movementSequence: (c.movementSequence = (c.movementSequence || 0) + 1),
    };
  if (
    [
      "task",
      "challenge",
      "quiz",
      "secret",
      "mystery",
      "assist",
      "tradeOffer",
      "tradeConfirm",
      "rewardRedeem",
    ].includes(action.type)
  )
    action = { ...action, expectedChapter: c.state.event.chapter };
  if (action.type === "task")
    action = {
      ...action,
      expectedStep:
        c.state.chapter.task?.step ??
        c.state.me.progress[c.state.event.chapter].step,
      expectedStage: c.state.chapter.task?.stage ?? null,
      ...(c.state.event.chapter === 4
        ? { expectedRound: c.state.chapter.task.round }
        : {}),
    };
  const result = await request(
    "/api/action",
    { ...action, requestId: `load-${++seq}` },
    c.cookie,
    c.id,
  );
  if (result.value.state) project(c, result.value.state, "full");
  if (result.value.patch) project(c, result.value.patch, "patch");
  if (result.value.position) project(c, result.value, "move");
  return result;
}
async function tickPlayer(c) {
  if (!c.state || c.offlineUntil) return;
  const me = c.state.me || c.state.player || c.state.self;
  const phase = c.state.phase || c.state.event?.phase;
  if (!me) return;
  if (!me.setup) {
    await act(c, {
      type: "setup",
      character: c.n % 12,
      palette: c.n % 4,
      insects: false,
      settings: { reducedMotion: true },
    });
    return;
  }
  if (phase === "lobby") {
    if (c.started) return;
    if (!me.tutorial.includes("move"))
      await act(c, { type: "move", x: 640, y: 380 });
    for (const step of ["move", "interact", "collect", "answer", "help"])
      if (!c.state.me.tutorial.includes(step)) {
        if (step === "help") await act(c, { type: "help", preset: 0 });
        await act(c, {
          type: "tutorial",
          step,
          ...(step === "answer" ? { choice: 0 } : {}),
        });
      }
    if (!me.ready) await act(c, { type: "ready" });
    return;
  }
  if (phase === "chapter" || phase === "play" || phase === "chapter_play") {
    const chapterIndex =
      c.state.chapterIndex ??
      c.state.chapter?.index ??
      c.state.event?.chapter ??
      0;
    const chapter = CHAPTERS[chapterIndex];
    if (!chapter) return;
    const progress = me.progress?.[chapterIndex] || {};
    const publicTask = c.state.chapter?.task;
    for (let quizIndex = 0; quizIndex < 2; quizIndex++)
      if (!progress.quiz?.[quizIndex])
        await act(c, {
          type: "quiz",
          index: quizIndex,
          choice: chapter.questions[quizIndex].answer,
        });
    if (!progress.complete) {
      const location = publicTask?.target || chapter.locations[0];
      if (
        Math.hypot(me.position.x - location.x, me.position.y - location.y) > 50
      ) {
        navigate(c, location);
        return;
      }
      c.destination = null;
      if (chapterIndex === 7) {
        const path = solveRoute(publicTask);
        if (!path)
          throw Error(
            `No public constrained route for step ${publicTask.step}`,
          );
        await act(c, { type: "task", path });
      } else if (chapterIndex === 4) {
        if (
          !publicTask.actedThisRound &&
          Date.now() >= publicTask.actionAllowedAt &&
          Date.now() + 500 < publicTask.nextRoundAt
        )
          await act(c, {
            type: "task",
            choice: publicTask.targets.findIndex((t) => t.marked),
          });
      } else {
        if (chapterIndex === 5 && Date.now() < publicTask.opensAt) return;
        let choice =
          chapterIndex === 0
            ? publicTask.stage === "load"
              ? c.n % 3
              : 0
            : chapterIndex === 5
              ? 0
              : publicTask.stage === "redeem"
                ? c.n % RULES.rewards.projects.length
                : publicTask.stage === "inspect"
                  ? 0
                  : chapter.tasks[progress.step].answer;
        if (chapterIndex === 0 && publicTask.stage === "load") {
          const possible = (i) =>
            Object.entries(RULES.cargoPlans[i]).every(
              ([kind, qty]) =>
                (me.inventory[kind] || 0) + (progress.reserve[kind] || 0) >=
                qty,
            );
          if (!possible(choice)) choice = [0, 1, 2].find(possible);
          if (choice === undefined) return;
        }
        await act(c, { type: "task", choice });
      }
    } else if (!progress.secret || !progress.challenge) {
      const location = chapter.locations[1];
      if (
        Math.hypot(me.position.x - location.x, me.position.y - location.y) > 90
      ) {
        navigate(c, location);
        return;
      }
      c.destination = null;
      if (!progress.secret) await act(c, { type: "secret" });
      if (!progress.challenge)
        await act(c, { type: "challenge", choice: chapter.challenge.answer });
    }
    if (c.n % 5 === 0 && !progress.complete && me.help === null)
      await act(c, { type: "help", preset: 0 });
    if (chapterIndex === 7 && me.clues.length === 8 && !me.mystery)
      await act(c, { type: "mystery", answer: "NEIGHBOR" });
  }
  if (
    phase === "finale" &&
    !c.state.event?.finale?.contributors?.includes(me.id)
  )
    await act(c, { type: "finale" });
}
function navigate(c, destination) {
  if (c.destination?.x === destination.x && c.destination?.y === destination.y)
    return;
  c.destination = destination;
  c.path = findPath(c.state.me.position, destination);
  if (!c.path) {
    errors["simulation: no route to " + destination.name] =
      (errors["simulation: no route to " + destination.name] || 0) + 1;
    c.destination = null;
  }
}
const movementTimer = setInterval(() => {
  for (const c of clients) {
    if (
      !c.destination ||
      c.moving ||
      c.offlineUntil ||
      stopping ||
      !["lobby", "chapter"].includes(c.state?.event?.phase)
    )
      continue;
    const d = c.destination,
      p = c.state.me.position;
    if (Math.hypot(d.x - p.x, d.y - p.y) < 25) {
      c.destination = null;
      continue;
    }
    const waypoint = nextWaypoint(p, c.path || []) || d;
    const positionKey = `${p.x},${p.y}`;
    c.stillMoves =
      positionKey === c.lastMovementPosition ? (c.stillMoves || 0) + 1 : 0;
    c.lastMovementPosition = positionKey;
    if (c.stillMoves === 50) {
      const key = `navigation stalled: ${c.id}`;
      errors[key] = (errors[key] || 0) + 1;
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          navigationStall: {
            player: c.id,
            position: p,
            waypoint,
            destination: d,
            path: c.path,
          },
        }),
      );
    }
    c.moving = true;
    act(c, { type: "move", x: waypoint.x, y: waypoint.y })
      .catch((e) => {
        errors[`movement: ${e.message}`] =
          (errors[`movement: ${e.message}`] || 0) + 1;
      })
      .finally(() => (c.moving = false));
  }
}, 100);
try {
  const hostOne = await request("/api/host/login", { token: hostTokens[0] });
  const hostTwo = await request("/api/host/login", { token: hostTokens[1] });
  await stream("/api/events?client=operator-one", hostOne.cookie, {
    id: "operator-one",
  });
  await stream("/api/events?client=operator-two", hostTwo.cookie, {
    id: "operator-two",
  });
  const presentationLogin = await request("/api/presentation/login", {
    token: presentationToken,
  });
  await stream("/api/events?presentation=1", presentationLogin.cookie, {
    id: "presentation",
  });
  await request(
    "/api/host/action",
    { type: "lobby", reason: "Capacity test", requestId: `load-${++seq}` },
    hostOne.cookie,
  );
  const joinStart = Date.now();
  for (let n = 0; n < count; n++) {
    const target = joinStart + (joinWindow * 1000 * n) / Math.max(1, count - 1);
    if (target > Date.now()) await sleep(target - Date.now());
    const id = `load-player-${n}`,
      invitation = app.addInvitation(id, `Load neighbor ${n}`);
    const joined = await request("/api/join", { token: invitation });
    if (!joined.r.ok) throw Error("Join failed");
    const c = { id, n, cookie: joined.cookie, joinedAt: Date.now() };
    clients.push(c);
    c.stream = await stream(`/api/events?client=${id}`, c.cookie, c);
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    await Promise.all(clients.map((c) => tickPlayer(c)));
    await sleep(500);
    await Promise.all(
      clients.map(async (c) => {
        const r = await request("/api/state", undefined, c.cookie);
        project(c, r.value, "full");
      }),
    );
    if (clients.every((c) => c.state.me.ready)) break;
  }
  if (!clients.every((c) => c.state.me.ready))
    throw Error("Simulated players failed tutorial readiness");
  const ledgerPrefill = Number(process.env.LOAD_LEDGER_PREFILL || 0);
  for (let n = 0; n < ledgerPrefill; n++) {
    const c = clients[n % clients.length];
    app.engine.dispatch(c.state.me.id, {
      type: "emote",
      emote: n % 6,
      requestId: `synthetic-prior-action-${n}`,
    });
  }
  for (const c of clients) c.started = true;
  await request(
    "/api/host/action",
    { type: "start", reason: "Capacity test", requestId: `load-${++seq}` },
    hostOne.cookie,
  );
  eventStartedAt = app.engine.state.chapterOpenedAt;
  if (startChapter > 0) {
    // Development-only scenario selection, never normal event timing evidence.
    for (let phase = 0; phase < 1 + startChapter * 2; phase++) {
      const advance = await request(
        "/api/host/action",
        {
          type: "advance",
          reason: "Explicit shortened chapter scenario",
          requestId: `load-${++seq}`,
        },
        hostOne.cookie,
      );
      if (!advance.r.ok)
        throw Error("Could not advance to requested smoke chapter");
    }
    eventStartedAt = app.engine.state.chapterOpenedAt;
    if (variedStarts) {
      // Explicit synthetic setup: deterministic fractional positions within25px
      // of authored sites. This is not player-earned travel or a normal event.
      for (const c of clients) {
        const site = ACTIVITY_STOPS[c.n % ACTIVITY_STOPS.length];
        const angle = c.n * 2.399963229728653;
        let radius = 10 + (c.n % 15);
        let position;
        do {
          position = {
            x: site.x + Math.cos(angle) * radius,
            y: site.y + Math.sin(angle) * radius,
          };
          radius--;
        } while (!isWalkable(position) && radius > 0);
        if (!isWalkable(position))
          throw Error("Could not choose valid scenario start");
        app.engine.get(c.state.me.id).position = position;
      }
      await request(
        "/api/host/action",
        {
          type: "broadcast",
          message: "SYNTHETIC SCENARIO: varied near-site start positions",
          reason: "Record synthetic varied starts",
          requestId: `load-${++seq}`,
        },
        hostOne.cookie,
      );
    }
    await Promise.all(
      clients.map(async (c) => {
        project(
          c,
          (await request("/api/state", undefined, c.cookie)).value,
          "full",
        );
      }),
    );
  }
  while (Date.now() - eventStartedAt < duration * 1000) {
    const elapsed = Date.now() - started;
    const outage = clients[0];
    if (elapsed > (joinWindow + 45) * 1000 && !outage.outageDone) {
      outage.stream.controller.abort();
      outage.offlineUntil = Date.now() + 30000;
      outage.outageDone = true;
    }
    if (outage.offlineUntil && Date.now() >= outage.offlineUntil) {
      outage.stream = await stream(
        `/api/events?client=${outage.id}`,
        outage.cookie,
        outage,
      );
      outage.offlineUntil = null;
      reconnects++;
    }
    for (let i = 0; i + 1 < clients.length; i += 2) {
      const a = clients[i],
        b = clients[i + 1];
      if (
        a.offlineUntil ||
        b.offlineUntil ||
        a.state?.event?.phase !== "chapter"
      )
        continue;
      const key = `${i}:${a.state.chapter.index}`;
      if (
        !assistAttempts.has(key) &&
        !b.state.me.progress[b.state.chapter.index].complete &&
        Math.hypot(
          a.state.me.position.x - b.state.me.position.x,
          a.state.me.position.y - b.state.me.position.y,
        ) < 175
      ) {
        await act(b, { type: "help", preset: 0 });
        const result = await act(a, { type: "assist", target: b.state.me.id });
        if (result.r.ok) assistAttempts.add(key);
      }
      if (tradeAttempts.has(key)) continue;
      tradeAttempts.add(key);
      if (
        (a.state.me.inventory.parts || 0) < 1 ||
        (b.state.me.inventory.food || 0) < 1
      )
        continue;
      const offer = await act(a, {
        type: "tradeOffer",
        target: b.state.me.id,
        give: { item: "parts", qty: 1 },
        receive: { item: "food", qty: 1 },
      });
      const tradeId = offer.value.result?.tradeId;
      if (tradeId) {
        await act(a, { type: "tradeConfirm", tradeId });
        const confirm = await act(b, { type: "tradeConfirm", tradeId });
        if (confirm.value.result?.status === "complete") tradeCompletions++;
      }
    }
    await Promise.all(clients.map((c) => tickPlayer(c)));
    await sleep(4000);
  }
} finally {
  exported = app.engine.state.snapshot ? app.engine.exportResults() : null;
  stopping = true;
  clearInterval(movementTimer);
  for (const c of streams) c.abort();
  await app.close();
  samples.sort((a, b) => a - b);
  scoringSamples.sort((a, b) => a - b);
  const scoreP = (q) => quantile(scoringSamples, q);
  const p = (q) => quantile(samples, q);
  const elapsed = (Date.now() - started) / 1000;
  const timingArtifact = timings.export({
    sourceHashes,
    nodeVersion: process.version,
    rulesVersion: RULES.version,
    contentHash: app.engine.state.contentHash,
    requestedPlayers: count,
    startedAt: new Date(started).toISOString(),
    syntheticPriorActions: Number(process.env.LOAD_LEDGER_PREFILL || 0),
    syntheticVariedNearSiteStarts: variedStarts,
    startChapter,
    network: "localhost; clients and server share this process",
  });
  const clockLags = phaseSamples
    .map((x) => x.arrivalLagMs)
    .filter((x) => Number.isFinite(x) && x >= 0)
    .sort((a, b) => a - b);
  const result = {
    label:
      eventStartedAt &&
      Date.now() - eventStartedAt >= 3600000 &&
      count === 100 &&
      joinWindow === 60 &&
      startChapter === 0
        ? "capacity duration exercised; inspect scenario coverage"
        : "SHORTENED SMOKE TEST, not release capacity acceptance",
    syntheticPriorActions: Number(process.env.LOAD_LEDGER_PREFILL || 0),
    startChapter,
    syntheticVariedNearSiteStarts: variedStarts,
    rulesVersion: RULES.version,
    contentHash: app.engine.state.contentHash,
    sourceHashes,
    nodeVersion: process.version,
    platform: process.platform,
    memoryBytes: process.memoryUsage(),
    startedAt: new Date(started).toISOString(),
    elapsedSeconds: elapsed,
    eventPlaySeconds: eventStartedAt ? (Date.now() - eventStartedAt) / 1000 : 0,
    finalPhase: app.engine.state.phase,
    exportReconciles: exported
      ? JSON.stringify(exported.awards) ===
        JSON.stringify(app.engine.state.awards)
      : null,
    awardCount: app.engine.state.awards.filter((a) => a.playerId).length,
    distinctWinners: new Set(
      app.engine.state.awards.map((a) => a.playerId).filter(Boolean),
    ).size,
    requestedPlayers: count,
    joinedPlayers: clients.length,
    actualJoinSpanSeconds:
      clients.length > 1
        ? (clients.at(-1).joinedAt - clients[0].joinedAt) / 1000
        : 0,
    chapterCompletionCounts: Array.from(
      { length: 8 },
      (_, i) =>
        Object.values(app.engine.state.players).filter(
          (p) => p.progress[i].complete,
        ).length,
    ),
    simulatedMainObjectiveTimesMs: Array.from({ length: 8 }, (_, i) => {
      const values = Object.values(app.engine.state.players)
        .map((p) => p.progress[i])
        .filter((p) => p.complete)
        .map((p) => p.timeMs)
        .sort((a, b) => a - b);
      return {
        samples: values.length,
        p50: values.length ? values[Math.floor(values.length * 0.5)] : null,
        p95: values.length ? values[Math.floor(values.length * 0.95)] : null,
      };
    }),
    rewardProjects: app.engine.state.rewardProjects,
    targetResolutions: Object.values(app.engine.state.players).map(
      (p) => p.progress[4].targetHits,
    ),
    joinWindowSeconds: joinWindow,
    network: "localhost; not the representative company network",
    requests,
    confirmedActionSamples: samples.length,
    rawTimingArtifact: timingOut,
    rawTimingComplete: timingArtifact.complete,
    rawTimingRecords: timingArtifact.recordCount,
    rawTimingDropped: timingArtifact.dropped,
    tradeCompletions,
    reconnectsAfterThirtySecondOutage: reconnects,
    latencyMs: { p50: p(0.5), p95: p(0.95), p99: p(0.99) },
    scoringInventorySamples: scoringSamples.length,
    scoringInventoryLatencyMs: {
      p50: scoreP(0.5),
      p95: scoreP(0.95),
      p99: scoreP(0.99),
    },
    clockTransitionSamples: clockLags.length,
    clockArrivalLagMs: {
      p95: clockLags.length
        ? clockLags[Math.floor(clockLags.length * 0.95)]
        : null,
      max: clockLags.at(-1) ?? null,
      withinOneSecond: clockLags.filter((x) => x <= 1000).length,
    },
    movementProfile:
      "10 requests/second per player while traveling; at most one in-flight per player",
    errors,
    phaseSamples,
    limitations: [
      "No browser rendering measured",
      "No human rehearsal",
      "Inspect tradeCompletions and reconnectsAfterThirtySecondOutage to verify scenario coverage",
      "Phase observations are raw arrival times; no one-second clock compliance claim",
    ],
  };
  mkdirSync(resolve(out, ".."), { recursive: true });
  writeFileSync(timingOut, JSON.stringify(timingArtifact) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  writeFileSync(out, JSON.stringify(result, null, 2));
  writeFileSync(
    out.replace(/\.json$/, ".export.json"),
    JSON.stringify(exported, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        ...result,
        phaseSamples: `${phaseSamples.length} observations in ${out}`,
      },
      null,
      2,
    ),
  );
  rmSync(dir, { recursive: true, force: true });
}
