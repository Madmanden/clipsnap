import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PRESET, normalizePresetId, resolveTargetSize } from "../lib/presets.js";

test("normalizes invalid presets to the default", () => {
  assert.equal(normalizePresetId("not-a-real-preset"), DEFAULT_PRESET);
});

test("full preset keeps the native size", () => {
  assert.deepEqual(resolveTargetSize(2560, 1600, "Full"), {
    width: 2560,
    height: 1600,
  });
});

test("1280 preset downsizes large screenshots", () => {
  assert.deepEqual(resolveTargetSize(2560, 1600, "1280px"), {
    width: 1280,
    height: 800,
  });
});

test("960 preset does not upscale smaller screenshots", () => {
  assert.deepEqual(resolveTargetSize(800, 500, "960px"), {
    width: 800,
    height: 500,
  });
});

test("half preset rounds to the nearest pixel", () => {
  assert.deepEqual(resolveTargetSize(301, 199, "Half"), {
    width: 151,
    height: 100,
  });
});
