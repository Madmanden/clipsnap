import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PRESET, normalizePresetId, resolveTargetSize } from "../lib/presets.js";
import { resolveTargetSize as resolveTargetSizeForWidth } from "../lib/resize.js";

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

test("shared resize helper uses downscale-only behavior", () => {
  assert.deepEqual(resolveTargetSizeForWidth(800, 500, 1280), {
    width: 800,
    height: 500,
  });
});

test("shared resize helper handles ratio presets", () => {
  assert.deepEqual(resolveTargetSizeForWidth(301, 199, 0.5), {
    width: 151,
    height: 100,
  });
});
