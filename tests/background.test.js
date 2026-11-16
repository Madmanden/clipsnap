import assert from "node:assert/strict";
import test, { mock } from "node:test";

function createChromeMock(calls) {
  return {
    action: {
      onClicked: { addListener() {} },
      setBadgeBackgroundColor: async (args) => {
        calls.setBadgeBackgroundColor.push(args);
      },
      setBadgeText: async (args) => {
        calls.setBadgeText.push(args);
      },
      setTitle: async (args) => {
        calls.setTitle.push(args);
      },
    },
    commands: {
      onCommand: { addListener() {} },
    },
    contextMenus: {
      onClicked: { addListener() {} },
      create: (args) => {
        calls.menuCreate?.push(args);
        return args.id;
      },
      removeAll: async () => {},
      update: async (id, args) => {
        calls.menuUpdate?.push({ id, ...args });
      },
    },
    runtime: {
      onInstalled: { addListener() {} },
    },
    scripting: {
      executeScript: async (args) => {
        calls.executeScript.push(args);
        calls.order?.push("inject");
      },
    },
    storage: {
      onChanged: { addListener() {} },
      sync: {
        get: async (defaults) => defaults,
        set: async (value) => {
          calls.storageSet.push(value);
        },
      },
    },
    tabs: {
      captureVisibleTab: async (...args) => {
        calls.captureVisibleTab.push(args);
        calls.order?.push("capture");
        return "data:image/png;base64,test";
      },
      query: async (args) => {
        calls.query.push(args);
        return [];
      },
      sendMessage: async (tabId, message) => {
        calls.sendMessage.push({ tabId, message });
        calls.order?.push(message.type);
        return { ok: true };
      },
    },
  };
}

test("restricted pages short-circuit without trying to capture or inject", async () => {
  const calls = {
    captureVisibleTab: [],
    executeScript: [],
    query: [],
    sendMessage: [],
    setBadgeBackgroundColor: [],
    setBadgeText: [],
    setTitle: [],
    storageSet: [],
  };

  const previousChrome = globalThis.chrome;
  globalThis.chrome = createChromeMock(calls);

  try {
    const { captureVisibleTabAndCopy } = await import(new URL("../background.js", import.meta.url));

    await captureVisibleTabAndCopy({
      id: 123,
      windowId: 456,
      url: "chrome-extension://example/options.html",
    });

    assert.equal(calls.captureVisibleTab.length, 0);
    assert.equal(calls.executeScript.length, 0);
    assert.equal(calls.sendMessage.length, 0);
    assert.equal(calls.setBadgeText.at(-1)?.text, "!");
    assert.equal(calls.setTitle.at(-1)?.title, "ClipSnap: This page is restricted by Chrome");
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("restricted internal Chrome pages are detected", async () => {
  const calls = {
    captureVisibleTab: [],
    executeScript: [],
    query: [],
    sendMessage: [],
    setBadgeBackgroundColor: [],
    setBadgeText: [],
    setTitle: [],
    storageSet: [],
  };

  const previousChrome = globalThis.chrome;
  globalThis.chrome = createChromeMock(calls);

  try {
    const { captureVisibleTabAndCopy } = await import(new URL("../background.js", import.meta.url));

    await captureVisibleTabAndCopy({
      id: 123,
      windowId: 456,
      url: "chrome://extensions/?id=example",
    });

    assert.equal(calls.captureVisibleTab.length, 0);
    assert.equal(calls.executeScript.length, 0);
    assert.equal(calls.sendMessage.length, 0);
    assert.equal(calls.setBadgeText.at(-1)?.text, "!");
    assert.equal(calls.setTitle.at(-1)?.title, "ClipSnap: This page is restricted by Chrome");
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("injects on demand, clears the toast before capturing, then copies", async () => {
  const calls = {
    captureVisibleTab: [],
    executeScript: [],
    order: [],
    query: [],
    sendMessage: [],
    setBadgeBackgroundColor: [],
    setBadgeText: [],
    setTitle: [],
    storageSet: [],
  };

  const previous = {
    chrome: globalThis.chrome,
    createImageBitmap: globalThis.createImageBitmap,
    OffscreenCanvas: globalThis.OffscreenCanvas,
  };
  globalThis.chrome = createChromeMock(calls);
  // 2560px wide capture; the default 1280px preset should resize it.
  globalThis.createImageBitmap = async () => ({ width: 2560, height: 1600, close() {} });
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return { drawImage() {} };
    }
    async convertToBlob() {
      return new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    }
  };

  try {
    const { captureVisibleTabAndCopy } = await import(new URL("../background.js", import.meta.url));

    await captureVisibleTabAndCopy({ id: 123, windowId: 456, url: "https://example.com/" });

    assert.deepEqual(calls.order, [
      "inject",
      "clipsnap-prepare-capture",
      "capture",
      "clipsnap-copy-screenshot",
    ]);
    const payload = calls.sendMessage.at(-1).message.payload;
    assert.equal(payload.dataUrl, "data:image/png;base64,AQID");
    assert.equal(payload.summary, "1280×800 · 3 B");
    assert.equal(calls.setBadgeText.at(-1)?.text, "");
  } finally {
    Object.assign(globalThis, previous);
  }
});

test("a page that refuses injection shows the restricted notice", async () => {
  const calls = {
    captureVisibleTab: [],
    executeScript: [],
    query: [],
    sendMessage: [],
    setBadgeBackgroundColor: [],
    setBadgeText: [],
    setTitle: [],
    storageSet: [],
  };

  const previousChrome = globalThis.chrome;
  globalThis.chrome = createChromeMock(calls);
  globalThis.chrome.scripting.executeScript = async () => {
    throw new Error("The extensions gallery cannot be scripted.");
  };

  try {
    const { captureVisibleTabAndCopy } = await import(new URL("../background.js", import.meta.url));

    // Without the tabs permission, tab.url is undefined on pages activeTab cannot reach.
    await captureVisibleTabAndCopy({ id: 123, windowId: 456 });

    assert.equal(calls.captureVisibleTab.length, 0);
    assert.equal(calls.setBadgeText.at(-1)?.text, "!");
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("error badges clear themselves after a few seconds", async () => {
  const calls = {
    captureVisibleTab: [],
    executeScript: [],
    query: [],
    sendMessage: [],
    setBadgeBackgroundColor: [],
    setBadgeText: [],
    setTitle: [],
    storageSet: [],
  };

  const previousChrome = globalThis.chrome;
  globalThis.chrome = createChromeMock(calls);
  mock.timers.enable({ apis: ["setTimeout"] });

  try {
    const { captureVisibleTabAndCopy } = await import(new URL("../background.js", import.meta.url));

    await captureVisibleTabAndCopy({ id: 123, windowId: 456, url: "chrome://settings" });
    assert.equal(calls.setBadgeText.at(-1)?.text, "!");

    mock.timers.tick(3999);
    assert.equal(calls.setBadgeText.at(-1)?.text, "!");

    mock.timers.tick(1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.setBadgeText.at(-1)?.text, "");
  } finally {
    mock.timers.reset();
    globalThis.chrome = previousChrome;
  }
});

test("1x preset uses the page's devicePixelRatio", async () => {
  const calls = {
    captureVisibleTab: [],
    executeScript: [],
    query: [],
    sendMessage: [],
    setBadgeBackgroundColor: [],
    setBadgeText: [],
    setTitle: [],
    storageSet: [],
  };

  const previous = {
    chrome: globalThis.chrome,
    createImageBitmap: globalThis.createImageBitmap,
    OffscreenCanvas: globalThis.OffscreenCanvas,
  };
  globalThis.chrome = createChromeMock(calls);
  globalThis.chrome.storage.sync.get = async () => ({ resizePreset: "1x" });
  globalThis.chrome.tabs.sendMessage = async (tabId, message) => {
    calls.sendMessage.push({ tabId, message });
    return message.type === "clipsnap-prepare-capture" ? { ok: true, devicePixelRatio: 2 } : { ok: true };
  };
  globalThis.createImageBitmap = async () => ({ width: 2880, height: 1800, close() {} });
  globalThis.OffscreenCanvas = class {
    getContext() {
      return { drawImage() {} };
    }
    async convertToBlob() {
      return new Blob([new Uint8Array([1])], { type: "image/png" });
    }
  };

  try {
    const { captureVisibleTabAndCopy } = await import(new URL("../background.js", import.meta.url));

    await captureVisibleTabAndCopy({ id: 123, windowId: 456, url: "https://example.com/" });

    const payload = calls.sendMessage.at(-1).message.payload;
    assert.match(payload.summary, /^1440×900 · /);
  } finally {
    Object.assign(globalThis, previous);
  }
});

function createMenuCalls() {
  return {
    menuCreate: [],
    menuUpdate: [],
    storageSet: [],
    setBadgeBackgroundColor: [],
    setBadgeText: [],
    setTitle: [],
  };
}

test("preset menu lists every preset as a radio item with the current one checked", async () => {
  const calls = createMenuCalls();
  const previousChrome = globalThis.chrome;
  globalThis.chrome = createChromeMock(calls);
  globalThis.chrome.storage.sync.get = async () => ({ resizePreset: "960px" });

  try {
    const { setupPresetMenu } = await import(new URL("../background.js", import.meta.url));
    const { PRESETS } = await import(new URL("../lib/presets.js", import.meta.url));

    await setupPresetMenu();

    assert.deepEqual(
      calls.menuCreate.map((item) => item.id),
      PRESETS.map((preset) => `preset:${preset.id}`)
    );
    assert.ok(calls.menuCreate.every((item) => item.type === "radio" && item.contexts[0] === "action"));
    assert.deepEqual(
      calls.menuCreate.filter((item) => item.checked).map((item) => item.id),
      ["preset:960px"]
    );
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("choosing a preset in the menu saves it; unknown ids are ignored", async () => {
  const calls = createMenuCalls();
  const previousChrome = globalThis.chrome;
  globalThis.chrome = createChromeMock(calls);

  try {
    const { handlePresetMenuClick } = await import(new URL("../background.js", import.meta.url));

    await handlePresetMenuClick({ menuItemId: "preset:Half" });
    await handlePresetMenuClick({ menuItemId: "preset:bogus" });
    await handlePresetMenuClick({ menuItemId: "something-else" });

    assert.deepEqual(calls.storageSet, [{ resizePreset: "Half" }]);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("preset changes elsewhere update the menu check", async () => {
  const calls = createMenuCalls();
  const previousChrome = globalThis.chrome;
  globalThis.chrome = createChromeMock(calls);

  try {
    const { syncPresetMenu } = await import(new URL("../background.js", import.meta.url));

    await syncPresetMenu("1x");

    assert.deepEqual(calls.menuUpdate, [{ id: "preset:1x", checked: true }]);
  } finally {
    globalThis.chrome = previousChrome;
  }
});
