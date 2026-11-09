import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createProjection, reduceProjection } from "../public/projection.mjs";

test("operator stream refreshes counts, phase, owner and participant status without a polling delay", () => {
  const source = readFileSync(
    new URL("../public/app.js", import.meta.url),
    "utf8",
  );
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, { textContent: "", innerHTML: "" });
    return nodes.get(id);
  };
  const stats = [
    "Players",
    "Connected",
    "Reconnecting",
    "Tutorial complete",
    "Ready",
  ].map((name) => ({ dataset: { hostStat: name }, textContent: "" }));
  const snapshot = (version, phase = "chapter", owner = "primary") => ({
    projectionEpoch: "event-a",
    projectionVersion: version,
    serverTime: 1000,
    event: { phase, chapter: 1 },
    controlOwner: owner,
    connections: ["p1"],
    players: [
      {
        id: "p1",
        connectionStatus: "connected",
        ready: true,
        tutorial: [1, 2, 3, 4, 5],
      },
      {
        id: "p2",
        connectionStatus: "reconnecting",
        ready: false,
        tutorial: [],
      },
    ],
    audit: [],
  });
  const c = {
    hostProjection: reduceProjection(createProjection(), snapshot(1), {
      allowEpoch: true,
    }),
    hostGeneration: 1,
    hostStream: null,
    hostConnected: false,
    hostState: snapshot(1),
    reduceProjection,
    $: get,
    esc: String,
    document: { querySelectorAll: () => stats },
    updateHostPlayers: (players) => {
      c.renderedPlayers = players;
    },
  };
  c.EventSource = class {
    constructor(url) {
      this.url = url;
      this.listeners = {};
    }
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    }
  };
  vm.createContext(c);
  vm.runInContext(
    source.slice(
      source.indexOf("function startHostRefresh()"),
      source.indexOf("function setDestination("),
    ),
    c,
  );
  c.startHostRefresh();
  const stream = c.hostStream;
  assert.equal(stream.url, "/api/events?client=operator-view");
  stream.onopen();
  assert.equal(c.hostConnected, false);
  stream.listeners.state({ data: JSON.stringify(snapshot(2)) });
  assert.equal(c.hostConnected, true);
  assert.equal(
    stats.find((n) => n.dataset.hostStat === "Reconnecting").textContent,
    "1",
  );
  assert.equal(
    stats.find((n) => n.dataset.hostStat === "Ready").textContent,
    "1",
  );
  assert.equal(c.renderedPlayers[1].connectionStatus, "reconnecting");
  stream.listeners.state({
    data: JSON.stringify(snapshot(3, "brag", "backup")),
  });
  assert.equal(get("#host-phase").textContent, "brag");
  assert.match(get("#host-context").textContent, /backup/);
  stream.listeners.state({ data: JSON.stringify(snapshot(2)) });
  assert.equal(get("#host-phase").textContent, "brag");
  stream.onerror();
  assert.equal(c.hostConnected, false);
  assert.match(get("#host-connection").textContent, /RECONNECTING/);
  c.hostGeneration++;
  stream.listeners.state({ data: JSON.stringify(snapshot(99)) });
  assert.equal(get("#host-phase").textContent, "brag");
  assert.equal(c.hostConnected, false);
});
