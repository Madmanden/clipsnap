const TOAST_HOST_ID = "clipsnap-toast-host";
const SUCCESS_TITLE = "Screenshot copied";
const FAILURE_TITLE = "Failed to copy";
const TOAST_DISMISS_MS = 2400;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  const preset = payload?.preset || { label: "Full", targetWidth: null };

  try {
    if (!dataUrl) {
      throw new Error("Missing screenshot data");
    }

    const image = await loadImage(dataUrl);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const targetWidth =
      preset.targetWidth != null && image.naturalWidth > preset.targetWidth
        ? preset.targetWidth < 1
          ? Math.max(1, Math.round(image.naturalWidth * preset.targetWidth))
          : preset.targetWidth
        : image.naturalWidth;
    const targetHeight =
      targetWidth === sourceWidth
        ? sourceHeight
        : Math.max(1, Math.round((sourceHeight * targetWidth) / sourceWidth));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error("Canvas rendering is not available");
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas);
    await copyToClipboard(blob);

    const wasResized = targetWidth !== sourceWidth;
    showToast(
      "success",
      SUCCESS_TITLE,
      preset.label === "Full"
        ? ""
        : wasResized
          ? `Resized to ${targetWidth}px wide`
          : "Copied at native size"
    );

    return {
      ok: true,
      width: targetWidth,
      height: targetHeight,
      resized: wasResized,
    };
  } catch (error) {
    const detail = stringifyError(error);
    showToast("error", FAILURE_TITLE, detail ? detail.slice(0, 120) : "");

    return {
      ok: false,
      error: detail || "Failed to copy screenshot",
    };
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The screenshot image could not be decoded"));
    image.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("The PNG blob could not be created"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
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

function showToast(kind, title, detail) {
  const existingHost = document.getElementById(TOAST_HOST_ID);
  if (existingHost) {
    existingHost.remove();
  }

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
