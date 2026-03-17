import { DEFAULT_PRESET, PRESETS, STORAGE_KEY, normalizePresetId } from "./lib/presets.js";

const form = document.getElementById("preset-form");
const presetList = document.getElementById("preset-list");
const status = document.getElementById("status");
const shortcutBadge = document.getElementById("shortcut-badge");
const shortcutCopy = document.getElementById("shortcut-copy");

let statusTimer = null;

function renderPresets(selectedPreset) {
  presetList.textContent = "";

  for (const preset of PRESETS) {
    const option = document.createElement("label");
    option.className = "preset-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "preset";
    input.className = "preset-input";
    input.value = preset.id;
    input.checked = preset.id === selectedPreset;

    const card = document.createElement("span");
    card.className = "preset-card";

    const title = document.createElement("span");
    title.className = "preset-title";
    title.textContent = preset.label;

    if (preset.id === "1280px") {
      const badge = document.createElement("span");
      badge.className = "preset-pill";
      badge.textContent = "Recommended";
      title.appendChild(badge);
    }

    const copy = document.createElement("span");
    copy.className = "preset-copy";
    copy.textContent = preset.description;

    card.append(title, copy);
    option.append(input, card);
    presetList.appendChild(option);
  }
}

function showStatus(message) {
  status.textContent = message;

  if (statusTimer) {
    window.clearTimeout(statusTimer);
  }

  statusTimer = window.setTimeout(() => {
    status.textContent = "";
  }, 1800);
}

async function loadShortcut() {
  const commands = await chrome.commands.getAll();
  const captureCommand = commands.find((command) => command.name === "capture-visible-tab");
  const shortcut = captureCommand?.shortcut || "Open Chrome shortcut settings to assign one";

  shortcutBadge.textContent = shortcut;
  shortcutCopy.textContent = captureCommand?.shortcut
    ? "Use Chrome's shortcut settings if you want to remap it."
    : "Open Chrome shortcut settings to assign a shortcut.";
}

async function loadPreset() {
  const stored = await chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_PRESET });
  const presetId = normalizePresetId(stored[STORAGE_KEY]);

  if (presetId !== stored[STORAGE_KEY]) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: presetId });
  }

  return presetId;
}

async function savePreset(presetId) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: presetId });
  showStatus(`Saved ${presetId}`);
}

form.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.name !== "preset") {
    return;
  }

  await savePreset(target.value);
});

async function init() {
  const presetId = await loadPreset();
  renderPresets(presetId);
  await loadShortcut();
}

await init();
