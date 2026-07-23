import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import {
  NOTION_PORTABILITY_FORMAT,
  NOTION_PORTABILITY_VERSION,
  UI_PROJECT_JSON_MARKER,
} from "@theforge/shared-types";
import {
  parseNotionImportZip,
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

describe("parseNotionImportZip", () => {
  it("imports stage and project docs when ZIP has a named root folder", async () => {
    const projectExportId = "afd4984309274e3b8c08bd7f99af620c";
    const stageExportId = "3656276693644400be2d7b1899ce7a82";
    const root = "Copiloto IMJ";
    const stageFolder = `Etapa 1 — Etapa principal ${stageExportId}`;
    const zip = new JSZip();
    zip.file(
      `${root}/_theforge/manifest.json`,
      JSON.stringify({
        format: NOTION_PORTABILITY_FORMAT,
        version: NOTION_PORTABILITY_VERSION,
        exportedAt: "2026-07-23T17:39:21.873Z",
        projectName: "Copiloto IMJ",
        projectExportId,
        projectType: "NEW",
        options: { includeIntegration: true, includeSessions: false },
      }),
    );
    zip.file(
      `${root}/Etapas.csv`,
      [
        "exportId,ordinal,key,name,workflowStatus,status,precisionScore,isLegacy,linkedNewProjectExportId,handoffImportedAt",
        `${stageExportId},1,main,Etapa principal,ACTIVE,AMARILLO,93,false,,`,
        "",
      ].join("\n"),
    );
    zip.file(`${root}/Phase 0 Deep Research ${projectExportId}.md`, "# Phase 0 body\n");
    zip.file(`${root}/Benchmark ${projectExportId}.md`, "# Benchmark body\n");
    zip.file(`${root}/${stageFolder}/MDD ${stageExportId}.md`, "# Master Design Document\n");
    zip.file(`${root}/${stageFolder}/BRD ${stageExportId}.md`, "# BRD\n");
    zip.file(`${root}/${stageFolder}/Spec ${stageExportId}.md`, "# Spec\n");

    const bundle = await parseNotionImportZip(zip);
    assert.equal(bundle.stages.length, 1);
    assert.equal(bundle.stages[0]!.docs.mddContent, "# Master Design Document");
    assert.equal(bundle.stages[0]!.docs.brdContent, "# BRD");
    assert.equal(bundle.stages[0]!.docs.specContent, "# Spec");
    assert.equal(bundle.projectDocs.phase0SummaryContent, "# Phase 0 body");
    assert.equal(bundle.projectDocs.dbgaContent, "# Benchmark body");
  });
});

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
