import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UI_PROJECT_JSON_MARKER } from "@theforge/shared-types";
import {
  resolveImportedUiScreensContent,
  type ParsedNotionImportStage,
} from "./project-notion-import.util.js";

function stage(overrides: Partial<ParsedNotionImportStage>): ParsedNotionImportStage {
  return {
    exportId: "a".repeat(32),
    ordinal: 1,
    key: "main",
    name: "Main",
    workflowStatus: "DRAFT",
    status: "ROJO",
    precisionScore: 0,
    isLegacy: false,
    linkedNewProjectExportId: null,
    handoffImportedAt: null,
    docs: {},
    assets: {},
    ...overrides,
  };
}

describe("resolveImportedUiScreensContent", () => {
  it("returns null when no Pantallas docs", () => {
    assert.equal(resolveImportedUiScreensContent([stage({})]), null);
  });

  it("prefers ACTIVE stage and rejoins ui-project.json", () => {
    const result = resolveImportedUiScreensContent([
      stage({
        ordinal: 1,
        workflowStatus: "DRAFT",
        docs: { uiScreensContent: "# Old" },
      }),
      stage({
        ordinal: 2,
        exportId: "b".repeat(32),
        workflowStatus: "ACTIVE",
        docs: { uiScreensContent: "# Pantallas\n" },
        assets: { "ui-project.json": { version: "1.0.0" } },
      }),
    ]);
    assert.ok(result);
    assert.match(result!, /^# Pantallas/);
    assert.ok(result!.includes(UI_PROJECT_JSON_MARKER));
    assert.ok(result!.includes('"version": "1.0.0"'));
  });

  it("falls back to highest ordinal when no ACTIVE", () => {
    const result = resolveImportedUiScreensContent([
      stage({ ordinal: 1, docs: { uiScreensContent: "# One" } }),
      stage({
        ordinal: 2,
        exportId: "b".repeat(32),
        docs: { uiScreensContent: "# Two" },
      }),
    ]);
    assert.equal(result, "# Two");
  });
});
