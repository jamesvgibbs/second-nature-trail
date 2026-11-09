import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyDevice,
  readStoredPreferences,
  serverPreferences,
  clientPreferences,
  isValidKeyMap,
} from "../public/helpers.mjs";

test("device policy blocks representative mobile signals while preserving touchscreen laptops", () => {
  const cases = [
    [
      "iPhone",
      {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        maxTouchPoints: 5,
        coarsePointer: true,
      },
      "unsupported-mobile",
    ],
    [
      "Android phone",
      {
        userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)",
        maxTouchPoints: 5,
        coarsePointer: true,
        mobileHint: true,
      },
      "unsupported-mobile",
    ],
    [
      "iPad desktop UA",
      {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        maxTouchPoints: 5,
        coarsePointer: true,
      },
      "unsupported-mobile",
    ],
    [
      "Windows touchscreen laptop",
      {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        maxTouchPoints: 10,
        coarsePointer: true,
      },
      "desktop",
    ],
    [
      "Mac laptop",
      {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        maxTouchPoints: 0,
        coarsePointer: false,
      },
      "desktop",
    ],
    [
      "Touch alone",
      { userAgent: "Unknown", maxTouchPoints: 5, coarsePointer: true },
      "desktop",
    ],
    [
      "UA alone",
      { userAgent: "iPhone", maxTouchPoints: 0, coarsePointer: false },
      "desktop",
    ],
  ];
  for (const [label, input, expected] of cases)
    assert.equal(classifyDevice(input), expected, label);
});

test("unavailable or corrupt preference storage does not crash entry", () => {
  assert.deepEqual(
    readStoredPreferences({
      getItem() {
        throw new Error("Storage denied");
      },
    }),
    {},
  );
  assert.deepEqual(
    readStoredPreferences({
      getItem() {
        return "{invalid";
      },
    }),
    {},
  );
  assert.deepEqual(
    readStoredPreferences({
      getItem() {
        return "null";
      },
    }),
    {},
  );
  assert.deepEqual(
    readStoredPreferences({
      getItem() {
        return "[]";
      },
    }),
    {},
  );
});

test("text size and sound settings survive the client/server conversion and key conflicts are rejected", () => {
  for (const textSize of [16, 20, 24]) {
    const input = {
      textSize,
      controls: "pointer",
      music: 35,
      effects: 70,
      reducedMotion: true,
    };
    const server = serverPreferences(input);
    assert.ok([1, 1.25, 1.5].includes(server.textSize));
    const output = clientPreferences(server);
    assert.equal(output.textSize, textSize);
    assert.equal(output.controls, "pointer");
    assert.equal(output.music, 35);
    assert.equal(output.effects, 70);
  }
  assert.equal(isValidKeyMap({ up: "W", down: "w" }), false);
  assert.equal(isValidKeyMap({ up: " ", down: "s" }), false);
  assert.equal(isValidKeyMap({ up: "w", down: "s" }), true);
});

test("desktop-UA iPad remains unsupported when a trackpad is the primary pointer", () => {
  assert.equal(
    classifyDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      maxTouchPoints: 5,
      coarsePointer: false,
      anyCoarsePointer: true,
    }),
    "unsupported-mobile",
  );
  assert.equal(
    classifyDevice({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      maxTouchPoints: 10,
      coarsePointer: false,
      anyCoarsePointer: true,
    }),
    "desktop",
  );
});
