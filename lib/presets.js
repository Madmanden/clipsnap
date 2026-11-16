import { resolveTargetSize as resolveTargetSizeForWidth } from "./resize.js";

export const STORAGE_KEY = "resizePreset";

export const DEFAULT_PRESET = "1280px";

export const PRESETS = [
  {
    id: "Full",
    label: "Full",
    description: "Native capture resolution",
    targetWidth: null,
  },
  {
    id: "1x",
    label: "1x",
    description: "Match CSS pixels on any display",
    targetWidth: null,
    matchCssPixels: true,
  },
  {
    id: "1280px",
    label: "1280px",
    description: "Recommended for AI coding agents",
    targetWidth: 1280,
  },
  {
    id: "960px",
    label: "960px",
    description: "Lighter while keeping text readable",
    targetWidth: 960,
  },
  {
    id: "Half",
    label: "Half",
    description: "50% of the native resolution",
    targetWidth: 0.5,
  },
];

const PRESET_BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]));

export function normalizePresetId(value) {
  return PRESET_BY_ID.has(value) ? value : DEFAULT_PRESET;
}

export function getPresetById(value) {
  return PRESET_BY_ID.get(normalizePresetId(value));
}

// The width setting for resolveTargetSize: a pixel width, a ratio below 1, or null for native.
// "1x" scales the capture down by devicePixelRatio so one image pixel equals one CSS pixel.
export function getTargetWidthSetting(preset, devicePixelRatio = 1) {
  if (preset?.matchCssPixels) {
    return devicePixelRatio > 1 ? 1 / devicePixelRatio : null;
  }

  return preset?.targetWidth ?? null;
}

export function resolveTargetSize(sourceWidth, sourceHeight, presetId, devicePixelRatio = 1) {
  const preset = getPresetById(presetId);
  return resolveTargetSizeForWidth(sourceWidth, sourceHeight, getTargetWidthSetting(preset, devicePixelRatio));
}
