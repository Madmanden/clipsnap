import {
  DEFAULT_PRESET,
  getPresetById,
  getTargetWidthSetting,
  normalizePresetId,
  PRESETS,
  STORAGE_KEY,
} from "./lib/presets.js";
import { dataUrlByteLength, formatCaptureSummary } from "./lib/format.js";
import { renderScaledPng } from "./lib/render.js";

chrome.action.onClicked.addListener((tab) => {
  void captureVisibleTabAndCopy(tab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-visible-tab") {
    void captureVisibleTabAndCopy();
  }
});

// Right-click menu on the toolbar icon: switch preset without opening the options page.
const PRESET_MENU_PREFIX = "preset:";

chrome.runtime.onInstalled.addListener(() => {
  void setupPresetMenu();
});

chrome.contextMenus.onClicked.addListener((info) => {
  void handlePresetMenuClick(info);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEY]) {
    void syncPresetMenu(changes[STORAGE_KEY].newValue);
  }
});

async function setupPresetMenu() {
  const { id: selectedId } = await getCurrentPreset();
  await chrome.contextMenus.removeAll();

  for (const preset of PRESETS) {
    chrome.contextMenus.create({
      id: `${PRESET_MENU_PREFIX}${preset.id}`,
      type: "radio",
      title: `${preset.label} – ${preset.description}`,
      contexts: ["action"],
      checked: preset.id === selectedId,
    });
  }
}

async function handlePresetMenuClick(info) {
  const menuId = String(info?.menuItemId ?? "");
  if (!menuId.startsWith(PRESET_MENU_PREFIX)) {
    return;
  }

  const presetId = menuId.slice(PRESET_MENU_PREFIX.length);
  if (normalizePresetId(presetId) === presetId) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: presetId });
  }
}

// Keeps the menu in step when the preset changes elsewhere (options page, another device).
async function syncPresetMenu(presetId) {
  try {
    await chrome.contextMenus.update(`${PRESET_MENU_PREFIX}${normalizePresetId(presetId)}`, { checked: true });
  } catch (error) {
    console.warn("ClipSnap preset menu update failed:", error);
  }
}

export { handlePresetMenuClick, setupPresetMenu, syncPresetMenu };

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

const RESTRICTED_MESSAGE = "This page is restricted by Chrome";
const FOCUS_MESSAGE = "Click the page and try again";
const BADGE_CLEAR_MS = 4000;

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

    await ensureContentScript(tab.id);
    const prepared = await chrome.tabs.sendMessage(tab.id, { type: "clipsnap-prepare-capture" });

    const preset = await getCurrentPreset();
    const capturedDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const image = await renderScaledPng(
      capturedDataUrl,
      getTargetWidthSetting(preset, prepared?.devicePixelRatio ?? 1)
    );
    const outcome = await chrome.tabs.sendMessage(tab.id, {
      type: "clipsnap-copy-screenshot",
      payload: {
        dataUrl: image.dataUrl,
        summary: formatCaptureSummary(image.width, image.height, dataUrlByteLength(image.dataUrl)),
      },
    });

    if (!outcome?.ok) {
      throw new Error(outcome?.error || "Failed to copy screenshot");
    }

    await clearActionError(activeTabId);
  } catch (error) {
    console.error("ClipSnap capture failed:", error);
    const description = describeError(error);
    if (description === RESTRICTED_MESSAGE) {
      await showRestrictedCaptureNotice(activeTabId);
    } else {
      await showActionError(activeTabId, description);
    }
  }
}

export { captureVisibleTabAndCopy };

// The content script is injected on demand (activeTab + scripting) instead of
// running on every page. content.js guards against repeated injection.
async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

function describeError(error) {
  const text = String(error?.message || error || "Failed to copy screenshot");

  if (
    text.includes("Cannot access") ||
    text.includes("chrome://") ||
    text.includes("The extensions gallery cannot be scripted")
  ) {
    return RESTRICTED_MESSAGE;
  }

  if (text.includes(FOCUS_MESSAGE)) {
    return FOCUS_MESSAGE;
  }

  return "Capture failed";
}

const badgeClearTimers = new Map();

function showActionError(tabId, message) {
  return showBadge(tabId, "ERR", message);
}

function showRestrictedCaptureNotice(tabId) {
  return showBadge(tabId, "!", RESTRICTED_MESSAGE);
}

// Error badges clear themselves after a few seconds instead of lingering until
// the next successful capture in the same tab.
async function showBadge(tabId, text, message) {
  if (!tabId) {
    return;
  }

  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b91c1c" });
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setTitle({ tabId, title: `ClipSnap: ${message}` });
  } catch (error) {
    console.warn("ClipSnap action badge update failed:", error);
    return;
  }

  clearTimeout(badgeClearTimers.get(tabId));
  badgeClearTimers.set(
    tabId,
    setTimeout(() => {
      badgeClearTimers.delete(tabId);
      void clearActionError(tabId);
    }, BADGE_CLEAR_MS)
  );
}

async function clearActionError(tabId) {
  if (!tabId) {
    return;
  }

  clearTimeout(badgeClearTimers.get(tabId));
  badgeClearTimers.delete(tabId);

  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setTitle({ tabId, title: "ClipSnap" });
  } catch (error) {
    console.warn("ClipSnap action badge clear failed:", error);
  }
}
