import {
  DEFAULT_PRESET,
  getPresetById,
  normalizePresetId,
  STORAGE_KEY,
} from "./lib/presets.js";

chrome.action.onClicked.addListener((tab) => {
  void captureVisibleTabAndCopy(tab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-visible-tab") {
    void captureVisibleTabAndCopy();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    void ensureDefaultPreset();
  }
});

async function ensureDefaultPreset() {
  const stored = await chrome.storage.sync.get({ [STORAGE_KEY]: null });
  if (stored[STORAGE_KEY] == null) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULT_PRESET });
  }
}

async function getActiveTab(fallbackTab) {
  if (fallbackTab?.id != null) {
    return fallbackTab;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getCurrentPreset() {
  const stored = await chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_PRESET });
  const presetId = normalizePresetId(stored[STORAGE_KEY]);

  if (presetId !== stored[STORAGE_KEY]) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: presetId });
  }

  return getPresetById(presetId);
}

async function captureVisibleTabAndCopy(fallbackTab) {
  try {
    const tab = await getActiveTab(fallbackTab);
    if (!tab?.id || typeof tab.windowId !== "number") {
      throw new Error("No active tab available");
    }

    const preset = await getCurrentPreset();
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const outcome = await chrome.tabs.sendMessage(tab.id, {
      type: "clipsnap-copy-screenshot",
      payload: {
        dataUrl,
        preset: {
          id: preset.id,
          label: preset.label,
          targetWidth: preset.targetWidth,
        },
      },
    });

    if (!outcome?.ok) {
      throw new Error(outcome?.error || "Failed to copy screenshot");
    }
  } catch (error) {
    console.error("ClipSnap capture failed:", error);
  }
}
