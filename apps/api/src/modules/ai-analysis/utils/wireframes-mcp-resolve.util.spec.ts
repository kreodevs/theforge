import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  expandWireframeResolveQueries,
  findBatchPreviewEntry,
  fuzzyMatchModuleInCatalog,
  fuzzyMatchModuleWithAliases,
  getWireframeAliasCandidates,
  injectWireframeComponentTables,
  normalizeComponentKey,
  normalizeHostedPreviewRow,
  normalizeWireframeAliasKey,
  parseCatalogPreviewCapabilities,
  parseComponentCodeText,
  parseHostedPreviewBatchText,
  parseProductionSnippetText,
  pickBestSearchHit,
  pickBestSearchHitWithAliases,
  pickModuleIdForPreview,
  pickPreviewExportName,
  previewCacheKey,
  reconcileComponentMappings,
  resolveComponentNamesToHits,
  sanitizePreviewSandbox,
  shouldFallbackFromProductionSnippet,
  validateCatalogListText,
  wireframeNameToKebabModuleId,
  wireframeScreenIdSlug,
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

  it("validateCatalogListText accepts modules JSON with ids", () => {
    const result = validateCatalogListText(
      JSON.stringify({ modules: [{ id: "Button" }, { id: "Input" }] }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.moduleCount, 2);
  });

  it("validateCatalogListText rejects GitMCP plain-text documentation response", () => {
    const result = validateCatalogListText("No documentation found.");
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /fetch_ui_documentation|documentación/i);
  });

  it("validateCatalogListText accepts shadcn registry markdown", () => {
    const sample = `Found 414 items in registries @shadcn:

- button (registry:ui) [@shadcn]
- alert-dialog (registry:ui) [@shadcn]
- index (registry:style) [@shadcn]
`;
    const result = validateCatalogListText(sample);
    assert.equal(result.ok, true);
    assert.equal(result.moduleCount, 2);
  });

  it("fuzzyMatchModuleInCatalog matches shadcn kebab ids", () => {
    const sample = "- button (registry:ui) [@shadcn]\n- alert (registry:ui) [@shadcn]\n";
    assert.equal(fuzzyMatchModuleInCatalog("Button", sample)?.moduleId, "button");
    assert.equal(fuzzyMatchModuleInCatalog("Alert", sample)?.moduleId, "alert");
  });

  it("validateCatalogListText rejects JSON without module ids", () => {
    const result = validateCatalogListText(JSON.stringify({ fileUsed: "unknown" }));
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /ids de módulo/i);
  });

  it("validateCatalogListText accepts Magic UI listRegistryItems JSON (items[].name)", () => {
    const sample = JSON.stringify({
      total: 2,
      limit: 25,
      offset: 0,
      hasMore: false,
      items: [
        { name: "marquee", title: "Marquee", kind: "component" },
        { name: "bento-grid", title: "Bento Grid", kind: "component" },
      ],
    });
    const result = validateCatalogListText(sample);
    assert.equal(result.ok, true);
    assert.equal(result.moduleCount, 2);
    assert.equal(fuzzyMatchModuleInCatalog("Marquee", sample)?.moduleId, "marquee");
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

  describe("wireframe component aliases", () => {
    const shadcnCatalog = `- dialog (registry:ui) [@shadcn]
- alert-dialog (registry:ui) [@shadcn]
- calendar (registry:ui) [@shadcn]
- popover (registry:ui) [@shadcn]
- input (registry:ui) [@shadcn]
- table (registry:ui) [@shadcn]
- breadcrumb (registry:ui) [@shadcn]
- spinner (registry:ui) [@shadcn]
- alert (registry:ui) [@shadcn]
`;

    it("normalizeWireframeAliasKey is case-insensitive and strips separators", () => {
      assert.equal(normalizeWireframeAliasKey("DatePicker"), "datepicker");
      assert.equal(normalizeWireframeAliasKey("Text Input"), "textinput");
      assert.equal(normalizeWireframeAliasKey("data-table"), "datatable");
    });

    it("wireframeNameToKebabModuleId converts PascalCase", () => {
      assert.equal(wireframeNameToKebabModuleId("DatePicker"), "date-picker");
      assert.equal(wireframeNameToKebabModuleId("Alert"), "alert");
    });

    it("expandWireframeResolveQueries includes original, kebab, and aliases", () => {
      const modalQueries = expandWireframeResolveQueries("Modal");
      assert.ok(modalQueries.includes("Modal"));
      assert.ok(modalQueries.includes("dialog"));
      assert.ok(modalQueries.includes("alert-dialog"));

      const dateQueries = expandWireframeResolveQueries("DatePicker");
      assert.ok(dateQueries.includes("DatePicker"));
      assert.ok(dateQueries.includes("date-picker"));
      assert.ok(dateQueries.includes("calendar"));
    });

    it("getWireframeAliasCandidates returns ordered candidates", () => {
      assert.deepEqual(getWireframeAliasCandidates("DatePicker"), ["calendar", "popover"]);
      assert.deepEqual(getWireframeAliasCandidates("Illustration"), []);
    });

    it("fuzzyMatchModuleWithAliases maps Modal → dialog", () => {
      assert.equal(fuzzyMatchModuleWithAliases("Modal", shadcnCatalog)?.moduleId, "dialog");
    });

    it("fuzzyMatchModuleWithAliases maps DatePicker → calendar", () => {
      assert.equal(fuzzyMatchModuleWithAliases("DatePicker", shadcnCatalog)?.moduleId, "calendar");
    });

    it("fuzzyMatchModuleWithAliases maps TextInput → input", () => {
      assert.equal(fuzzyMatchModuleWithAliases("TextInput", shadcnCatalog)?.moduleId, "input");
    });

    it("fuzzyMatchModuleWithAliases maps DataTable → table", () => {
      assert.equal(fuzzyMatchModuleWithAliases("DataTable", shadcnCatalog)?.moduleId, "table");
    });

    it("fuzzyMatchModuleWithAliases maps Breadcrumbs → breadcrumb", () => {
      assert.equal(fuzzyMatchModuleWithAliases("Breadcrumbs", shadcnCatalog)?.moduleId, "breadcrumb");
    });

    it("fuzzyMatchModuleWithAliases resolves PascalCase Alert via kebab", () => {
      assert.equal(fuzzyMatchModuleWithAliases("Alert", shadcnCatalog)?.moduleId, "alert");
    });

    it("pickBestSearchHitWithAliases tries alias candidates", () => {
      const catalogIds = new Set(["dialog", "calendar", "input"]);
      const searchJson = JSON.stringify({
        hits: [{ id: "dialog", name: "Dialog" }],
      });
      assert.equal(pickBestSearchHitWithAliases("Modal", searchJson, catalogIds), "dialog");
    });

    it("resolveComponentNamesToHits maps aliases back to original name", async () => {
      const catalog = shadcnCatalog;
      const port = {
        capabilities: { catalog: { list: true } },
        listModules: async () => ({
          content: [{ type: "text", text: catalog }],
        }),
      } as unknown as import("@theforge/component-source").ComponentSourcePort;

      const hits = await resolveComponentNamesToHits(port, "user-1", ["Modal", "TextInput"]);
      assert.equal(hits.get("Modal")?.moduleId, "dialog");
      assert.equal(hits.get("TextInput")?.moduleId, "input");
    });
  });

  describe("injectWireframeComponentTables", () => {
    const modalMapping = {
      screenId: "crear-clave-maestra",
      requiredComponent: "Modal",
      mcpModuleId: "dialog",
      mcpExportName: "Dialog",
      mcpProps: null,
      compositionRecipe: null,
      matchConfidence: "exact" as const,
      fallbackSuggestion: null,
    };

    const baseMarkdown = `## Pantalla: Crear clave maestra
**ID**: \`create-master-key\`
**Descripción**: Pantalla de alta de clave maestra

### Wireframe
\`\`\`
┌──────────────┐
│   Modal      │
└──────────────┘
\`\`\`

### Componentes del Design System
| Componente requerido | Módulo DS | Export | Confianza | Props principales |
|---|---|---|---|---|
| Modal | — | — | none | — |

### Navegación
- → dashboard: Continuar
`;

    it("wireframeScreenIdSlug matches Spanish screen titles", () => {
      assert.equal(wireframeScreenIdSlug("Crear clave maestra"), "crear-clave-maestra");
    });

    it("replaces LLM table when markdown ID differs but title slug matches mapping screenId", () => {
      const result = injectWireframeComponentTables(baseMarkdown, [modalMapping]);
      assert.match(result, /\| Modal \| dialog \| Dialog \| exact \|/);
      assert.doesNotMatch(result, /\| Modal \| — \|/);
    });

    it("resolves mappings via analyzer screen name when IDs differ entirely", () => {
      const mapping = { ...modalMapping, screenId: "screen-analyzer-42" };
      const screens = [
        {
          id: "screen-analyzer-42",
          name: "Crear clave maestra",
          description: "",
          sourceUseCases: [],
          sourceUserStories: [],
          requiredComponents: ["Modal"],
          navigationFlow: [],
        },
      ];
      const result = injectWireframeComponentTables(baseMarkdown, [mapping], screens);
      assert.match(result, /\| Modal \| dialog \| Dialog \| exact \|/);
    });
  });

  describe("reconcileComponentMappings", () => {
    const shadcnCatalog = `- dialog (registry:ui) [@shadcn]
- input (registry:ui) [@shadcn]
- alert (registry:ui) [@shadcn]
`;

    const port = {
      capabilities: { catalog: { list: true } },
      listModules: async () => ({
        content: [{ type: "text", text: shadcnCatalog }],
      }),
    } as unknown as import("@theforge/component-source").ComponentSourcePort;

    it("upgrades none → exact when mcpModuleId is already in catalog", async () => {
      const reconciled = await reconcileComponentMappings(
        port,
        "user-1",
        [
          {
            screenId: "crear-clave-maestra",
            requiredComponent: "Modal",
            mcpModuleId: "dialog",
            mcpExportName: "Dialog",
            mcpProps: null,
            compositionRecipe: null,
            matchConfidence: "none",
            fallbackSuggestion: null,
          },
        ],
        shadcnCatalog,
      );
      assert.equal(reconciled[0]?.mcpModuleId, "dialog");
      assert.equal(reconciled[0]?.matchConfidence, "exact");
    });

    it("resolves Modal → dialog via alias when module id is missing", async () => {
      const reconciled = await reconcileComponentMappings(
        port,
        "user-1",
        [
          {
            screenId: "crear-clave-maestra",
            requiredComponent: "Modal",
            mcpModuleId: null,
            mcpExportName: null,
            mcpProps: null,
            compositionRecipe: null,
            matchConfidence: "none",
            fallbackSuggestion: null,
          },
        ],
        shadcnCatalog,
      );
      assert.equal(reconciled[0]?.mcpModuleId, "dialog");
      assert.equal(reconciled[0]?.matchConfidence, "exact");
    });
  });
});
