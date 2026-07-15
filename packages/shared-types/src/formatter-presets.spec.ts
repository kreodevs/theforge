import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPreset, listPresets, registerPreset } from "./formatter-presets.js";

describe("getPreset", () => {
  it("returns minimal preset", () => {
    const preset = getPreset("minimal");
    assert.ok(preset);
    assert.equal(preset.name, "minimal");
    assert.equal(preset.format.useAst, true);
    assert.equal(preset.format.generateToc, false);
  });

  it("returns standard preset", () => {
    const preset = getPreset("standard");
    assert.ok(preset);
    assert.equal(preset.name, "standard");
    assert.equal(preset.format.headingRepair?.fixInlineSubheadings, true);
  });

  it("returns strict preset", () => {
    const preset = getPreset("strict");
    assert.ok(preset);
    assert.equal(preset.name, "strict");
    assert.equal(preset.format.generateToc, true);
  });

  it("returns undefined for unknown preset", () => {
    assert.equal(getPreset("nonexistent"), undefined);
  });
});

describe("listPresets", () => {
  it("lists built-in presets", () => {
    const presets = listPresets();
    assert.ok(presets.includes("minimal"));
    assert.ok(presets.includes("standard"));
    assert.ok(presets.includes("strict"));
  });
});

describe("registerPreset", () => {
  it("registers a custom preset", () => {
    registerPreset({
      name: "test-custom",
      description: "Test",
      format: { useAst: true },
      toc: { minDepth: 1, maxDepth: 3, useAnchors: true },
      taskList: { normalizeMarkers: true },
    });
    const preset = getPreset("test-custom");
    assert.ok(preset);
    assert.equal(preset.name, "test-custom");
  });
});
