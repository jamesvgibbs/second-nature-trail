import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const section = (a, b) =>
  source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
function fixture() {
  const elements = new Map();
  const node = () => ({
    children: [],
    value: "",
    dataset: {},
    append(...items) {
      this.children.push(...items);
    },
    querySelectorAll() {
      return this.inputs || [];
    },
  });
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  const radios = [{ value: "false" }, { value: "true" }];
  get("#setup-form").inputs = radios;
  const c = {
    safe: true,
    forceSafe: true,
    visualIntentGeneration: 0,
    latestVisualIntentInsects: false,
    keys: { up: "w" },
    state: { me: { id: "self", name: "Neighbor", character: 0, palette: 0 } },
    chosen: 0,
    swatch: 0,
    panel: "",
    modal: { open: false, trailRevision: 0 },
    app: {},
    localStorage: {},
    requests: [],
    stored: true,
    closes: 0,
    games: 0,
    persists: 0,
    formChoice: "true",
  };
  c.$ = get;
  c.document = { createElement: node };
  c.esc = String;
  c.topbar = () => "";
  c.avatarOptions = () => {};
  c.settingsFields = () => {};
  c.readSettings = () => ({});
  c.serverSettings = (x) => x;
  c.updateControlHints = () => {};
  c.open = () => {
    c.modal.open = true;
    c.modal.trailRevision++;
  };
  c.toast = () => {};
  c.close = () => {
    c.closes++;
    c.modal.open = false;
    c.modal.trailRevision++;
  };
  c.game = () => {
    c.games++;
  };
  c.persistReplacement = () => {
    c.persists++;
  };
  c.writeSafeOverride = (_, value) => {
    c.stored = value;
  };
  c.btn = (_, onclick) => ({ onclick });
  c.FormData = class {
    get() {
      return c.formChoice;
    }
  };
  c.act = (_, fields) =>
    new Promise((resolve) => c.requests.push({ fields, resolve }));
  // The real Settings callback reads remap inputs; supplying one unique mapping is sufficient.
  get("#remap").inputs = [{ value: "w", dataset: { action: "up" } }];
  vm.createContext(c);
  vm.runInContext(
    section(
      "function noteVisualIntent(",
      "async function persistReplacement()",
    ),
    c,
  );
  vm.runInContext(section("function setup()", "function avatarOptions()"), c);
  vm.runInContext(section("function settings()", "function worldKeys("), c);
  return { c, get, radios };
}
for (const mode of ["setup", "settings"])
  test(`${mode}: replacement selection invalidates an older pending enable acknowledgment`, async () => {
    const { c, get, radios } = fixture();
    c[mode]();
    const choose = (insects) => {
      if (mode === "setup") {
        c.formChoice = String(insects);
        radios[insects ? 1 : 0].onchange();
      } else {
        get("#safe-select").value = String(insects);
        get("#safe-select").onchange();
      }
    };
    const save = () =>
      mode === "setup"
        ? get("#setup-form").onsubmit({
            preventDefault() {},
            target: get("#setup-form"),
          })
        : get("#settings-save").children[0].onclick();
    choose(true);
    const pending = save();
    assert.equal(c.safe, true);
    choose(false);
    assert.equal(c.safe, true);
    assert.equal(c.forceSafe, true);
    c.requests[0].resolve({ ok: true });
    await pending;
    assert.equal(c.safe, true);
    assert.equal(c.forceSafe, true);
    assert.equal(c.stored, true);
    assert.equal(c.closes, 0);
    assert.equal(c.games, 0);
    // A later explicit, successful enable is allowed to clear replacement.
    choose(true);
    const latest = save();
    c.requests[1].resolve({ ok: true });
    await latest;
    assert.equal(c.safe, false);
    assert.equal(c.forceSafe, false);
    assert.equal(c.stored, false);
  });
for (const mode of ["setup", "settings"])
  test(`${mode}: failed enable keeps replacement`, async () => {
    const { c, get, radios } = fixture();
    c[mode]();
    if (mode === "setup") {
      radios[1].onchange();
    } else {
      get("#safe-select").value = "true";
      get("#safe-select").onchange();
    }
    const pending =
      mode === "setup"
        ? get("#setup-form").onsubmit({
            preventDefault() {},
            target: get("#setup-form"),
          })
        : get("#settings-save").children[0].onclick();
    c.requests[0].resolve(null);
    await pending;
    assert.equal(c.safe, true);
    assert.equal(c.forceSafe, true);
    assert.equal(c.stored, true);
  });

test("automatic replacement persistence cannot supersede an explicit pending enable", async () => {
  const { c } = fixture();
  c.connected = true;
  c.replacementSavePending = false;
  Object.assign(c.state.me, { setup: true, insects: true, settings: {} });
  vm.runInContext(
    source.slice(source.indexOf("async function persistReplacement()")),
    c,
  );
  c.noteVisualIntent(true);
  await c.persistReplacement();
  assert.equal(c.requests.length, 0);
  c.noteVisualIntent(false);
  const pending = c.persistReplacement();
  assert.equal(c.requests.length, 1);
  assert.equal(c.requests[0].fields.insects, false);
  c.requests[0].resolve({ ok: true });
  await pending;
  assert.equal(c.replacementSavePending, false);
});
test("settings acknowledgement saves latest intent without closing a newer dialog", async () => {
  const { c, get } = fixture();
  c.settings();
  get("#safe-select").value = "false";
  const submit = get("#settings-save").children[0].onclick;
  const pending = submit();
  await submit();
  assert.equal(c.requests.length, 1);
  c.panel = "help";
  c.open();
  const revision = c.modal.trailRevision;
  c.requests[0].resolve({ ok: true });
  await pending;
  assert.equal(c.closes, 0);
  assert.equal(c.panel, "help");
  assert.equal(c.modal.open, true);
  assert.equal(c.modal.trailRevision, revision);
});
