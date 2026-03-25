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

const RESTRICTED_URL_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^about:/,
];

async function captureVisibleTabAndCopy(fallbackTab) {
  let activeTabId = null;

  try {
    const tab = await getActiveTab(fallbackTab);
    if (!tab?.id || typeof tab.windowId !== "number") {
      throw new Error("No active tab available");
    }
    activeTabId = tab.id;

    // Check for restricted URLs before attempting capture
    if (tab.url && RESTRICTED_URL_PATTERNS.some((pattern) => pattern.test(tab.url))) {
      await showRestrictedCaptureNotice(activeTabId);
      return;
    }

    const preset = await getCurrentPreset();
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const outcome = await sendMessageWithRetry(tab.id, {
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

    await clearActionError(activeTabId);
  } catch (error) {
    console.error("ClipSnap capture failed:", error);
    await showActionError(activeTabId, describeError(error));
  }
}

export { captureVisibleTabAndCopy };

async function sendMessageWithRetry(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (firstError) {
    if (!isMissingReceiverError(firstError)) {
      throw firstError;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });

    return chrome.tabs.sendMessage(tabId, message);
  }
}

function isMissingReceiverError(error) {
  const text = String(error?.message || error || "");
  return text.includes("Receiving end does not exist");
}

function describeError(error) {
  const text = String(error?.message || error || "Failed to copy screenshot");

  if (
    text.includes("Cannot access contents of the page") ||
    text.includes("chrome://") ||
    text.includes("The extensions gallery cannot be scripted")
  ) {
    return "This page is restricted by Chrome";
  }

  return "Capture failed";
}

async function showActionError(tabId, message) {
  if (!tabId) {
    return;
  }

  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b91c1c" });
    await chrome.action.setBadgeText({ tabId, text: "ERR" });
    await chrome.action.setTitle({ tabId, title: `ClipSnap: ${message}` });
  } catch (error) {
    console.warn("ClipSnap action badge update failed:", error);
  }
}

async function showRestrictedCaptureNotice(tabId) {
  if (!tabId) {
    return;
  }

  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b91c1c" });
    await chrome.action.setBadgeText({ tabId, text: "!" });
    await chrome.action.setTitle({
      tabId,
      title: "ClipSnap: This page is restricted by Chrome",
    });
  } catch (error) {
    console.warn("ClipSnap restricted-page notice failed:", error);
  }
}

async function clearActionError(tabId) {
  if (!tabId) {
    return;
  }

  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setTitle({ tabId, title: "ClipSnap" });
  } catch (error) {
    console.warn("ClipSnap action badge clear failed:", error);
  }
}
