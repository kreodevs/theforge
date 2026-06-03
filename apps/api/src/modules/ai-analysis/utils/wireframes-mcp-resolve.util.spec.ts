import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findBatchPreviewEntry,
  fuzzyMatchModuleInCatalog,
  normalizeComponentKey,
  normalizeHostedPreviewRow,
  parseCatalogPreviewCapabilities,
  parseComponentCodeText,
  parseHostedPreviewBatchText,
  parseProductionSnippetText,
  pickBestSearchHit,
  pickModuleIdForPreview,
  pickPreviewExportName,
  previewCacheKey,
  resolveComponentNamesToHits,
  sanitizePreviewSandbox,
  shouldFallbackFromProductionSnippet,
} from "./wireframes-mcp-resolve.util.js";

describe("wireframes-mcp-resolve", () => {
  const catalog = new Set(["button", "input", "table"]);

  it("pickModuleIdForPreview prefers resolve over invented table id", () => {
    const resolveMap = new Map([["Chart", "chart"]]);
    catalog.add("chart");
    const picked = pickModuleIdForPreview("Chart", "data/chart", resolveMap, catalog);
    assert.equal(picked.moduleId, "chart");
    assert.equal(picked.source, "resolve");
  });

  it("pickModuleIdForPreview trusts resolve when module not in catalog", () => {
    const resolveMap = new Map([["Menu", "menu-v2"]]);
    const picked = pickModuleIdForPreview("Menu", "navigation/menu", resolveMap, catalog);
    assert.equal(picked.moduleId, "menu-v2");
    assert.equal(picked.source, "resolve");
  });

  it("pickModuleIdForPreview ignores uncatalogued table id", () => {
    const picked = pickModuleIdForPreview("Menu", "navigation/menu", new Map(), catalog);
    assert.equal(picked.source, "none");
    assert.equal(picked.moduleId, "");
  });

  it("normalizeComponentKey collapses whitespace", () => {
    assert.equal(normalizeComponentKey("  Text   Input  "), "Text Input");
  });

  it("pickBestSearchHit finds catalogued module", () => {
    const searchJson = JSON.stringify({
      hits: [
        { id: "navigation/menu", name: "Menu" },
        { id: "menu", name: "Menu" },
      ],
    });
    catalog.add("menu");
    const hit = pickBestSearchHit("Menu", searchJson, catalog);
    assert.equal(hit, "menu");
  });

  it("parseProductionSnippetText detects standalone false", () => {
    const raw = JSON.stringify({
      moduleId: "table",
      standalone: false,
      message: "No standalone template available for Table.",
    });
    const { error } = parseProductionSnippetText(raw, "table");
    assert.match(error ?? "", /standalone/i);
  });

  it("parseComponentCodeText extracts code field", () => {
    const raw = JSON.stringify({ code: "function Table() { return null; }" });
    const { code } = parseComponentCodeText(raw, "table");
    assert.match(code, /function Table/);
  });

  it("shouldFallbackFromProductionSnippet for module not found", () => {
    assert.equal(shouldFallbackFromProductionSnippet("Module not found: x", ""), true);
  });

  it("parseCatalogPreviewCapabilities reads preview block", () => {
    const caps = parseCatalogPreviewCapabilities(
      JSON.stringify({
        preview: { supported: true, defaultMode: "html", modes: ["url", "html"] },
      }),
    );
    assert.equal(caps.supported, true);
    assert.equal(caps.defaultMode, "html");
  });

  it("parseCatalogPreviewCapabilities detects preview tools", () => {
    const caps = parseCatalogPreviewCapabilities(
      JSON.stringify({
        tools: { get_component_preview: true },
      }),
    );
    assert.equal(caps.supported, true);
  });

  it("normalizeHostedPreviewRow parses html preview", () => {
    const row = normalizeHostedPreviewRow({
      moduleId: "Button",
      preview: {
        kind: "html",
        document: "<!DOCTYPE html><html></html>",
        recommendedHeight: 120,
        sandbox: "allow-scripts",
      },
    });
    assert.equal(row.previewKind, "html");
    assert.match(row.document ?? "", /<!DOCTYPE html>/);
    assert.equal(row.recommendedHeight, 120);
  });

  it("pickPreviewExportName omits alias names like TextInput on Input", () => {
    assert.equal(
      pickPreviewExportName("TextInput", "Input", "TextInput", {
        moduleId: "Input",
        status: "alias",
      }),
      undefined,
    );
    assert.equal(pickPreviewExportName("Button", "Button", "Button"), "Button");
  });

  it("sanitizePreviewSandbox removes allow-same-origin for html", () => {
    assert.equal(sanitizePreviewSandbox("allow-scripts allow-same-origin"), "allow-scripts");
  });

  it("sanitizePreviewSandbox keeps allow-same-origin for trusted url preview", () => {
    assert.equal(
      sanitizePreviewSandbox("allow-scripts allow-same-origin", {
        previewKind: "url",
        previewUrl: "https://preview.example/page",
        trustedOrigins: ["https://preview.example"],
      }),
      "allow-scripts allow-same-origin",
    );
  });

  it("parseHostedPreviewBatchText maps results by cache key", () => {
    const batch = parseHostedPreviewBatchText(
      JSON.stringify({
        results: [
          {
            moduleId: "Button",
            exportName: "Button",
            preview: { kind: "html", document: "<html></html>" },
          },
        ],
      }),
    );
    assert.equal(batch.get(previewCacheKey("Button", "Button"))?.previewKind, "html");
  });

  it("findBatchPreviewEntry matches Input without requested exportName", () => {
    const batch = parseHostedPreviewBatchText(
      JSON.stringify({
        results: [
          {
            moduleId: "Input",
            exportName: "Input",
            preview: { kind: "html", document: "<html></html>" },
          },
        ],
      }),
    );
    const hit = findBatchPreviewEntry(batch, "Input", undefined);
    assert.equal(hit?.previewKind, "html");
  });

  it("fuzzyMatchModuleInCatalog matches exact and partial names", () => {
    const catalog = JSON.stringify({
      modules: [
        { id: "Button", name: "Button" },
        { id: "TextField", name: "Text Field" },
      ],
    });
    assert.equal(fuzzyMatchModuleInCatalog("Button", catalog)?.moduleId, "Button");
    assert.equal(fuzzyMatchModuleInCatalog("Text Field", catalog)?.moduleId, "TextField");
  });

  it("resolveComponentNamesToHits falls back to catalog.list when resolve missing", async () => {
    const catalog = JSON.stringify({ modules: [{ id: "Alert", name: "Alert" }] });
    const port = {
      capabilities: { catalog: { list: true } },
      listModules: async () => ({
        content: [{ type: "text", text: catalog }],
      }),
    } as unknown as import("@theforge/component-source").ComponentSourcePort;

    const hits = await resolveComponentNamesToHits(port, "user-1", ["Alert"]);
    assert.equal(hits.get("Alert")?.moduleId, "Alert");
  });
});
