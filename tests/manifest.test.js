import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("manifest exposes the resize helper to content scripts", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const resourceEntry = manifest.web_accessible_resources?.find((entry) =>
    entry.resources?.includes("lib/resize.js")
  );

  assert.ok(resourceEntry, "expected lib/resize.js to be web-accessible");
  assert.deepEqual(resourceEntry.matches, ["<all_urls>"]);
});
