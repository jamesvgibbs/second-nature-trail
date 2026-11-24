import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { CHAPTERS } from "../content.mjs";
import { DOORS, isWalkable } from "../public/world.mjs";
import {
  districtScenery,
  SQUARE_TREES,
  ROAD_BANDS,
} from "../public/scenery.mjs";
import { SITE_LABELS } from "../public/trail-visuals.mjs";
import { restorationProgress } from "../public/helpers.mjs";
import { destinationVisit, destinationBadgeBounds } from "../public/destination-visits.mjs";
import { overviewCrowd } from "../public/crowd-view.mjs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
function section(start, end) {
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  assert(a >= 0 && b > a);
  return source.slice(a, b);
}
function view(chapter, phase, arrangement, presentation = false) {
  const loc = CHAPTERS[chapter].locations[0],
    center = ["chapter", "brag", "paused"].includes(phase)
      ? loc
      : { x: 600, y: 380 };
  const positions = [];
  for (let dy = 0; dy <= 160; dy += 40)
    for (let dx = -160; dx <= 160; dx += 40) {
      const p = { x: center.x + dx, y: center.y + dy };
      if (isWalkable(p)) positions.push(p);
    }
  const players = Array.from({ length: 100 }, (_, i) => ({
    id: `p${String(i).padStart(3, "0")}`,
    name: `LONG_NAME_${i}_${"W".repeat(45)}`,
    character: i % 12,
    palette: i % 6,
    connected: true,
    setup: true,
    position:
      arrangement === "stack"
        ? { ...center }
        : { ...positions[i % positions.length] },
    emote: { text: `EMOTE_${i}`, at: Date.now() },
    help: "Help with my task",
  }));
  const me = {
    ...players[0],
    position: { ...center },
    progress: Array.from({ length: 8 }, () => ({
      step: 0,
      delivery: { loaded: null },
    })),
  };
  return {
    event: {
      chapter,
      phase,
      paused: phase === "paused",
      pausedPhase: phase === "paused" ? "chapter" : null,
      contributions: Array(8).fill(25),
      restoration: { perDistrict: 100 },
      rewardProjects: { garden: 1, welcome: 1, festival: 1 },
      finale: { contributors: players.map((p) => p.id) },
    },
    ...(presentation ? {} : { me }),
    chapter: { locations: CHAPTERS[chapter].locations, task: { target: loc } },
    players,
    world: CHAPTERS.map((c, index) => ({ index, locations: c.locations })),
  };
}
function render(state, presentation = false) {
  const marks = [],
    avatars = [];
  let role = "scene";
  const ctx = {
    clearRect() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillRect(x, y, w, h) {
      marks.push({ kind: "rect", role, x, y, w, h, color: this.fillStyle });
    },
    strokeRect(x, y, w, h) {
      marks.push({ kind: "stroke", role, x, y, w, h });
    },
    fillText(text, x, y) {
      marks.push({ kind: "text", role, text, x, y });
    },
  };
  const context = vm.createContext({
    DOORS,
    destinationVisit, destinationBadgeBounds,
    districtScenery,
    SQUARE_TREES,
    ROAD_BANDS,
    SITE_LABELS,
    restorationProgress,
    overviewCrowd,
    isPresentation: presentation,
    state,
    target: null,
    palette: ["a", "b", "c", "d", "e", "f"],
  });
  vm.runInContext(
    section("const districts =", "let hostProjection ="),
    context,
  );
  vm.runInContext(section("function rect(", "function tree("), context);
  vm.runInContext(section("function tree(", "async function host()"), context);
  vm.runInContext(section("function drawRepairs(", "setInterval("), context);
  const draw = context.drawAvatar;
  context.drawAvatar = (ctx, x, y, ...args) => {
    avatars.push({ x, y, index: marks.length });
    const before = role;
    role = "avatar";
    draw(ctx, x, y, ...args);
    role = before;
  };
  context.drawMap(ctx, true);
  return { marks, avatars };
}

test("actual overview paints at most self plus3 nearby peers across all8chapters, lobby, breaks, finale and results", () => {
  for (let chapter = 0; chapter < 8; chapter++)
    for (const phase of [
      "lobby",
      "chapter",
      "paused",
      "brag",
      "finale",
      "awards",
      "closed",
    ])
      for (const arrangement of ["stack", "spread"]) {
        const state = view(chapter, phase, arrangement),
          original = structuredClone(state),
          model = overviewCrowd(state),
          drawn = render(state);
        assert(model.players.length <= 4);
        assert.equal(
          model.players.at(-1).id,
          state.me.id,
          "Self is painted last",
        );
        assert.equal(drawn.avatars.length, model.players.length);
        assert.deepEqual(
          drawn.avatars.map(({ x, y }) => ({ x, y })),
          model.players.map((p) => ({ x: p.position.x, y: p.position.y })),
        );
        assert(
          !drawn.marks.some(
            (m) => m.kind === "text" && /LONG_NAME_|EMOTE_/.test(m.text),
          ),
          "Names/emotes must not stack on actual canvas",
        );
        const reversed = overviewCrowd({
          ...state,
          players: state.players.slice().reverse(),
        });
        assert.deepEqual(
          reversed.players.map((p) => p.id),
          model.players.map((p) => p.id),
        );
        assert.deepEqual(
          state,
          original,
          "Visibility cannot mutate authoritative coordinates/progress",
        );
        const lastAvatar = drawn.marks.findLastIndex(
          (m) => m.role === "avatar",
        );
        const marker = drawn.marks.findIndex(
          (m) => m.kind === "text" && m.text === "!",
        );
        assert(
          marker > lastAvatar,
          "Objective marker must remain above the bounded crowd",
        );
      }
});

test("actual read-only display has no fictitious self and at most4 stable representatives for100players", () => {
  for (let chapter = 0; chapter < 8; chapter++)
    for (const phase of [
      "lobby",
      "chapter",
      "paused",
      "brag",
      "finale",
      "awards",
    ]) {
      const state = view(chapter, phase, "spread", true),
        model = overviewCrowd(state, { presentation: true }),
        drawn = render(state, true);
      assert.equal(model.selfId, null);
      assert.equal(model.total, 100);
      assert(model.players.length <= 4);
      assert.equal(drawn.avatars.length, model.players.length);
      assert(
        !drawn.marks.some(
          (m) => m.kind === "text" && /LONG_NAME_|EMOTE_/.test(m.text),
        ),
      );
      for (const peer of model.players)
        assert(
          state.players.some(
            (p) =>
              p.id === peer.id &&
              p.position.x === peer.position.x &&
              p.position.y === peer.position.y,
          ),
        );
      assert.deepEqual(
        overviewCrowd(
          { ...state, players: state.players.slice().reverse() },
          { presentation: true },
        ).players.map((p) => p.id),
        model.players.map((p) => p.id),
      );
    }
});

test("nearby visibility excludes offline/unset peers and protects both task approaches without hiding the roster", () => {
  const state = view(1, "chapter", "spread"),
    loc = state.chapter.locations[0];
  state.me.position = { x: loc.x, y: loc.y + 80 };
  state.players[1].position = { ...loc };
  state.players[2].position = { ...state.chapter.locations[1] };
  state.players[3].connected = false;
  state.players[4].setup = false;
  const model = overviewCrowd(state);
  assert.equal(model.total, 98);
  assert(model.hidden > 90);
  assert(
    !model.players.some((p) => ["p001", "p002", "p003", "p004"].includes(p.id)),
  );
  for (const p of model.players.filter((p) => p.id !== model.selfId))
    for (const site of state.chapter.locations)
      assert(Math.hypot(p.position.x - site.x, p.position.y - site.y) >= 45);
  assert.equal(state.players.length, 100, "Only drawing visibility is capped");
});


test("personal arrival badges render sixteen distinct site states with100 peers while public presentation has no personal visit markers",()=>{
 const state=view(0,'chapter','stack');state.me.visitedDestinations=Object.fromEntries(DOORS.slice(0,3).map(([x,y])=>[`${x},${y}`,{x,y,at:1000}]));
 const isBadge=m=>m.kind==='text'&&DOORS.some((door,i)=>{const b=destinationBadgeBounds(door,SITE_LABELS[Math.floor(i/2)][i%2]);return m.x===b.x+b.width/2&&m.y===b.y+16&&['✓','?'].includes(m.text);});
 const painted=render(state).marks.filter(isBadge);assert.equal(painted.length,16);assert.equal(painted.filter(m=>m.text==='✓').length,3);assert.equal(painted.filter(m=>m.text==='?').length,13);
 for(let i=0;i<16;i++){const b=destinationBadgeBounds(DOORS[i],SITE_LABELS[Math.floor(i/2)][i%2]);assert(painted.some(m=>m.x===b.x+b.width/2&&m.y===b.y+16&&m.text===(i<3?'✓':'?')));}
 const publicView=view(0,'chapter','stack',true);assert.equal(render(publicView,true).marks.filter(isBadge).length,0);
});
