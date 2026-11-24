import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import {
  destinationVisit,
  destinationBadgeBounds,
} from "../public/destination-visits.mjs";
import { DOORS } from "../public/world.mjs";
import {
  districtScenery,
  ROAD_BANDS,
  TREE_FOOTPRINT,
} from "../public/scenery.mjs";
import { SITE_LABELS } from "../public/trail-visuals.mjs";
import { chapterMapStatus } from "../public/helpers.mjs";
import { CHAPTERS } from "../content.mjs";
import { fixture } from "./client-simulation-fixture.mjs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const overlap = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

test("arrival status never infers a visit from completed work, current position, shared repair, or malformed legacy records", () => {
  const view = {
    event: { contributions: Array(8).fill(100) },
    me: {
      position: { x: 160, y: 160 },
      progress: [{ complete: true, step: 3 }],
      visitedDestinations: {},
    },
  };
  assert.equal(destinationVisit(view, DOORS[0]).reached, false);
  delete view.me.visitedDestinations;
  assert.equal(destinationVisit(view, DOORS[0]).label, "Unexplored");
  for (const record of [
    { x: 160, y: 160 },
    { x: 161, y: 160, at: 1 },
    { x: 160, y: 161, at: 1 },
    { x: 160, y: 160, at: "1" },
  ]) {
    view.me.visitedDestinations = { "160,160": record };
    assert.equal(destinationVisit(view, DOORS[0]).reached, false);
  }
  view.me.visitedDestinations = { "160,160": { x: 160, y: 160, at: 0 } };
  assert.equal(destinationVisit(view, DOORS[0]).label, "Reached");
  assert.equal(destinationVisit(view, DOORS[1]).label, "Unexplored");
});

test("all16 personal badge boxes clear signs, streets, front walks, trees, yard props and objective-marker areas", () => {
  for (let d = 0; d < 8; d++) {
    const scenery = districtScenery(DOORS[d * 2], DOORS[d * 2 + 1], d);
    for (let i = 0; i < 2; i++) {
      const door = DOORS[d * 2 + i],
        badge = destinationBadgeBounds(door, SITE_LABELS[d][i]);
      assert(badge.width >= 14 && badge.height >= 18);
      assert(
        badge.x >= 0 &&
          badge.x + badge.width <= 1200 &&
          badge.y >= 0 &&
          badge.y + badge.height <= 800,
      );
      const objects = [
        ...ROAD_BANDS,
        ...scenery.walks,
        ...scenery.signs,
        ...scenery.props,
        ...scenery.trees.map(([x, y]) => ({
          x: x + TREE_FOOTPRINT.x,
          y: y + TREE_FOOTPRINT.y,
          width: TREE_FOOTPRINT.width,
          height: TREE_FOOTPRINT.height,
        })),
        { x: door[0] - 22, y: door[1] - 65, width: 44, height: 29 },
      ];
      for (const object of objects)
        assert(
          !overlap(badge, object),
          `Site${d * 2 + i} badge intersects ${JSON.stringify(object)}`,
        );
      // Both standard and compact responsive maps preserve geometry without clipping.
      for (const scale of [1, 0.625]) {
        const b = {
          x: badge.x * scale,
          y: badge.y * scale,
          width: badge.width * scale,
          height: badge.height * scale,
        };
        for (const object of objects) {
          const o = Object.fromEntries(
            Object.entries(object)
              .filter(([k]) => ["x", "y", "width", "height"].includes(k))
              .map(([k, v]) => [k, v * scale]),
          );
          assert(!overlap(b, o));
        }
      }
    }
  }
});

test("actual accessible Map distinguishes reached sites from objective completion and reacts to authoritative arrivals without navigation creating records", () => {
  const f = fixture(0),
    c = f.context;
  Object.assign(c, {
    destinationVisit,
    DOORS,
    chapterMapStatus,
    districts: CHAPTERS.map((ch) => [
      ch.title,
      ...ch.locations.map((l) => l.name),
    ]),
  });
  vm.runInContext(
    source.slice(
      source.indexOf("function map()"),
      source.indexOf("function mystery()"),
    ),
    c,
  );
  const open = () => {
    c.map();
    return f.ids
      .get("#map-districts")
      .children.filter((row) =>
        row.dataset.focusKey?.startsWith("map:district:"),
      );
  };
  let rows = open();
  assert.equal(rows.length, 8);
  const places = (row) => row.children[0].textContent;
  assert.match(places(rows[0]), /Moving depot — Unexplored/i);
  assert.match(places(rows[0]), /Broken highway — Unexplored/i);
  const before = JSON.stringify(f.engine.get("neighbor"));
  rows[0].onclick();
  assert.equal(
    JSON.stringify(f.engine.get("neighbor")),
    before,
    "A chosen destination cannot author visit state",
  );
  assert.equal(f.travels.length, 1);
  f.engine.get("neighbor").visitedDestinations = {
    "160,160": { x: 160, y: 160, at: f.now() },
  };
  f.send();
  rows = open();
  assert.match(places(rows[0]), /Moving depot — Reached/i);
  assert.match(places(rows[0]), /Broken highway — Unexplored/i);
  assert.match(rows[0].children[1].textContent, /Unplayed/);
  rows[3].focus();
  const revision = f.modal.trailRevision,
    holder = f.ids.get("#map-districts");
  const focusedKey = rows[3].dataset.focusKey;
  f.engine.get("neighbor").visitedDestinations["300,160"] = {
    x: 300,
    y: 160,
    at: f.now() + 1,
  };
  f.send();
  rows = f.ids
    .get("#map-districts")
    .children.filter((row) =>
      row.dataset.focusKey?.startsWith("map:district:"),
    );
  assert.equal(f.document.activeElement.dataset.focusKey, focusedKey);
  assert.equal(f.modal.open, true);
  assert.equal(f.modal.trailRevision, revision);
  assert.equal(
    f.ids.get("#map-districts"),
    holder,
    "Arrival refresh updates rows without reopening the modal",
  );
  assert.match(places(rows[0]), /Broken highway — Reached/i);
  f.engine.get("neighbor").progress[0].complete = true;
  f.engine.get("neighbor").progress[0].step = 3;
  f.engine.get("neighbor").visitedDestinations = {};
  f.send();
  rows = open();
  assert.match(places(rows[0]), /Unexplored/);
  assert.match(rows[0].children[1].textContent, /Complete/);
});
