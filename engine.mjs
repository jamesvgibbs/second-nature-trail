import { createHash, randomUUID } from "node:crypto";
import {
  RULES,
  CHAPTERS,
  publicChapter,
  SPATIAL_CHAPTERS,
  ACTIVITY_STOPS,
} from "./content.mjs";
import { clipMove } from "./public/world.mjs";
export const CONTENT_HASH = createHash("sha256")
  .update(
    JSON.stringify({
      rules: RULES,
      chapters: CHAPTERS,
      stops: ACTIVITY_STOPS,
      spatialChapters: SPATIAL_CHAPTERS,
    }),
  )
  .digest("hex");
const copy = (x) => structuredClone(x),
  assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
const progress = () => ({
  step: 0,
  score: 0,
  mistakes: 0,
  complete: false,
  timeMs: null,
  challenge: false,
  quiz: [null, null],
  secret: false,
  assists: [],
  pendingAssist: null,
  lastTaskAt: null,
  budget: 0,
  primary: 0,
  inspected: false,
  targetRound: null,
  cycles: [],
  delivery: { stage: "load", loaded: null, route: null, visited: false },
  reserve: Object.fromEntries(
    ["parts", "filters", "food", "cable"].map((k) => [
      k,
      RULES.reservePerChapter,
    ]),
  ),
});
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const keys = Object.keys(RULES.values),
  count = (p) =>
    Object.fromEntries(
      keys.map((k) => [k, p.items.filter((i) => i.kind === k).length]),
    );
export class Engine {
  constructor({ state, now = Date.now } = {}) {
    this.now = now;
    if (state) {
      assert(
        state.version === RULES.version,
        "Saved rules version differs from engine; restore matching source version",
      );
      assert(
        state.contentHash === CONTENT_HASH,
        "Saved content hash differs; restore the frozen content and rules",
      );
    }
    this.connected = null;
    this.draws = new Map();
    this.state = state || {
      version: RULES.version,
      contentHash: CONTENT_HASH,
      name: "Second Nature Trail",
      phase: "draft",
      chapter: 0,
      deadline: null,
      chapterOpenedAt: null,
      ranked: Array(8).fill(true),
      players: {},
      trades: {},
      awards: [],
      contributions: Array(8).fill(0),
      audit: [],
      actions: [],
      requests: {},
      seed: randomUUID(),
      snapshot: null,
      finale: { contributors: [], target: 0, ending: null },
      broadcast: "",
      pause: null,
      controlOwner: null,
    };
    if (state) this.cancelTrades();
  }
  log(type, data = {}) {
    this.state.actions.push({ at: this.now(), type, ...data });
  }
  addPlayer(id, name) {
    assert(
      typeof id === "string" &&
        /^[\w-]{1,100}$/.test(id) &&
        !["__proto__", "constructor", "prototype"].includes(id),
      "Invalid identity",
    );
    if (own(this.state.players, id)) return this.view(id);
    assert(
      Object.keys(this.state.players).length < RULES.capacity,
      "Event is full",
    );
    assert(
      typeof name === "string" && name.trim().length > 0,
      "Display name required",
    );
    const p = {
      id,
      name: name.trim().slice(0, 60),
      setup: false,
      character: 0,
      palette: 0,
      insects: null,
      settings: {},
      ready: false,
      tutorial: [],
      practice: {
        moved: false,
        interacted: false,
        collected: false,
        answered: false,
      },
      position: { x: 600, y: 380 },
      lastMoveAt: this.now(),
      items: [],
      inventoryVersion: 0,
      progress: Array.from({ length: 8 }, progress),
      clues: [],
      mystery: false,
      help: null,
      emote: null,
      traderRecipients: [],
      suppliedConsumed: 0,
    };
    for (const kind of keys)
      for (let n = 0; n < RULES.allocation[kind]; n++)
        p.items.push({
          id: randomUUID(),
          kind,
          origin: id,
          supplier: null,
          traded: false,
        });
    this.state.players[id] = p;
    this.log("join", { playerId: id, allocation: copy(p.items) });
    return this.view(id);
  }
  get(id) {
    assert(own(this.state.players, id), "Unknown player");
    return this.state.players[id];
  }
  cached(who, a, fn) {
    assert(
      a &&
        typeof a.type === "string" &&
        typeof a.requestId === "string" &&
        /^[\w-]{1,100}$/.test(a.requestId),
      "Valid requestId required",
    );
    if (a.type === "move") return fn() || { ok: true };
    const key = who + ":" + a.requestId;
    const fingerprint = JSON.stringify(a);
    if (own(this.state.requests, key)) {
      const prior = this.state.requests[key];
      assert(
        prior.fingerprint === fingerprint,
        "Request ID reused with different action",
      );
      return copy(prior.result);
    }
    const result = fn() || { ok: true };
    this.state.requests[key] = { fingerprint, result: copy(result) };
    return result;
  }
  near(p, which = 0) {
    const target = CHAPTERS[this.state.chapter].locations[which];
    assert(
      Math.hypot(p.position.x - target.x, p.position.y - target.y) <= 110,
      `Move closer to ${target.name}`,
    );
  }
  playable(p) {
    assert(p.setup, "Finish character setup");
    assert(this.state.phase === "chapter", "Scoring is closed for this phase");
  }
  invalidate(p) {
    p.inventoryVersion++;
    for (const t of Object.values(this.state.trades))
      if (t.status === "pending" && (t.from === p.id || t.to === p.id))
        t.status = "cancelled";
  }
  consume(p, kind) {
    let i = p.items.findIndex((x) => x.kind === kind && x.supplier);
    if (i < 0) i = p.items.findIndex((x) => x.kind === kind);
    if (i < 0) {
      const r = p.progress[this.state.chapter];
      assert(r.reserve[kind] > 0, "Collect or trade for more supplies");
      r.reserve[kind]--;
      this.log("consume", {
        playerId: p.id,
        chapter: this.state.chapter,
        kind,
        source: "personal reserve",
      });
      return;
    }
    const item = p.items.splice(i, 1)[0];
    this.log("consume", {
      playerId: p.id,
      chapter: this.state.chapter,
      kind,
      itemId: item.id,
      source: "inventory",
    });
    this.invalidate(p);
    if (
      item.supplier &&
      item.supplier !== p.id &&
      own(this.state.players, item.supplier)
    ) {
      const supplier = this.get(item.supplier);
      if (!supplier.traderRecipients.includes(p.id))
        supplier.traderRecipients.push(p.id);
      supplier.suppliedConsumed++;
      this.log("qualifyingTrade", {
        supplier: supplier.id,
        recipient: p.id,
        itemId: item.id,
        chapter: this.state.chapter,
      });
    }
  }
  dispatch(id, a) {
    this.tick();
    const p = this.get(id);
    return this.cached(id, a, () => {
      const s = this.state,
        c = s.chapter,
        r = p.progress[c];
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
        ].includes(a.type)
      )
        assert(
          a.expectedChapter === c,
          "The chapter changed; review the current activity",
        );
      if (a.type === "task") {
        assert(
          a.expectedStep === r.step,
          "The task changed; review the current step",
        );
        assert(
          a.expectedStage === (this.chapterView(p).task?.stage || null),
          "The delivery stage changed; review the current action",
        );
      }
      switch (a.type) {
        case "setup": {
          assert(
            typeof a.insects === "boolean",
            "Choose whether to show spiders and insects",
          );
          assert(
            Number.isInteger(a.character) &&
              a.character >= 0 &&
              a.character < 12,
            "Choose a character",
          );
          assert(
            Number.isInteger(a.palette) && a.palette >= 0 && a.palette < 6,
            "Choose a palette",
          );
          p.insects = a.insects;
          p.character = a.character;
          p.palette = a.palette;
          p.setup = true;
          const v = a.settings || {};
          p.settings = {
            textSize: [1, 1.25, 1.5].includes(v.textSize) ? v.textSize : 1,
            reducedMotion: !!v.reducedMotion,
            music: Math.min(1, Math.max(0, Number(v.music) || 0)),
            effects: Math.min(1, Math.max(0, Number(v.effects) || 0)),
            control: v.control === "pointer" ? "pointer" : "keyboard",
            keys: {},
          };
          if (v.keys && typeof v.keys === "object") {
            const entries = Object.entries(v.keys);
            assert(
              entries.length <= 12 &&
                entries.every(
                  ([k, x]) => typeof x === "string" && x.length < 20,
                ),
              "Invalid key map",
            );
            assert(
              new Set(entries.map(([, x]) => x.toLowerCase())).size ===
                entries.length,
              "Duplicate key bindings",
            );
            p.settings.keys = Object.fromEntries(entries);
          }
          break;
        }
        case "tutorial": {
          assert(p.setup, "Finish setup");
          assert(RULES.tutorial.includes(a.step), "Unknown tutorial step");
          p.practice ||= {
            moved: false,
            interacted: false,
            collected: false,
            answered: false,
          };
          if (a.step === "move")
            assert(p.practice.moved, "Move at least twenty pixels first");
          if (a.step === "interact" || a.step === "collect") {
            assert(
              Math.hypot(p.position.x - 600, p.position.y - 380) <= 150,
              "Return to Bragging Square for practice",
            );
            if (a.step === "interact") p.practice.interacted = true;
            else {
              assert(
                p.practice.interacted,
                "Interact with the practice crate first",
              );
              p.practice.collected = true;
            }
          }
          if (a.step === "answer") {
            assert(p.practice.collected, "Collect the practice supply first");
            assert(a.choice === 0, "Choose repair parts for the broken sign");
            p.practice.answered = true;
          }
          if (a.step === "help")
            assert(p.help !== null, "Send a help request first");
          if (!p.tutorial.includes(a.step)) p.tutorial.push(a.step);
          break;
        }
        case "ready":
          assert(
            RULES.tutorial.every((x) => p.tutorial.includes(x)),
            "Complete every tutorial step",
          );
          p.ready = true;
          break;
        case "move": {
          assert(p.setup, "Finish setup");
          assert(
            ["lobby", "chapter", "finale"].includes(s.phase),
            "Movement is frozen",
          );
          assert(
            Number.isFinite(a.x) && Number.isFinite(a.y),
            "Invalid coordinates",
          );
          const x = Math.max(30, Math.min(1170, a.x)),
            y = Math.max(30, Math.min(770, a.y));
          const dx = x - p.position.x,
            dy = y - p.position.y,
            d = Math.hypot(dx, dy),
            limit =
              Math.min(1, (this.now() - p.lastMoveAt) / 1000) * RULES.moveSpeed;
          const ratio = d ? Math.min(1, limit / d) : 0;
          p.position = clipMove(p.position, {
            x: p.position.x + dx * ratio,
            y: p.position.y + dy * ratio,
          });
          p.lastMoveAt = this.now();
          if (Math.hypot(p.position.x - 600, p.position.y - 380) >= 20) {
            p.practice ||= {};
            p.practice.moved = true;
          }
          break;
        }
        case "task": {
          this.playable(p);
          if (c === 0) return this.delivery(p, a);
          if (c === 4) return this.targeting(p, a);
          if (c === 5) return this.budget(p, a);
          if (c === 7) return this.routing(p, a);
          if (SPATIAL_CHAPTERS.includes(c)) return this.spatial(p, a);
          this.near(p);
          assert(!r.complete, "Main objective already complete");
          assert(
            r.lastTaskAt === null ||
              this.now() - r.lastTaskAt >= RULES.taskCooldownMs,
            "Take a moment before the next action",
          );
          const t = CHAPTERS[c].tasks[r.step];
          this.choice(a.choice, t);
          r.lastTaskAt = this.now();
          if (a.choice !== t.answer) {
            r.mistakes++;
            r.primary -= 1;
            r.score = Math.max(0, r.score - RULES.mistakePenalty);
            this.log("taskMistake", { playerId: id, chapter: c, step: r.step });
            return {
              ok: true,
              correct: false,
              message: "That route did not work. Read the clues and try again.",
            };
          }
          this.consume(p, t.item);
          r.step++;
          r.primary += c === 3 ? 20 : 1;
          r.score += RULES.taskPoints;
          if (c === 5) r.budget += [40, 40, 30][r.step - 1];
          if (r.step === 3) {
            r.complete = true;
            r.timeMs = this.now() - s.chapterOpenedAt;
            s.contributions[c]++;
            if (r.pendingAssist) {
              const helper = this.get(r.pendingAssist);
              const hr = helper.progress[c];
              if (!hr.assists.includes(id) && !r.assists.includes(helper.id)) {
                if (hr.assists.length === 0) hr.score += RULES.assistPoints;
                hr.assists.push(id);
                this.log("assistCompleted", {
                  playerId: helper.id,
                  target: id,
                  chapter: c,
                });
              }
              r.pendingAssist = null;
              p.help = null;
            }
          }
          this.log("task", {
            playerId: id,
            chapter: c,
            step: r.step,
            score: r.score,
          });
          return { ok: true, correct: true, complete: r.complete };
        }
        case "challenge": {
          this.playable(p);
          this.near(p, 1);
          assert(r.complete, "Complete the main objective first");
          assert(!r.challenge, "Challenge already complete");
          const t = CHAPTERS[c].challenge;
          this.choice(a.choice, t);
          if (a.choice === t.answer) {
            r.challenge = true;
            r.score += RULES.challengePoints;
          } else {
            r.mistakes++;
            r.score = Math.max(0, r.score - RULES.mistakePenalty);
          }
          this.log("challenge", {
            playerId: id,
            chapter: c,
            correct: a.choice === t.answer,
          });
          return { ok: true, correct: a.choice === t.answer };
        }
        case "quiz": {
          this.playable(p);
          assert(a.index === 0 || a.index === 1, "Unknown question");
          const q = CHAPTERS[c].questions[a.index];
          this.choice(a.choice, q);
          const correct = a.choice === q.answer,
            first = r.quiz[a.index] === null;
          if (first) {
            r.quiz[a.index] = {
              choice: a.choice,
              correct,
              explanation: q.explanation,
            };
            if (correct) r.score += RULES.quizPoints;
            this.log("quiz", {
              playerId: id,
              chapter: c,
              index: a.index,
              correct,
            });
          }
          return { ok: true, correct, first, explanation: q.explanation };
        }
        case "secret":
          this.playable(p);
          this.near(p, 1);
          if (!r.secret) {
            r.secret = true;
            p.clues.push({ chapter: c, letter: CHAPTERS[c].clue });
            this.log("secret", { playerId: id, chapter: c });
          }
          return { ok: true, clue: CHAPTERS[c].clue };
        case "mystery":
          this.playable(p);
          assert(typeof a.answer === "string", "Enter the mystery word");
          assert(p.clues.length === 8, "Find all eight clues first");
          if (a.answer.trim().toUpperCase() === "NEIGHBOR") {
            p.mystery = true;
            return {
              ok: true,
              correct: true,
              message: "The AI forgot its most important variable: a neighbor.",
            };
          }
          return { ok: true, correct: false };
        case "help":
          assert(p.setup, "Finish setup");
          assert(
            Number.isInteger(a.preset) && a.preset >= 0 && a.preset < 3,
            "Unknown help request",
          );
          p.help = a.preset;
          break;
        case "assist": {
          this.playable(p);
          const target = this.get(a.target);
          assert(target.id !== id, "You cannot assist yourself");
          const tr = target.progress[c];
          assert(
            target.help !== null && !tr.complete,
            "The neighbor needs an unfinished task and a help request",
          );
          assert(
            !r.assists.includes(target.id) && !tr.assists.includes(id),
            "This pair already scored an assist this chapter",
          );
          assert(
            tr.pendingAssist === null || tr.pendingAssist === id,
            "Another neighbor is assisting",
          );
          assert(
            Math.hypot(
              target.position.x - p.position.x,
              target.position.y - p.position.y,
            ) < 180,
            "Move closer to your neighbor",
          );
          tr.pendingAssist = id;
          this.log("assistStarted", {
            playerId: id,
            target: target.id,
            chapter: c,
          });
          break;
        }
        case "tradeOffer": {
          this.playable(p);
          const other = this.get(a.target);
          assert(other.id !== id && other.setup, "Choose another player");
          this.validateItem(a.give);
          this.validateItem(a.receive);
          assert(a.give.item !== a.receive.item, "Trade different supplies");
          const t = {
            id: randomUUID(),
            from: id,
            to: other.id,
            give: copy(a.give),
            receive: copy(a.receive),
            confirmed: [],
            versions: [p.inventoryVersion, other.inventoryVersion],
            status: "pending",
          };
          this.tradeAvailable(t);
          s.trades[t.id] = t;
          return { ok: true, tradeId: t.id };
        }
        case "tradeConfirm": {
          this.playable(p);
          const t = s.trades[a.tradeId];
          assert(t && t.status === "pending", "Trade is no longer pending");
          assert(t.from === id || t.to === id, "Not your trade");
          const from = this.get(t.from),
            to = this.get(t.to);
          assert(
            from.inventoryVersion === t.versions[0] &&
              to.inventoryVersion === t.versions[1],
            "Inventory changed; make a new offer",
          );
          this.tradeAvailable(t);
          if (!t.confirmed.includes(id)) t.confirmed.push(id);
          if (t.confirmed.length === 2) {
            const take = (owner, offer) => {
              const chosen = owner.items
                .filter((i) => i.kind === offer.item)
                .slice(0, offer.qty);
              owner.items = owner.items.filter((i) => !chosen.includes(i));
              return chosen;
            };
            const give = take(from, t.give),
              receive = take(to, t.receive);
            for (const item of give) {
              item.supplier = item.traded ? null : from.id;
              item.traded = true;
            }
            for (const item of receive) {
              item.supplier = item.traded ? null : to.id;
              item.traded = true;
            }
            from.items.push(...receive);
            to.items.push(...give);
            t.status = "complete";
            this.invalidate(from);
            this.invalidate(to);
            this.log("tradeCompleted", {
              tradeId: t.id,
              from: from.id,
              to: to.id,
              give: give.map((x) => x.id),
              receive: receive.map((x) => x.id),
              chapter: c,
            });
          }
          return { ok: true, status: t.status };
        }
        case "tradeCancel": {
          const t = s.trades[a.tradeId];
          assert(t && (t.from === id || t.to === id), "Not your trade");
          assert(t.status === "pending", "Trade is no longer pending");
          t.status = "cancelled";
          break;
        }
        case "emote":
          assert(
            Number.isInteger(a.emote) && a.emote >= 0 && a.emote < 6,
            "Unknown emote",
          );
          p.emote = { index: a.emote, until: this.now() + 5000 };
          break;
        case "finale":
          assert(s.phase === "finale", "Finale is not active");
          assert(p.setup, "Finish setup");
          if (!s.finale.contributors.includes(id))
            s.finale.contributors.push(id);
          if (s.finale.contributors.length >= s.finale.target)
            s.finale.ending =
              "The neighborhood is back online. The AI has accepted a new job: labeling extension cords.";
          break;
        default:
          throw new Error("Unknown action");
      }
      return { ok: true };
    });
  }
  chapterView(p) {
    const c = publicChapter(this.state.chapter, p.progress[this.state.chapter]);
    const r = p.progress[this.state.chapter];
    if (SPATIAL_CHAPTERS.includes(this.state.chapter) && !r.complete) {
      const t = CHAPTERS[this.state.chapter].tasks[r.step],
        offset = { 1: 1, 2: 2, 3: 0, 6: 4 }[this.state.chapter],
        target = ACTIVITY_STOPS[(r.step + offset) % ACTIVITY_STOPS.length];
      c.task = {
        ...c.task,
        target,
        stage: r.inspected ? "decide" : "inspect",
        totalSteps: CHAPTERS[this.state.chapter].tasks.length,
        evidence: r.inspected ? t.evidence : null,
        prompt: r.inspected
          ? t.prompt
          : `Inspect the work order and evidence at ${target.name} before acting.`,
        options: r.inspected ? t.options : ["Inspect this site"],
        step: r.step,
      };
      return c;
    }
    if (this.state.chapter === 4 && !r.complete) {
      const round = Math.max(
          0,
          Math.floor(
            ((this.state.phase === "paused"
              ? this.state.pause.at
              : this.now()) -
              this.state.chapterOpenedAt) /
              RULES.targetRoundMs,
          ),
        ),
        marked = [1, 0, 2][round % 3];
      c.task = {
        kind: "targeting",
        prompt:
          "Select the marked outbreak. One deliberate action per round; three resolutions restore this block.",
        options: ["Target A", "Target B", "Target C"],
        targets: [0, 1, 2].map((id) => ({
          id,
          label: ["Target A", "Target B", "Target C"][id],
          marked: id === marked,
        })),
        round,
        nextRoundAt:
          this.state.chapterOpenedAt + (round + 1) * RULES.targetRoundMs,
        actedThisRound: r.targetRound === round,
        step: r.step,
      };
      return c;
    }
    if (this.state.chapter === 7 && !r.complete) {
      c.task = {
        kind: "routing",
        prompt:
          "Build a working route from the exchange to the highlighted home. Avoid the broken connection.",
        source: "exchange",
        destination: ["home-a", "home-b", "home-c"][r.step],
        nodes: [
          { id: "exchange", label: "Exchange", x: 0, y: 1 },
          { id: "relay-n", label: "North relay", x: 1, y: 0 },
          { id: "relay-s", label: "South relay", x: 1, y: 2 },
          { id: "hub", label: "Neighborhood hub", x: 2, y: 1 },
          { id: "home-a", label: "Home A", x: 3, y: 0 },
          { id: "home-b", label: "Home B", x: 3, y: 1 },
          { id: "home-c", label: "Home C", x: 3, y: 2 },
        ],
        edges: [
          ["exchange", "relay-n"],
          ["exchange", "relay-s"],
          ["relay-n", "hub"],
          ["relay-s", "hub"],
          ["relay-n", "home-a"],
          ["hub", "home-a"],
          ["hub", "home-b"],
          ["hub", "home-c"],
        ],
        blockedEdges: [
          [["relay-n", "home-a"]],
          [["relay-n", "hub"]],
          [["relay-s", "hub"]],
        ][r.step],
        step: r.step,
      };
      return c;
    }
    if (this.state.chapter === 5 && !r.complete) {
      const income = RULES.budgetIncomes[r.step],
        due = RULES.budgetDues[r.step],
        budget = income + r.budget;
      c.task = {
        kind: "budget",
        prompt:
          "Allocate this cycle’s fictional budget. Pay on time, then decide what to retain.",
        income,
        budget,
        due,
        opensAt: this.state.chapterOpenedAt + r.step * RULES.budgetCycleMs,
        dueAt: this.state.chapterOpenedAt + (r.step + 1) * RULES.budgetCycleMs,
        retained: r.budget,
        options: [
          `Pay ${due}; save ${budget - due}`,
          `Pay ${due}; buy an optional decoration for 20`,
          `Spend ${budget - 20} first; pay the remaining 20`,
        ],
        step: r.step,
      };
      return c;
    }
    if (this.state.chapter !== 0 || p.progress[0].complete) return c;
    const d = p.progress[0].delivery;
    const target =
      d.stage === "deliver"
        ? c.locations[1]
        : d.stage === "travel"
          ? {
              name: d.route === "scenic" ? "Paved detour" : "Rubble shortcut",
              x: 230,
              y: d.route === "scenic" ? 60 : 160,
            }
          : c.locations[0];
    const prompts = {
      load: {
        prompt:
          "Pack a four-slot delivery cart. Choose a load that fits your supplies. Storage remains limited to twelve tradable items.",
        options: [
          "Repair kit: 2 parts · 4 slots · value 10",
          "Essentials: 1 part + 2 food · 4 slots · value 11",
          "Connection kit: 2 cables · 4 slots · value 12",
        ],
      },
      route: {
        prompt:
          "Choose your route. Travel to its checkpoint before delivering.",
        options: [
          "Paved detour · protects cargo",
          "Rubble shortcut · loses 2 cargo value",
        ],
      },
      travel: {
        prompt: "Move to the route checkpoint, then inspect the crossing.",
        options: ["Inspect crossing"],
      },
      deliver: {
        prompt: "Deliver your loaded cargo at the broken highway.",
        options: ["Deliver cargo"],
      },
    };
    c.task = {
      ...prompts[d.stage],
      kind: "delivery",
      step: p.progress[0].step,
      target,
      stage: d.stage,
    };
    return c;
  }
  taskCount(c) {
    return CHAPTERS[c].tasks.length;
  }
  spatial(p, a) {
    const c = this.state.chapter,
      r = p.progress[c];
    assert(!r.complete, "Main objective already complete");
    const task = this.chapterView(p).task;
    assert(
      Math.hypot(p.position.x - task.target.x, p.position.y - task.target.y) <=
        65,
      `Move closer to ${task.target.name}`,
    );
    this.choice(a.choice, task);
    if (!r.inspected) {
      r.inspected = true;
      this.log("inspection", {
        playerId: p.id,
        chapter: c,
        step: r.step,
        site: task.target.name,
      });
      return { ok: true, inspected: true };
    }
    const authored = CHAPTERS[c].tasks[r.step],
      correct = a.choice === authored.answer;
    if (correct) {
      this.consume(p, authored.item);
      r.primary += c === 3 ? RULES.spatialTaskPoints : 1;
      r.inspected = false;
      this.finishTask(p, RULES.spatialTaskPoints);
    } else {
      r.mistakes++;
      r.primary -= 1;
      r.score = Math.max(0, r.score - RULES.mistakePenalty);
    }
    this.log("spatialTask", {
      playerId: p.id,
      chapter: c,
      step: r.step,
      correct,
      score: r.score,
    });
    return { ok: true, correct, complete: r.complete };
  }
  finishTask(p, points) {
    const c = this.state.chapter,
      r = p.progress[c];
    r.step++;
    r.score += points;
    if (r.step === this.taskCount(c)) {
      r.complete = true;
      r.timeMs = this.now() - this.state.chapterOpenedAt;
      this.state.contributions[c]++;
      if (r.pendingAssist) {
        const h = this.get(r.pendingAssist),
          hr = h.progress[c];
        if (!hr.assists.includes(p.id) && !r.assists.includes(h.id)) {
          if (hr.assists.length === 0) hr.score += RULES.assistPoints;
          hr.assists.push(p.id);
          this.log("assistCompleted", {
            playerId: h.id,
            target: p.id,
            chapter: c,
          });
        }
        r.pendingAssist = null;
        p.help = null;
      }
    }
  }
  targeting(p, a) {
    this.near(p);
    const r = p.progress[4];
    assert(!r.complete, "Main objective already complete");
    const t = this.chapterView(p).task;
    this.choice(a.choice, t);
    assert(
      a.expectedRound === t.round,
      "The target round changed; select a current target",
    );
    assert(
      r.targetRound !== t.round,
      "This round is resolved; wait for the next outbreak",
    );
    r.targetRound = t.round;
    const correct = t.targets[a.choice].marked;
    if (correct) {
      this.consume(p, "parts");
      r.primary++;
      this.finishTask(p, RULES.taskPoints);
    } else {
      r.mistakes++;
      r.primary -= 1;
      r.score = Math.max(0, r.score - RULES.mistakePenalty);
    }
    this.log("target", {
      playerId: p.id,
      chapter: 4,
      round: t.round,
      target: a.choice,
      correct,
    });
    return {
      ok: true,
      correct,
      complete: r.complete,
      nextRoundAt: t.nextRoundAt,
    };
  }
  routing(p, a) {
    this.near(p);
    const r = p.progress[7];
    assert(!r.complete, "Main objective already complete");
    const t = this.chapterView(p).task;
    assert(
      Array.isArray(a.path) &&
        a.path.length >= 2 &&
        a.path.length <= 7 &&
        a.path.every((x) => typeof x === "string"),
      "Choose a route with two to seven nodes",
    );
    assert(new Set(a.path).size === a.path.length, "A route cannot loop");
    const match = (edge, a, b) =>
      (edge[0] === a && edge[1] === b) || (edge[1] === a && edge[0] === b);
    const correct =
      a.path[0] === t.source &&
      a.path.at(-1) === t.destination &&
      a.path
        .slice(1)
        .every(
          (v, i) =>
            t.edges.some((e) => match(e, a.path[i], v)) &&
            !t.blockedEdges.some((e) => match(e, a.path[i], v)),
        );
    if (correct) {
      this.consume(p, "cable");
      r.primary++;
      this.finishTask(p, RULES.taskPoints);
    } else {
      r.mistakes++;
      r.primary -= 1;
      r.score = Math.max(0, r.score - RULES.mistakePenalty);
    }
    this.log("route", { playerId: p.id, chapter: 7, path: a.path, correct });
    return { ok: true, correct, complete: r.complete };
  }
  budget(p, a) {
    this.near(p);
    const r = p.progress[5];
    assert(!r.complete, "Main objective already complete");
    const t = this.chapterView(p).task;
    this.choice(a.choice, t);
    assert(
      this.now() >= t.opensAt,
      "The next payment cycle has not opened yet",
    );
    const payment = a.choice === 2 ? 20 : t.due,
      expense = a.choice === 1 ? 20 : a.choice === 2 ? t.budget - 20 : 0,
      retained = t.budget - payment - expense;
    assert(retained >= 0, "This plan exceeds the budget");
    const onTime = payment >= t.due && this.now() < t.dueAt;
    r.budget = retained;
    r.cycles.push({
      income: t.income,
      opening: t.budget,
      payment,
      expense,
      retained,
      onTime,
      paidAt: this.now(),
      dueAt: t.dueAt,
    });
    this.consume(p, "food");
    if (onTime) r.primary++;
    else r.mistakes++;
    this.finishTask(p, onTime ? RULES.taskPoints : 0);
    this.log("payment", {
      playerId: p.id,
      chapter: 5,
      cycle: r.step,
      payment,
      expense,
      retained,
      onTime,
    });
    return {
      ok: true,
      correct: onTime,
      complete: r.complete,
      budget: retained,
    };
  }
  delivery(p, a) {
    const c = 0,
      r = p.progress[0],
      d = r.delivery;
    assert(!r.complete, "Main objective already complete");
    const task = this.chapterView(p).task;
    this.choice(a.choice, task);
    assert(
      Math.hypot(p.position.x - task.target.x, p.position.y - task.target.y) <
        65,
      `Move closer to ${task.target.name}`,
    );
    if (d.stage === "load") {
      const plan = RULES.cargoPlans[a.choice];
      assert(
        Object.entries(plan).reduce(
          (n, [kind, qty]) => n + RULES.cargoWeights[kind] * qty,
          0,
        ) <= RULES.cargoSlots,
        "Cargo exceeds four slots",
      );
      for (const [kind, qty] of Object.entries(plan))
        assert(
          count(p)[kind] + r.reserve[kind] >= qty,
          "Not enough supplies for this load; trade or choose another",
        );
      d.loaded = copy(plan);
      d.stage = "route";
    } else if (d.stage === "route") {
      d.route = a.choice === 0 ? "scenic" : "shortcut";
      d.stage = "travel";
    } else if (d.stage === "travel") {
      d.visited = true;
      d.stage = "deliver";
    } else {
      assert(d.visited, "Visit the route checkpoint first");
      let value = 0;
      for (const [kind, qty] of Object.entries(d.loaded)) {
        for (let i = 0; i < qty; i++) this.consume(p, kind);
        value +=
          qty *
          Math.max(
            0,
            RULES.values[kind] -
              (d.route === "shortcut" ? RULES.deliveryDamage : 0),
          );
      }
      r.primary += value;
      r.score += Math.round((value / 12) * RULES.taskPoints);
      r.step++;
      this.log("delivery", {
        playerId: p.id,
        chapter: 0,
        item: d.loaded,
        route: d.route,
        value,
        step: r.step,
      });
      r.delivery = { stage: "load", loaded: null, route: null, visited: false };
      if (r.step === this.taskCount(c)) {
        r.complete = true;
        r.timeMs = this.now() - this.state.chapterOpenedAt;
        this.state.contributions[0]++;
        if (r.pendingAssist) {
          const h = this.get(r.pendingAssist),
            hr = h.progress[0];
          if (!hr.assists.includes(p.id) && !r.assists.includes(h.id)) {
            if (hr.assists.length === 0) hr.score += RULES.assistPoints;
            hr.assists.push(p.id);
            this.log("assistCompleted", {
              playerId: h.id,
              target: p.id,
              chapter: 0,
            });
          }
          r.pendingAssist = null;
          p.help = null;
        }
      }
    }
    return { ok: true, correct: true, complete: r.complete };
  }
  choice(v, t) {
    assert(
      Number.isInteger(v) && v >= 0 && v < t.options.length,
      "Invalid choice",
    );
  }
  validateItem(v) {
    assert(
      v &&
        keys.includes(v.item) &&
        Number.isInteger(v.qty) &&
        v.qty >= 1 &&
        v.qty <= 3,
      "Invalid trade quantity",
    );
  }
  tradeAvailable(t) {
    const a = this.get(t.from),
      b = this.get(t.to);
    assert(
      count(a)[t.give.item] >= t.give.qty &&
        count(b)[t.receive.item] >= t.receive.qty,
      "Not enough supplies",
    );
    assert(
      a.items.length - t.give.qty + t.receive.qty <= RULES.storageLimit &&
        b.items.length - t.receive.qty + t.give.qty <= RULES.storageLimit,
      "Cart capacity exceeded",
    );
  }
  setConnected(ids) {
    this.connected = new Set(ids);
  }
  disconnect(id) {
    for (const t of Object.values(this.state.trades))
      if (t.status === "pending" && (t.from === id || t.to === id))
        t.status = "cancelled";
  }
  cancelTrades() {
    for (const t of Object.values(this.state.trades))
      if (t.status === "pending") t.status = "cancelled";
  }
  host(operatorId, a) {
    this.tick();
    return this.cached("host:" + operatorId, a, () => {
      const s = this.state,
        hadSnapshot = !!s.snapshot;
      assert(
        typeof a.reason === "string" && a.reason.trim().length > 0,
        "Operator reason required",
      );
      switch (a.type) {
        case "lobby":
          assert(s.phase === "draft", "Lobby already opened");
          s.phase = "lobby";
          break;
        case "start":
          if (s.phase === "countdown") break;
          assert(s.phase === "lobby", "Event already started");
          s.phase = "countdown";
          s.chapter = 0;
          s.chapterOpenedAt = this.now();
          s.deadline = this.now() + RULES.countdownMs;
          break;
        case "cancelStart":
          assert(s.phase === "countdown", "Countdown is not active");
          s.phase = "lobby";
          s.deadline = null;
          s.chapterOpenedAt = null;
          break;
        case "pause":
          assert(
            ["countdown", "chapter", "brag", "finale"].includes(s.phase),
            "Cannot pause this phase",
          );
          s.pause = {
            phase: s.phase,
            remainingMs: Math.max(0, s.deadline - this.now()),
            at: this.now(),
          };
          s.phase = "paused";
          s.deadline = null;
          break;
        case "resume":
          assert(s.phase === "paused", "Event is not paused");
          s.phase = s.pause.phase;
          s.deadline = this.now() + s.pause.remainingMs;
          if (["countdown", "chapter"].includes(s.phase))
            s.chapterOpenedAt += this.now() - s.pause.at;
          s.pause = null;
          break;
        case "skip": {
          const phase = s.phase === "paused" ? s.pause.phase : s.phase;
          assert(
            ["countdown", "chapter", "brag"].includes(phase),
            "No chapter to skip",
          );
          s.ranked[s.chapter] = false;
          s.awards = s.awards.filter((x) => x.chapter !== s.chapter);
          s.pause = null;
          s.phase = "brag";
          s.deadline = this.now() + RULES.breakMs;
          this.cancelTrades();
          break;
        }
        case "rescue": {
          const p = this.get(a.playerId);
          p.position = { x: 600, y: 380 };
          p.lastMoveAt = this.now();
          break;
        }
        case "broadcast":
          assert(
            typeof a.message === "string" && a.message.length <= 280,
            "Message must be at most 280 characters",
          );
          s.broadcast = a.message;
          break;
        case "endScoring":
          assert(
            ["chapter", "brag", "paused"].includes(s.phase),
            "Scoring has not started or is already frozen",
          );
          this.freeze();
          s.phase = "finale";
          s.pause = null;
          s.deadline = this.now() + RULES.finaleMs;
          break;
        case "close":
          assert(
            ["awards", "finale"].includes(s.phase),
            "Finish scoring before closing",
          );
          s.phase = "closed";
          s.deadline = null;
          break;
        default:
          throw new Error("Unknown host action");
      }
      s.controlOwner = operatorId;
      s.audit.push({
        at: this.now(),
        operatorId,
        type: a.type,
        reason: a.reason,
        ...(a.type === "broadcast" ? { message: a.message } : {}),
      });
      if (!hadSnapshot && s.snapshot) s.snapshot.audit = copy(s.audit);
      return { ok: true };
    });
  }
  tick() {
    const s = this.state;
    while (s.deadline !== null && this.now() >= s.deadline) {
      const boundary = s.deadline;
      if (s.phase === "countdown") {
        s.phase = "chapter";
        s.deadline = s.chapterOpenedAt + RULES.chapterMs;
      } else if (s.phase === "chapter") {
        this.chapterAward(s.chapter);
        this.cancelTrades();
        s.phase = "brag";
        s.deadline = boundary + RULES.breakMs;
      } else if (s.phase === "brag") {
        if (s.chapter < 7) {
          s.chapter++;
          s.chapterOpenedAt = boundary;
          s.phase = "chapter";
          s.deadline = boundary + RULES.chapterMs;
        } else {
          this.freeze();
          s.phase = "finale";
          s.deadline = boundary + RULES.finaleMs;
        }
      } else if (s.phase === "finale") {
        if (!s.finale.ending)
          s.finale.ending =
            "The neighborhood is mostly online. The AI is still trying to reboot a toaster. Everyone gets home safely.";
        s.phase = "awards";
        s.deadline = boundary + RULES.awardsMs;
      } else if (s.phase === "awards") {
        s.phase = "closed";
        s.deadline = null;
      } else break;
      this.log("phase", { phase: s.phase, chapter: s.chapter, boundary });
    }
  }
  draw(id, category) {
    const key = this.state.seed + ":" + category + ":" + id;
    if (!this.draws.has(key))
      this.draws.set(key, createHash("sha256").update(key).digest("hex"));
    return this.draws.get(key);
  }
  metrics(p) {
    const ranked = this.state.ranked;
    const rs = p.progress.filter((_, i) => ranked[i]);
    const completed = rs.filter((r) => r.complete).length;
    return {
      inventoryValue: p.items.reduce((a, i) => a + RULES.values[i.kind], 0),
      completed,
      total: rs.reduce((a, r) => a + r.score, 0),
      timeMs: rs.reduce((a, r) => a + (r.timeMs || 0), 0),
      assists: rs.reduce((a, r) => a + r.assists.length, 0),
      assistRecipients: new Set(rs.flatMap((r) => r.assists)).size,
      correct: rs.reduce(
        (a, r) => a + r.quiz.filter((q) => q?.correct).length,
        0,
      ),
      secrets:
        rs.filter((r) => r.secret).length +
        (p.mystery && ranked.every(Boolean) ? 1 : 0),
      traders: new Set(
        this.state.actions
          .filter(
            (a) =>
              a.type === "qualifyingTrade" &&
              a.supplier === p.id &&
              ranked[a.chapter],
          )
          .map((a) => a.recipient),
      ).size,
      suppliedConsumed: this.state.actions.filter(
        (a) =>
          a.type === "qualifyingTrade" &&
          a.supplier === p.id &&
          ranked[a.chapter],
      ).length,
      mean: rs.length
        ? rs.reduce(
            (a, r) =>
              a +
              Math.min(
                100,
                (r.score /
                  RULES.chapterMaxima[
                    this.state.ranked
                      .map((v, i) => (v ? i : -1))
                      .filter((i) => i >= 0)[rs.indexOf(r)]
                  ]) *
                  100,
              ),
            0,
          ) / rs.length
        : 0,
    };
  }
  select(category, rows, primary, secondary, eligible) {
    const used = new Set(
      this.state.awards.filter((a) => a.playerId).map((a) => a.playerId),
    );
    const candidates = rows.filter((p) => !used.has(p.id) && eligible(p));
    candidates.sort(
      (a, b) =>
        primary(b) - primary(a) ||
        secondary(b) - secondary(a) ||
        this.draw(a.id, category).localeCompare(this.draw(b.id, category)),
    );
    const p = candidates[0];
    const award = {
      category,
      playerId: p?.id || null,
      name: p?.name || null,
      metric: p ? primary(p) : null,
      secondary: p ? secondary(p) : null,
      reason: p ? "Qualified" : "No qualifying recipient",
      draw: p ? this.draw(p.id, category) : null,
    };
    this.state.awards.push(award);
    return award;
  }
  chapterAward(c) {
    if (!this.state.ranked[c] || this.state.awards.some((a) => a.chapter === c))
      return;
    const a = this.select(
      CHAPTERS[c].title,
      Object.values(this.state.players),
      (p) => p.progress[c].primary,
      (p) => (c === 5 ? p.progress[c].budget : -p.progress[c].mistakes),
      (p) => p.progress[c].complete,
    );
    a.chapter = c;
  }
  freeze() {
    const s = this.state;
    if (s.snapshot) return;
    this.cancelTrades();
    if (s.phase === "chapter" || s.phase === "paused")
      this.chapterAward(s.chapter);
    const rows = Object.values(s.players).map((p) => ({
      ...copy(p),
      metrics: this.metrics(p),
    }));
    const n = s.ranked.filter(Boolean).length;
    const definitions = [
      [
        "Top hoarder",
        "inventoryValue",
        "completed",
        (p) => p.metrics.completed > 0,
      ],
      [
        "Trailblazer",
        "timeMs",
        "total",
        (p) => n > 0 && p.metrics.completed === n,
      ],
      [
        "Neighborhood hero",
        "assists",
        "assistRecipients",
        (p) => p.metrics.assists > 0,
      ],
      [
        "Human intelligence champion",
        "correct",
        "completed",
        (p) => p.metrics.correct > 0,
      ],
      [
        "Easter egg hunter",
        "secrets",
        "completed",
        (p) => p.metrics.secrets > 0,
      ],
      [
        "Master trader",
        "traders",
        "suppliedConsumed",
        (p) => p.metrics.traders > 0,
      ],
      [
        "All-round survivor",
        "mean",
        "completed",
        (p) => p.metrics.completed > 0,
      ],
    ];
    for (const [name, metric, secondary, eligible] of definitions)
      this.select(
        name,
        rows,
        (p) => p.metrics[metric] * (metric === "timeMs" ? -1 : 1),
        (p) => p.metrics[secondary],
        eligible,
      );
    s.snapshot = {
      at: this.now(),
      version: s.version,
      contentHash: s.contentHash,
      seed: s.seed,
      ranked: copy(s.ranked),
      players: rows,
      awards: copy(s.awards),
      actions: copy(s.actions),
      audit: copy(s.audit),
      rules: copy(RULES),
    };
    s.finale.target = Math.max(
      1,
      Math.ceil(
        rows.filter(
          (p) =>
            p.setup && (this.connected === null || this.connected.has(p.id)),
        ).length * 0.6,
      ),
    );
  }
  event() {
    const s = this.state;
    return {
      name: s.name,
      phase: s.phase,
      chapter: s.chapter,
      deadline: s.deadline,
      remainingMs:
        s.phase === "paused"
          ? s.pause.remainingMs
          : s.deadline === null
            ? null
            : Math.max(0, s.deadline - this.now()),
      paused: s.phase === "paused",
      ranked: s.ranked,
      contributions: s.contributions,
      awards: s.awards,
      broadcast: s.broadcast,
      finale: s.finale,
    };
  }
  actionView(id) {
    const p = this.get(id),
      { items, inventoryVersion, lastMoveAt, ...me } = p;
    return copy({
      serverTime: this.now(),
      event: this.event(),
      me: {
        ...me,
        inventory: count(p),
        reserve: p.progress[this.state.chapter].reserve,
      },
      chapter: this.chapterView(p),
      trades: Object.values(this.state.trades).filter(
        (t) => (t.from === id || t.to === id) && t.status === "pending",
      ),
    });
  }
  view(id) {
    const p = this.get(id);
    const { items, inventoryVersion, lastMoveAt, ...me } = p;
    return copy({
      serverTime: this.now(),
      event: this.event(),
      me: {
        ...me,
        inventory: count(p),
        reserve: p.progress[this.state.chapter].reserve,
      },
      players: Object.values(this.state.players)
        .filter(
          (x) =>
            x.id === id ||
            (x.setup && (this.connected === null || this.connected.has(x.id))),
        )
        .map((x) => ({
          connected: this.connected === null || this.connected.has(x.id),
          id: x.id,
          name: x.name,
          position: x.position,
          character: x.character,
          palette: x.palette,
          emote: x.emote,
          help: x.help,
          ready: x.ready,
          setup: x.setup,
        })),
      chapter: this.chapterView(p),
      world: CHAPTERS.map((c, index) => ({
        index,
        title: c.title,
        locations: c.locations,
      })),
      trades: Object.values(this.state.trades).filter(
        (t) => (t.from === id || t.to === id) && t.status === "pending",
      ),
      standings: ["brag", "awards", "closed"].includes(this.state.phase)
        ? this.standings()
        : [],
      rules: RULES,
    });
  }
  standings() {
    const c = this.state.chapter;
    return Object.values(this.state.players)
      .map((p) => ({
        id: p.id,
        name: p.name,
        score: p.progress[c].primary,
        secondary: c === 5 ? p.progress[c].budget : -p.progress[c].mistakes,
        complete: p.progress[c].complete,
        eligible: !this.state.awards.some((a) => a.playerId === p.id),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.secondary - a.secondary ||
          this.draw(a.id, CHAPTERS[c].title).localeCompare(
            this.draw(b.id, CHAPTERS[c].title),
          ),
      );
  }
  presentation() {
    return copy({
      serverTime: this.now(),
      event: this.event(),
      safeVisuals: true,
      chapter: {
        index: this.state.chapter,
        title: CHAPTERS[this.state.chapter].title,
      },
      standings: ["brag", "awards", "closed"].includes(this.state.phase)
        ? this.standings()
        : [],
      players: Object.values(this.state.players)
        .filter(
          (p) =>
            p.setup && (this.connected === null || this.connected.has(p.id)),
        )
        .map((p) => ({
          connected: true,
          id: p.id,
          name: p.name,
          position: p.position,
          character: p.character,
          palette: p.palette,
        })),
      world: CHAPTERS.map((c, index) => ({
        index,
        title: c.title,
        locations: c.locations,
      })),
    });
  }
  hostView() {
    return {
      ...this.presentation(),
      controlOwner: this.state.controlOwner,
      audit: copy(this.state.audit),
      players: Object.values(this.state.players).map((p) => ({
        connected: this.connected === null || this.connected.has(p.id),
        id: p.id,
        name: p.name,
        setup: p.setup,
        ready: p.ready,
        tutorial: p.tutorial,
        position: p.position,
      })),
      rules: copy(RULES),
    };
  }
  exportResults() {
    assert(this.state.snapshot, "Results are not frozen yet");
    return copy(this.state.snapshot);
  }
}
