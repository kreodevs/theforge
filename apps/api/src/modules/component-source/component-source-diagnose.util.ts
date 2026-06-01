import type { ComponentSourcePort, DesignSystemResult } from "@theforge/component-source";
import {
  extractCatalogModuleIds,
  parseCatalogPreviewCapabilities,
  parseHostedPreviewBatchText,
  parseResolveComponentsText,
  unwrapMcpToolText,
} from "../ai-analysis/utils/wireframes-mcp-resolve.util.js";

const SAMPLE_RESOLVE_NAMES = ["Button", "Input", "Table", "Card"];

export type ComponentSourceDiagnosticReport = {
  listModules: {
    textLength: number;
    catalogIdCount: number;
    shape: "array" | "modules" | "hits" | "unknown" | "empty" | "error";
    sampleIds: string[];
  };
  resolveComponents: {
    textLength: number;
    resultCount: number;
    sample: Array<{ query: string; moduleId?: string; status?: string }>;
  };
  catalogHealth: {
    textLength: number;
    preview: ReturnType<typeof parseCatalogPreviewCapabilities>;
    previewBlock?: unknown;
    tools?: Record<string, boolean>;
  };
  getComponentPreviews: {
    skipped: boolean;
    reason?: string;
    textLength?: number;
    resultCount?: number;
    sampleKinds?: string[];
  };
  getDesignSystem: {
    skipped: boolean;
    reason?: string;
    tokenKeyCount?: number;
    hasDesignMd?: boolean;
    cssVarCount?: number;
    metaVersion?: string;
  };
};

function detectListModulesShape(text: string): ComponentSourceDiagnosticReport["listModules"]["shape"] {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[MCP_ERROR]")) return trimmed ? "error" : "empty";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return "array";
    if (parsed && typeof parsed === "object") {
      if (Array.isArray((parsed as { modules?: unknown }).modules)) return "modules";
      if (Array.isArray((parsed as { hits?: unknown }).hits)) return "hits";
    }
  } catch {
    /* ignore */
  }
  return "unknown";
}

function countTokenKeys(tokens: DesignSystemResult["tokens"] | undefined): number {
  if (!tokens) return 0;
  let count = 0;
  const walk = (value: unknown): void => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        count++;
        walk(nested);
      }
    }
  };
  walk(tokens);
  return count;
}

function parseDesignSystemFromMcp(
  text: string,
  parsed?: DesignSystemResult,
): DesignSystemResult | undefined {
  if (parsed && typeof parsed === "object") return parsed;
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[MCP_ERROR]")) return undefined;
  try {
    const json = JSON.parse(trimmed) as DesignSystemResult & { error?: string };
    if (json && typeof json === "object" && !json.error) return json;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Dev-only diagnostic: list_modules, resolve_components, catalog_health, get_component_previews shapes. */
export async function runComponentSourceDiagnostic(
  source: ComponentSourcePort,
  userId: string,
): Promise<ComponentSourceDiagnosticReport> {
  const report: ComponentSourceDiagnosticReport = {
    listModules: { textLength: 0, catalogIdCount: 0, shape: "empty", sampleIds: [] },
    resolveComponents: { textLength: 0, resultCount: 0, sample: [] },
    catalogHealth: { textLength: 0, preview: { supported: false, defaultMode: "html" } },
    getComponentPreviews: { skipped: true, reason: "no sample moduleId" },
    getDesignSystem: { skipped: true, reason: "pending" },
  };

  let listText = "";
  try {
    const listResult = await source.listModules(userId);
    listText = unwrapMcpToolText(listResult);
    const ids = extractCatalogModuleIds(listText);
    report.listModules = {
      textLength: listText.length,
      catalogIdCount: ids.size,
      shape: detectListModulesShape(listText),
      sampleIds: [...ids].slice(0, 8),
    };
  } catch (err) {
    report.listModules.shape = "error";
    report.listModules.sampleIds = [
      err instanceof Error ? err.message.slice(0, 120) : String(err),
    ];
  }

  try {
    const resolveResult = await source.resolveComponents(userId, SAMPLE_RESOLVE_NAMES);
    const resolveText = unwrapMcpToolText(resolveResult);
    const results = parseResolveComponentsText(resolveText);
    report.resolveComponents = {
      textLength: resolveText.length,
      resultCount: results.length,
      sample: results.slice(0, 6).map((r) => ({
        query: r.query,
        moduleId: r.moduleId,
        status: r.status,
      })),
    };
  } catch (err) {
    report.resolveComponents.sample = [
      { query: "error", moduleId: err instanceof Error ? err.message.slice(0, 120) : String(err) },
    ];
  }

  let healthText = "";
  try {
    const healthResult = await source.catalogHealth(userId);
    healthText = unwrapMcpToolText(healthResult);
    report.catalogHealth.textLength = healthText.length;
    report.catalogHealth.preview = parseCatalogPreviewCapabilities(healthText);
    try {
      const parsed = JSON.parse(healthText) as {
        preview?: unknown;
        tools?: Record<string, boolean>;
      };
      report.catalogHealth.previewBlock = parsed.preview;
      report.catalogHealth.tools = parsed.tools;
    } catch {
      /* ignore */
    }
  } catch (err) {
    report.catalogHealth.textLength = 0;
    report.catalogHealth.previewBlock = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const sampleModuleId =
    report.resolveComponents.sample.find((r) => r.moduleId?.trim())?.moduleId?.trim() ??
    report.listModules.sampleIds[0]?.trim();

  if (!sampleModuleId) {
    report.getComponentPreviews = { skipped: true, reason: "no sample moduleId from list/resolve" };
  } else {
    try {
      const previewResult = await source.getComponentPreviews(userId, {
        items: [{ moduleId: sampleModuleId }],
        mode: report.catalogHealth.preview.defaultMode,
        theme: "light",
      });
      const previewText = unwrapMcpToolText(previewResult);
      const batch = parseHostedPreviewBatchText(previewText);
      const kinds = [...batch.values()].map((e) => e.previewKind);
      report.getComponentPreviews = {
        skipped: false,
        textLength: previewText.length,
        resultCount: batch.size,
        sampleKinds: kinds.slice(0, 4),
      };
    } catch (err) {
      report.getComponentPreviews = {
        skipped: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const dsPort = source;
  try {
    const dsResult = await dsPort.getDesignSystem(userId, {
      format: "context",
      includeMarkdown: true,
    });
    const dsText = unwrapMcpToolText(dsResult);
    const dsParsed = parseDesignSystemFromMcp(dsText, dsResult._parsed);
    report.getDesignSystem = {
      skipped: false,
      tokenKeyCount: countTokenKeys(dsParsed?.tokens),
      hasDesignMd: !!dsParsed?.designMd?.trim(),
      cssVarCount: dsParsed?.cssVars ? Object.keys(dsParsed.cssVars).length : 0,
      metaVersion: dsParsed?.meta?.version,
    };
  } catch (err) {
    report.getDesignSystem = {
      skipped: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  return report;
}
