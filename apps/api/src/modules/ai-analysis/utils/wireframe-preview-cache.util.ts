import { createHash } from "node:crypto";
import { contentDigestHash } from "./wireframe-screen-sketch.util.js";

export type WireframesPreviewCacheComponent = {
  name: string;
  moduleId: string;
  previewKind: "html" | "url" | "unavailable" | "error" | "legacy";
  document?: string;
  previewUrl?: string;
  recommendedHeight?: number;
  sandbox?: string;
  snippet?: string;
  error?: string;
  fallback?: { kind: string; url?: string; screenshotUrl?: string };
};

export type WireframesPreviewCacheScreen = {
  screenName: string;
  components: WireframesPreviewCacheComponent[];
};

export type WireframesPreviewCachePayloadV1 = {
  v: 1;
  wireframesHash: string;
  mcpKey: string;
  screens: WireframesPreviewCacheScreen[];
};

export function previewCacheMcpKey(componentMcpUrl: string | null | undefined): string {
  const url = componentMcpUrl?.trim() ?? "";
  if (!url) return "no-mcp";
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/** Clave MCP fija: preview de pantallas sin HTML embebido del plugin (solo bocetos IA). */
export const WIREFRAMES_PREVIEW_SKETCH_ONLY_MCP_KEY = "sketch-only-v2";

export function wireframesPreviewCacheKeys(
  markdown: string,
  _componentMcpUrl?: string | null,
): { wireframesHash: string; mcpKey: string } {
  return {
    wireframesHash: contentDigestHash(markdown),
    mcpKey: WIREFRAMES_PREVIEW_SKETCH_ONLY_MCP_KEY,
  };
}

export function readWireframesPreviewCacheV1(
  raw: unknown | null,
): WireframesPreviewCachePayloadV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.wireframesHash !== "string" || typeof o.mcpKey !== "string") return null;
  if (!Array.isArray(o.screens)) return null;
  const screens: WireframesPreviewCacheScreen[] = [];
  for (const item of o.screens) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    if (typeof s.screenName !== "string" || !Array.isArray(s.components)) continue;
    screens.push({
      screenName: s.screenName,
      components: s.components as WireframesPreviewCacheComponent[],
    });
  }
  if (screens.length === 0) return null;
  return {
    v: 1,
    wireframesHash: o.wireframesHash,
    mcpKey: o.mcpKey,
    screens,
  };
}

export function isWireframesPreviewCacheValid(
  cache: WireframesPreviewCachePayloadV1 | null,
  wireframesHash: string,
  mcpKey: string,
): cache is WireframesPreviewCachePayloadV1 {
  return (
    cache != null &&
    cache.wireframesHash === wireframesHash &&
    cache.mcpKey === mcpKey &&
    cache.screens.length > 0
  );
}

export function buildWireframesPreviewCachePayload(
  wireframesHash: string,
  mcpKey: string,
  screens: WireframesPreviewCacheScreen[],
): WireframesPreviewCachePayloadV1 {
  return { v: 1, wireframesHash, mcpKey, screens };
}
