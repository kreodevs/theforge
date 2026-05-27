import { describe, expect, it } from "vitest";
import {
  findBatchPreviewEntry,
  normalizeHostedPreviewRow,
  parseCatalogPreviewCapabilities,
  parseComponentCodeText,
  parseHostedPreviewBatchText,
  parseProductionSnippetText,
  pickBestSearchHit,
  pickModuleIdForPreview,
  pickPreviewExportName,
  previewCacheKey,
  sanitizePreviewSandbox,
  shouldFallbackFromProductionSnippet,
} from "./wireframes-mcp-resolve.util.js";

describe("wireframes-mcp-resolve", () => {
  const catalog = new Set(["button", "input", "table"]);

  it("pickModuleIdForPreview prefers resolve over invented table id", () => {
    const resolveMap = new Map([["Chart", "chart"]]);
    catalog.add("chart");
    const picked = pickModuleIdForPreview("Chart", "data/chart", resolveMap, catalog);
    expect(picked.moduleId).toBe("chart");
    expect(picked.source).toBe("resolve");
  });

  it("pickModuleIdForPreview ignores uncatalogued table id", () => {
    const picked = pickModuleIdForPreview("Menu", "navigation/menu", new Map(), catalog);
    expect(picked.source).toBe("none");
    expect(picked.moduleId).toBe("");
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
    expect(hit).toBe("menu");
  });

  it("parseProductionSnippetText detects standalone false", () => {
    const raw = JSON.stringify({
      moduleId: "table",
      standalone: false,
      message: "No standalone template available for Table.",
    });
    const { error } = parseProductionSnippetText(raw, "table");
    expect(error).toContain("standalone");
  });

  it("parseComponentCodeText extracts code field", () => {
    const raw = JSON.stringify({ code: "function Table() { return null; }" });
    const { code } = parseComponentCodeText(raw, "table");
    expect(code).toContain("function Table");
  });

  it("shouldFallbackFromProductionSnippet for module not found", () => {
    expect(shouldFallbackFromProductionSnippet("Module not found: x", "")).toBe(true);
  });

  it("parseCatalogPreviewCapabilities reads preview block", () => {
    const caps = parseCatalogPreviewCapabilities(
      JSON.stringify({
        preview: { supported: true, defaultMode: "html", modes: ["url", "html"] },
      }),
    );
    expect(caps.supported).toBe(true);
    expect(caps.defaultMode).toBe("html");
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
    expect(row.previewKind).toBe("html");
    expect(row.document).toContain("<!DOCTYPE html>");
    expect(row.recommendedHeight).toBe(120);
  });

  it("pickPreviewExportName omits alias names like TextInput on Input", () => {
    expect(
      pickPreviewExportName("TextInput", "Input", "TextInput", {
        moduleId: "Input",
        status: "alias",
      }),
    ).toBeUndefined();
    expect(pickPreviewExportName("Button", "Button", "Button")).toBe("Button");
  });

  it("sanitizePreviewSandbox removes allow-same-origin", () => {
    expect(sanitizePreviewSandbox("allow-scripts allow-same-origin")).toBe("allow-scripts");
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
    expect(batch.get(previewCacheKey("Button", "Button"))?.previewKind).toBe("html");
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
    expect(hit?.previewKind).toBe("html");
  });
});
