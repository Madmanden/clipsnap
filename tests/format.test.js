import assert from "node:assert/strict";
import test from "node:test";

import { dataUrlByteLength, formatBytes, formatCaptureSummary } from "../lib/format.js";

test("data URL byte length accounts for base64 padding", () => {
  assert.equal(dataUrlByteLength("data:image/png;base64,AQID"), 3);
  assert.equal(dataUrlByteLength("data:image/png;base64,AQI="), 2);
  assert.equal(dataUrlByteLength("data:image/png;base64,AQ=="), 1);
});

test("bytes format as B, KB and MB", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(310 * 1024), "310 KB");
  assert.equal(formatBytes(2.5 * 1024 * 1024), "2.5 MB");
});

test("capture summary shows dimensions and size", () => {
  assert.equal(formatCaptureSummary(1280, 800, 310 * 1024), "1280×800 · 310 KB");
});
