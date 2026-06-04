import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDesignSystemMcpToProjectDocs,
  mergeMarkdownSectionByHeading,
  MCP_DESIGN_SYSTEM_SECTION_HEADING,
  preserveImportedDesignSystemInMdd,
  resolveDesignSystemDocSyncTarget,
} from "./sync-design-system-doc-section.util.js";

describe("sync-design-system-doc-section", () => {
  it("prioriza MDD cuando hay contenido sustancial", () => {
    assert.equal(
      resolveDesignSystemDocSyncTarget("x".repeat(500), "brd corto"),
      "mdd",
    );
  });

  it("usa BRD en fase 0 sin MDD sustancial", () => {
    assert.equal(
      resolveDesignSystemDocSyncTarget("", "x".repeat(300)),
      "brd",
    );
  });

  it("reemplaza solo la sección MCP en MDD", () => {
    const mdd = `## 1. Contexto\n\nTexto.\n\n## ${MCP_DESIGN_SYSTEM_SECTION_HEADING}\n\nViejo.\n\n## 3. Modelo\n\nDatos.`;
    const section = `## ${MCP_DESIGN_SYSTEM_SECTION_HEADING}\n\nNuevo desde MCP.`;
    const merged = mergeMarkdownSectionByHeading(mdd, section);
    assert.match(merged, /## 1\. Contexto/);
    assert.match(merged, /Nuevo desde MCP/);
    assert.doesNotMatch(merged, /Viejo\./);
    assert.match(merged, /## 3\. Modelo/);
  });

  it("applyDesignSystemMcpToProjectDocs actualiza solo brd si no hay mdd", () => {
    const brd = "## Pain Points\n\nProblema.\n";
    const result = applyDesignSystemMcpToProjectDocs({
      designMd: "---\nname: Test\ncolors:\n  primary: \"#182A4A\"\n---\n",
      mddContent: "",
      brdContent: brd,
      profileName: "Orbit",
    });
    assert.equal(result.target, "brd");
    assert.ok(result.brdContent?.includes(MCP_DESIGN_SYSTEM_SECTION_HEADING));
    assert.ok(result.brdContent?.includes("#182A4A"));
    assert.equal(result.mddContent, undefined);
  });

  it("preserveImportedDesignSystemInMdd inyecta si la guía MCP es válida", () => {
    const guide =
      "---\nname: Orbit\ncolors:\n  primary: \"#182A4A\"\n---\n\n## Overview\n\nDesign system importado desde Orbit MCP para el proyecto.";
    const newMdd = "## 1. MDD regenerado\n\nSin sección MCP.";
    const out = preserveImportedDesignSystemInMdd(newMdd, {
      designMd: guide,
      mddContent: newMdd,
      profileName: "Orbit",
    });
    assert.match(out, /MDD regenerado/);
    assert.match(out, /#182A4A/);
  });

  it("preserveImportedDesignSystemInMdd no inyecta si la guía no es válida (LLM define DS)", () => {
    const invalidGuide = "## Overview\n\nGuía sin YAML ni colores hex.";
    const newMdd = "## 1. MDD regenerado\n\n";
    const out = preserveImportedDesignSystemInMdd(newMdd, {
      designMd: invalidGuide,
      mddContent: newMdd,
    });
    assert.equal(out, newMdd);
  });
});
