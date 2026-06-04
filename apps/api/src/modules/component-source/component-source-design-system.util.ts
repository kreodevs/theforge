import type {
  ComponentSourcePort,
  DesignSystemMeta,
  DesignSystemResult,
  DesignSystemTokens,
  McpToolResult,
} from "@theforge/component-source";
import {
  formatDesignSystemTokens,
} from "../ai-analysis/utils/wireframe-design-system-context.util.js";
import { unwrapMcpToolText } from "../ai-analysis/utils/wireframes-mcp-resolve.util.js";

export type ComponentSourceDesignSystemPayload = {
  designMd: string;
  tokens?: DesignSystemTokens;
  meta?: DesignSystemMeta;
  /** Guía UX/UI persistida (mismo valor que designMd tras import). */
  uxUiGuideContent?: string;
  /** MDD actualizado solo en `## Design System (MCP)` si aplica. */
  mddContent?: string;
  /** BRD de etapa actualizado solo en esa sección si no hay MDD sustancial. */
  brdContent?: string;
  docSync?: {
    target: "mdd" | "brd";
    sectionHeading: string;
  };
};

export function parseDesignSystemMcpPayload(
  text: string,
  parsed?: DesignSystemResult,
): DesignSystemResult | undefined {
  if (parsed && typeof parsed === "object") {
    const err = (parsed as DesignSystemResult & { error?: string }).error;
    if (!err) return parsed;
  }

  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[MCP_ERROR]")) return undefined;

  try {
    const json = JSON.parse(trimmed) as DesignSystemResult & { error?: string };
    if (json && typeof json === "object") {
      if (json.error === "component_source_unavailable") return undefined;
      if (!json.error) return json;
    }
  } catch {
    /* plain markdown or non-JSON */
  }

  if (trimmed.startsWith("#") || trimmed.includes("---")) {
    return { designMd: trimmed } as DesignSystemResult;
  }

  return undefined;
}

function resolveDesignMd(parsed: DesignSystemResult, rawText: string): string | undefined {
  const fromField = parsed.designMd?.trim();
  if (fromField) return fromField;

  const formatted = formatDesignSystemTokens(parsed);
  if (formatted) return formatted;

  const fallback = rawText.trim();
  if (fallback && !fallback.startsWith("{") && !fallback.startsWith("[MCP_ERROR]")) {
    return fallback;
  }

  return undefined;
}

/** Fetches full design system markdown + tokens from the active component source MCP. */
export async function fetchFullDesignSystemFromPort(
  componentSource: ComponentSourcePort,
  userId: string,
): Promise<ComponentSourceDesignSystemPayload> {
  if (!componentSource.capabilities?.designSystem?.get) {
    throw new Error("designSystem.get no mapeado en el perfil de componentes");
  }

  const result: McpToolResult<DesignSystemResult> = await componentSource.getDesignSystem(userId, {
    format: "full",
    includeMarkdown: true,
  });
  const text = unwrapMcpToolText(result);

  if (text.startsWith("[MCP_ERROR]")) {
    throw new Error(text.replace(/^\[MCP_ERROR\]\s*/, "").trim() || "MCP error");
  }

  try {
    const json = JSON.parse(text.trim()) as { error?: string; message?: string };
    if (json?.error === "component_source_unavailable") {
      throw new Error(json.message ?? "Fuente de componentes no configurada");
    }
  } catch (parseErr) {
    if (parseErr instanceof Error && parseErr.message.includes("Fuente de componentes")) {
      throw parseErr;
    }
    /* not JSON error envelope */
  }

  const parsed = parseDesignSystemMcpPayload(text, result._parsed);
  if (!parsed) {
    throw new Error("La fuente de componentes no devolvió un design system válido");
  }

  const designMd = resolveDesignMd(parsed, text);
  if (!designMd?.trim()) {
    throw new Error("La fuente de componentes no devolvió markdown de design system");
  }

  return {
    designMd: designMd.trim(),
    tokens: parsed.tokens,
    meta: parsed.meta,
  };
}
