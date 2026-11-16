// Injected on demand by background.js; the guard keeps repeated injections from
// registering duplicate listeners or redeclaring top-level bindings.
if (!globalThis.__clipsnapContentLoaded) {
  globalThis.__clipsnapContentLoaded = true;

const TOAST_HOST_ID = "clipsnap-toast-host";
const SUCCESS_TITLE = "Screenshot copied";
const FAILURE_TITLE = "Failed to copy";
const TOAST_DISMISS_MS = 2400;
const FOCUS_HINT = "Click the page and try again";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "clipsnap-prepare-capture") {
    // Remove any previous toast and wait for a repaint so it is not captured.
    removeToast();
    requestAnimationFrame(() => requestAnimationFrame(() => sendResponse({ ok: true, devicePixelRatio: window.devicePixelRatio || 1 })));
    return true;
  }

  if (message?.type !== "clipsnap-copy-screenshot") {
    return false;
  }

  void handleCopyRequest(message.payload)
    .then((result) => {
      sendResponse(result);
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: stringifyError(error) || "Failed to copy screenshot",
      });
    });

  return true;
});

async function handleCopyRequest(payload) {
  const dataUrl = payload?.dataUrl;

  try {
    if (!dataUrl) {
      throw new Error("Missing screenshot data");
    }

    await copyToClipboard(dataUrlToBlob(dataUrl));

    showToast("success", SUCCESS_TITLE, payload.summary || "");

    return { ok: true };
  } catch (error) {
    const detail = isFocusError(error) ? FOCUS_HINT : stringifyError(error);
    showToast("error", FAILURE_TITLE, detail ? detail.slice(0, 120) : "");

    return {
      ok: false,
      error: detail || "Failed to copy screenshot",
    };
  }
}

// clipboard.write rejects when focus is in the address bar or DevTools.
function isFocusError(error) {
  return error?.name === "NotAllowedError" || /not focused/i.test(stringifyError(error));
}

function dataUrlToBlob(dataUrl) {
  const [header, base64 = ""] = dataUrl.split(",", 2);
  const type = /^data:([^;,]+)/.exec(header)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type });
}

async function copyToClipboard(blob) {
  if (typeof ClipboardItem !== "function") {
    throw new Error("Clipboard image writes are not available in this browser context");
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob,
    }),
  ]);
}

function removeToast() {
  document.getElementById(TOAST_HOST_ID)?.remove();
}

function showToast(kind, title, detail) {
  removeToast();

  const host = document.createElement("div");
  host.id = TOAST_HOST_ID;
  host.style.position = "fixed";
  host.style.top = "16px";
  host.style.right = "16px";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
    }

    .toast {
      box-sizing: border-box;
      display: grid;
      gap: 4px;
      min-width: 240px;
      max-width: min(360px, calc(100vw - 32px));
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid transparent;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0.01em;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.24);
      backdrop-filter: blur(10px);
      opacity: 0;
      transform: translateY(-8px);
      transition: opacity 180ms ease, transform 180ms ease;
    }

    .toast.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .toast.success {
      color: #f8fafc;
      background: rgba(15, 23, 42, 0.96);
      border-color: rgba(148, 163, 184, 0.22);
    }

    .toast.error {
      color: #fff1f2;
      background: rgba(127, 29, 29, 0.96);
      border-color: rgba(251, 113, 133, 0.35);
    }

    .title {
      font-size: 13px;
      font-weight: 650;
      line-height: 1.2;
    }

    .detail {
      font-size: 12px;
      line-height: 1.35;
      opacity: 0.82;
    }
  `;

  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");

  const titleEl = document.createElement("div");
  titleEl.className = "title";
  titleEl.textContent = title;
  toast.appendChild(titleEl);

  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "detail";
    detailEl.textContent = detail;
    toast.appendChild(detailEl);
  }

  shadow.append(style, toast);
  document.documentElement.appendChild(host);

  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => host.remove(), 220);
  }, TOAST_DISMISS_MS);
}

function stringifyError(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  return String(error.message || error.reason || error);
}
}
