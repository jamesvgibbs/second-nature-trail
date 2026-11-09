import test from "node:test";
import assert from "node:assert/strict";
import { readSafeOverride, writeSafeOverride } from "../public/helpers.mjs";
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
test("replacement selected offline survives a new client read before server persistence", () => {
  const storage = memoryStorage();
  assert.equal(readSafeOverride(storage), false);
  writeSafeOverride(storage, true);
  assert.equal(readSafeOverride(storage), true);
  const staleServerInsects = true;
  assert.equal(readSafeOverride(storage) || staleServerInsects !== true, true);
});
test("only an explicit successful enabling choice clears persistent replacement", () => {
  const storage = memoryStorage();
  writeSafeOverride(storage, true);
  writeSafeOverride(storage, false);
  assert.equal(readSafeOverride(storage), false);
});
test("unavailable storage defaults safely without crashing", () => {
  const storage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
    removeItem() {
      throw Error("blocked");
    },
  };
  assert.equal(readSafeOverride(storage), true);
  assert.doesNotThrow(() => writeSafeOverride(storage, true));
});
