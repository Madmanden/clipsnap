import { planDownscaleSteps, resolveTargetSize } from "./resize.js";

// Runs in the service worker: scales a captured PNG data URL without touching the page.
export async function renderScaledPng(dataUrl, targetWidthSetting) {
  const sourceBlob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(sourceBlob);
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const { width, height } = resolveTargetSize(sourceWidth, sourceHeight, targetWidthSetting);

  if (width === sourceWidth && height === sourceHeight) {
    bitmap.close();
    return { dataUrl, width, height, resized: false };
  }

  let source = bitmap;
  for (const step of planDownscaleSteps(sourceWidth, sourceHeight, width, height)) {
    const canvas = new OffscreenCanvas(step.width, step.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas rendering is not available");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, step.width, step.height);
    source = canvas;
  }
  bitmap.close();

  const blob = await source.convertToBlob({ type: "image/png" });
  return { dataUrl: await blobToDataUrl(blob), width, height, resized: true };
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}
