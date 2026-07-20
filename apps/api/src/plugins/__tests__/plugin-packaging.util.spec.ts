import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareSemver,
  computePayloadSha256,
  normalizeZipEntries,
  parsePluginManifest,
  satisfiesMinCoreVersion,
  validatePluginPackage,
} from "../plugin-packaging.util.js";
import {
  THEFORGE_PLUGIN_MANIFEST_FILENAME,
  THEFORGE_PLUGIN_MANIFEST_VERSION,
} from "@theforge/shared-types";

test("compareSemver — orden correcto", () => {
  assert.ok(compareSemver("1.6.2", "1.6.0") > 0);
  assert.ok(compareSemver("1.6.0", "1.6.2") < 0);
  assert.equal(compareSemver("2.0.0", "2.0.0"), 0);
});

test("satisfiesMinCoreVersion", () => {
  assert.ok(satisfiesMinCoreVersion("1.0.0", "1.6.2"));
  assert.ok(!satisfiesMinCoreVersion("2.0.0", "1.6.2"));
});

test("parsePluginManifest — id reverse-DNS", () => {
  const m = parsePluginManifest({
    manifestVersion: THEFORGE_PLUGIN_MANIFEST_VERSION,
    id: "com.kreodevs.evd",
    version: "1.0.0",
    name: "EVD",
  });
  assert.equal(m.id, "com.kreodevs.evd");
});

test("normalizeZipEntries — elimina prefijo raíz único", () => {
  const normalized = normalizeZipEntries([
    { relativePath: "my-plugin/index.js", content: Buffer.from("x") },
    { relativePath: "my-plugin/pkg.json", content: Buffer.from("{}") },
  ]);
  assert.equal(normalized[0]?.relativePath, "index.js");
});

test("validatePluginPackage — checksum y entry", () => {
  const index = Buffer.from("export default class P {}");
  const entries = [
    {
      relativePath: THEFORGE_PLUGIN_MANIFEST_FILENAME,
      content: Buffer.from(
        JSON.stringify({
          manifestVersion: THEFORGE_PLUGIN_MANIFEST_VERSION,
          id: "com.test.plugin",
          version: "1.0.0",
          name: "Test",
          entry: "index.js",
        }),
      ),
    },
    { relativePath: "index.js", content: index },
  ];
  entries[0] = {
    relativePath: THEFORGE_PLUGIN_MANIFEST_FILENAME,
    content: Buffer.from(
      JSON.stringify({
        manifestVersion: THEFORGE_PLUGIN_MANIFEST_VERSION,
        id: "com.test.plugin",
        version: "1.0.0",
        name: "Test",
        entry: "index.js",
        payloadSha256: computePayloadSha256(entries),
      }),
    ),
  };

  const result = validatePluginPackage(entries, {
    coreVersion: "1.6.2",
    requireSignature: false,
    signingSecret: "",
  });
  assert.equal(result.manifest.id, "com.test.plugin");
  assert.equal(result.entryPath, "index.js");
});
