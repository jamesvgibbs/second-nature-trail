import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
function fixture(rejectResume = false) {
  const gains = [],
    oscillators = [],
    intervals = [];
  let contexts = 0;
  class AudioContext {
    constructor() {
      contexts++;
      this.destination = {};
      this.currentTime = 10;
    }
    resume() {
      return rejectResume
        ? Promise.reject(new Error("Audio unavailable"))
        : Promise.resolve();
    }
    createGain() {
      const node = {
        gain: {
          value: 1,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
      };
      gains.push(node);
      return node;
    }
    createOscillator() {
      const node = {
        frequency: { value: 0 },
        connect() {},
        start() {
          this.started = true;
        },
        stop(at) {
          this.stopsAt = at;
        },
        disconnect() {
          this.disconnected = true;
        },
      };
      oscillators.push(node);
      return node;
    }
  }
  const c = vm.createContext({
    prefs: { music: 0, effects: 0 },
    window: { AudioContext },
    document: { hidden: false },
    setInterval: (fn) => {
      intervals.push(fn);
      return intervals.length;
    },
  });
  vm.runInContext(
    source.slice(
      source.indexOf("let audioContext ="),
      source.indexOf("function startHostRefresh("),
    ),
    c,
  );
  return { c, gains, oscillators, intervals, contexts: () => contexts };
}
test("actual audio controls stay silent by default and mix independent music/effects volumes without duplicate timers", async () => {
  const f = fixture();
  f.c.startAudio();
  assert.equal(f.contexts(), 0);
  f.c.prefs = { music: 25, effects: 60 };
  f.c.startAudio();
  f.c.startAudio();
  assert.equal(f.contexts(), 1);
  assert.equal(f.intervals.length, 1);
  assert.equal(f.gains[0].gain.value, 0.25 * 0.045);
  assert.equal(f.gains[1].gain.value, 0.6 * 0.04);
  f.intervals[0]();
  assert.equal(f.oscillators.length, 1);
  assert.equal(f.oscillators[0].type, "triangle");
  f.c.document.hidden = true;
  f.intervals[0]();
  assert.equal(f.oscillators.length, 1);
  f.c.soundEffect();
  assert.equal(f.oscillators.length, 2);
  assert.equal(f.oscillators[1].frequency.value, 660);
  f.oscillators[1].onended();
  assert.equal(f.oscillators[1].disconnected, true);
  f.c.prefs = { music: 0, effects: 0 };
  f.c.startAudio();
  f.c.soundEffect();
  assert.equal(f.oscillators.length, 2);
  assert.equal(f.gains[0].gain.value, 0);
  assert.equal(f.gains[1].gain.value, 0);
});
test("missing or asynchronously rejected audio permission cannot reject gameplay", async () => {
  const f = fixture(true);
  f.c.prefs = { music: 20, effects: 20 };
  f.c.startAudio();
  await Promise.resolve();
  const g = fixture();
  g.c.window = {};
  g.c.prefs = { music: 20, effects: 20 };
  assert.doesNotThrow(() => g.c.startAudio());
  assert.equal(g.contexts(), 0);
});
