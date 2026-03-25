import assert from "node:assert/strict";
import test from "node:test";

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
    runtime: {
      onInstalled: { addListener() {} },
    },
    scripting: {
      executeScript: async (args) => {
        calls.executeScript.push(args);
      },
    },
    storage: {
      sync: {
        get: async (defaults) => defaults,
        set: async (value) => {
          calls.storageSet.push(value);
        },
      },
    },
    tabs: {
      captureVisibleTab: async (args) => {
        calls.captureVisibleTab.push(args);
        return "data:image/png;base64,test";
      },
      query: async (args) => {
        calls.query.push(args);
        return [];
      },
      sendMessage: async (tabId, message) => {
        calls.sendMessage.push({ tabId, message });
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
