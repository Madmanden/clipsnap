import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

test("manifest permissions are locked to the minimal set", () => {
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "clipboardWrite", "contextMenus", "scripting", "storage"]);
  assert.equal(manifest.host_permissions, undefined);
});

test("manifest does not run or expose anything on every website", () => {
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
});
