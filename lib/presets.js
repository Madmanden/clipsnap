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

export function resolveTargetSize(sourceWidth, sourceHeight, presetId) {
  const preset = getPresetById(presetId);
  return resolveTargetSizeForWidth(sourceWidth, sourceHeight, preset?.targetWidth ?? null);
}
