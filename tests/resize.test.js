import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PRESET,
  getPresetById,
  getTargetWidthSetting,
  normalizePresetId,
  resolveTargetSize,
} from "../lib/presets.js";
import { planDownscaleSteps, resolveTargetSize as resolveTargetSizeForWidth } from "../lib/resize.js";

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

test("downscale steps halve until within 2x of the target", () => {
  assert.deepEqual(planDownscaleSteps(2880, 1800, 1280, 800), [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]);
});

test("small downscales draw the target in one step", () => {
  assert.deepEqual(planDownscaleSteps(1600, 1000, 1280, 800), [{ width: 1280, height: 800 }]);
});

test("large downscales take several halving steps", () => {
  assert.deepEqual(planDownscaleSteps(5120, 3200, 960, 600), [
    { width: 2560, height: 1600 },
    { width: 1280, height: 800 },
    { width: 960, height: 600 },
  ]);
});

test("1x preset scales by devicePixelRatio to match CSS pixels", () => {
  assert.deepEqual(resolveTargetSize(2880, 1800, "1x", 2), { width: 1440, height: 900 });
  assert.deepEqual(resolveTargetSize(3000, 1500, "1x", 1.5), { width: 2000, height: 1000 });
});

test("1x preset keeps native size on standard-density displays", () => {
  assert.equal(getTargetWidthSetting(getPresetById("1x"), 1), null);
  assert.deepEqual(resolveTargetSize(1440, 900, "1x", 1), { width: 1440, height: 900 });
});
