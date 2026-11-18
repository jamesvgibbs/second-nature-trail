import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createProjection, reduceProjection } from "../public/projection.mjs";

const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const section = (start, end) =>
  source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start)),
  );

function fixture() {
  const ids = new Map();
  let redraws = 0;
  const document = { activeElement: null };
  class Element {
    constructor(tag = "div") {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.textContent = "";
    }
    append(...children) {
      this.children.push(...children);
    }
    set innerHTML(html) {
      this.html = html;
      this.children = [];
      if (this === body) {
        redraws++;
        for (const id of [
          "emotes",
          "help-requests",
          "neighbor-list",
          "trade-list",
        ]) {
          const element = new Element();
          ids.set(`#${id}`, element);
          this.children.push(element);
        }
      }
    }
    get innerHTML() {
      return this.html || "";
    }
    querySelectorAll(selector) {
      assert(["button", "span"].includes(selector));
      return this.children.flatMap((child) => [
        ...(child.tagName === selector.toUpperCase() ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    focus() {
      document.activeElement = this;
    }
  }
  const body = new Element();
  const close = new Element("button");
  close.textContent = "Close";
  ids.set("#close-modal", close);
  document.createElement = (tag) => new Element(tag);
  const context = vm.createContext({
    document,
    body,
    $: (id) => ids.get(id) || null,
    // Retained Neighbors dialog; focused-scene sidebar has separate adapter tests.
    isMoveDayFocused: () => false,
    // This fixture exercises the retained overview; focused filter behavior has its own adapter.
    isFilterFocused: () => false,
    isFilterAvailable: () => false,
    projection: createProjection(),
    reduceProjection,
    state: null,
    modal: { open: true },
    panel: "neighbors",
    currentPhase: "chapter",
    currentChapter: 0,
    forceSafe: true,
    isPresentation: false,
    serverOffset: 0,
    safe: true,
    target: null,
    updateConnection() {},
    toast() {},
    close() {},
    btn: (label, onclick) => {
      const button = new Element("button");
      button.textContent = label;
      button.onclick = onclick;
      return button;
    },
    act: async (type, fields) => {
      context.lastAction = { type, ...fields };
      return { ok: true };
    },
    trade() {},
  });
  vm.runInContext(section("const esc =", "const btn ="), context);
  vm.runInContext(
    section("function neighborListSignature(", "function trade("),
    context,
  );
  vm.runInContext(
    section("function preservePanelFocus(", "function reserveHTML("),
    context,
  );
  vm.runInContext(section("function accept(", "function game("), context);
  const peer = (id, name = id, help = null) => ({
    id,
    name,
    help,
    position: { x: 600, y: 380 },
    emote: null,
  });
  let version = 0;
  const send = (players, extra = {}) =>
    context.accept(
      {
        projectionEpoch: "social-review",
        projectionVersion: ++version,
        serverTime: 1000,
        event: { phase: "chapter", chapter: 0 },
        me: { id: "self", insects: false },
        players: [peer("self"), ...players],
        chapter: {},
        trades: [],
        ...extra,
      },
      "full",
      version === 1,
    );
  const action = (key) =>
    body
      .querySelectorAll("button")
      .find((button) => button.dataset.focusKey === key);
  return {
    context,
    send,
    peer,
    action,
    ids,
    close,
    document,
    redraws: () => redraws,
  };
}

test("open Neighbors reflects help requests, clears, joins and names while keeping the same peer action focused", async () => {
  const f = fixture(),
    a = f.peer("a", "Ada"),
    b = f.peer("b", "Bo");
  f.send([a, b]);
  f.action("neighbor:b:assist").focus();
  f.send([a, { ...b, help: 0 }]);
  assert.match(
    f.ids.get("#neighbor-list").children[1].innerHTML,
    /Asked for help/,
  );
  assert.equal(f.document.activeElement.dataset.focusKey, "neighbor:b:assist");
  await f.document.activeElement.onclick();
  assert.equal(
    f.context.lastAction.target,
    "b",
    "Focus must not move to the first Help button",
  );
  f.send([a, { ...b, name: "Bo Updated", help: null }, f.peer("c", "Cleo")]);
  assert.equal(f.ids.get("#neighbor-list").children.length, 3);
  assert.match(f.ids.get("#neighbor-list").children[1].innerHTML, /Bo Updated/);
  assert.doesNotMatch(
    f.ids.get("#neighbor-list").children[1].innerHTML,
    /Asked for help/,
  );
  assert.equal(f.document.activeElement.dataset.focusKey, "neighbor:b:assist");
  f.send([a, f.peer("c", "Cleo")]);
  assert.equal(
    f.document.activeElement,
    f.close,
    "Removed peer action falls back to Close, not another person",
  );
});

test("movement, emotes and self help do not redraw an open Neighbors panel", () => {
  const f = fixture(),
    peer = f.peer("a", "Ada");
  f.send([peer]);
  f.action("neighbor:a:trade").focus();
  const originalButton = f.document.activeElement,
    originalDraws = f.redraws();
  f.send([
    { ...peer, position: { x: 700, y: 420 }, emote: { index: 2, until: 2000 } },
  ]);
  f.send([peer], { me: { id: "self", insects: false, help: 1 } });
  assert.equal(f.redraws(), originalDraws);
  assert.equal(f.document.activeElement, originalButton);
});

test("trade refresh preserves the offer identity and does not steal focus outside the panel", async () => {
  const f = fixture(),
    peers = [f.peer("a"), f.peer("b")];
  const offer = (id) => ({
    id,
    from: "self",
    to: "a",
    give: { item: "food", qty: 1 },
    receive: { item: "cable", qty: 1 },
    confirmed: [],
  });
  const one = offer("one"),
    two = offer("two");
  f.send(peers, { trades: [one, two] });
  f.action("trade:two:confirm").focus();
  f.send(peers, { trades: [one, { ...two, confirmed: ["a"] }] });
  assert.equal(f.document.activeElement.dataset.focusKey, "trade:two:confirm");
  await f.document.activeElement.onclick();
  assert.equal(f.context.lastAction.tradeId, "two");
  f.send(peers, { trades: [one] });
  assert.equal(f.document.activeElement, f.close);
  f.send([{ ...peers[0], help: 0 }, peers[1]], { trades: [one] });
  assert.equal(f.document.activeElement, f.close);
});

test("chapter change refreshes captured social actions without requiring the panel to reopen", async () => {
  const f = fixture(),
    peers = [f.peer("a")];
  f.send(peers);
  f.action("neighbor:a:assist").focus();
  f.send(peers, { event: { phase: "chapter", chapter: 1 } });
  await f.document.activeElement.onclick();
  assert.equal(f.context.lastAction.expectedChapter, 1);
  assert.equal(f.context.lastAction.target, "a");
});
