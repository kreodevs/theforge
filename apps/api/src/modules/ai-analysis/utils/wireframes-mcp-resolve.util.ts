import type { ComponentSourcePort, ComponentResolution, McpToolResult } from "@theforge/component-source";
import type { ComponentMapping } from "../state/index.js";

export function stripMarkdownCell(value: string): string {
  return value.trim().replace(/^[`*_]+|[`*_]+$/g, "").trim();
}

/** Normalizes component display names for resolve/map lookups (trim + collapse whitespace). */
export function normalizeComponentKey(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function lookupResolveModuleId(
  map: Map<string, string>,
  ...queries: Array<string | undefined>
): string | undefined {
  for (const q of queries) {
    if (!q?.trim()) continue;
    const trimmed = q.trim();
    const id =
      map.get(trimmed) ??
      map.get(normalizeComponentKey(trimmed)) ??
      map.get(normalizeComponentKey(trimmed).toLowerCase());
    if (id) return id;
  }
  return undefined;
}

/** Normalizes get_production_snippet MCP text → executable React source or error. */
export function parseProductionSnippetText(
  text: string,
  moduleIdHint?: string,
): { code: string; error?: string } {
  const trimmed = text.trim();
  const label = moduleIdHint ?? "módulo";

  if (!trimmed) {
    return { code: "", error: `Sin snippet para ${label}` };
  }

  if (!trimmed.startsWith("{")) {
    return { code: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    if (typeof parsed.error === "string") {
      return { code: "", error: parsed.error };
    }

    if (parsed.standalone === false) {
      const msg =
        typeof parsed.message === "string"
          ? parsed.message
          : `Sin plantilla standalone para ${String(parsed.moduleId ?? label)}`;
      return { code: "", error: msg };
    }

    if (typeof parsed.snippet === "string" && parsed.snippet.trim()) {
      return { code: parsed.snippet.trim() };
    }

    if (typeof parsed.code === "string" && parsed.code.trim()) {
      return { code: parsed.code.trim() };
    }

    return { code: "", error: `Respuesta MCP sin código ejecutable para ${label}` };
  } catch {
    return { code: trimmed };
  }
}

export function unwrapMcpToolText(result: McpToolResult): string {
  const isError = (result as unknown as Record<string, unknown>).isError === true;
  const texts =
    result.content?.filter((c) => c.type === "text" && c.text).map((c) => c.text) ?? [];
  const payload = texts.join("\n") || JSON.stringify(result);
  return isError ? `[MCP_ERROR] ${payload}` : payload;
}

/** Best-effort: module ids from list_modules JSON text. */
export function extractCatalogModuleIds(catalogText: string, max = 500): Set<string> {
  const ids = new Set<string>();
  if (!catalogText.trim()) return ids;

  try {
    const parsed = JSON.parse(catalogText) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { modules?: unknown }).modules)
        ? (parsed as { modules: unknown[] }).modules
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { hits?: unknown }).hits)
          ? (parsed as { hits: unknown[] }).hits
          : null;
    if (list) {
      for (const item of list) {
        if (item && typeof item === "object") {
          const id =
            (item as { id?: string; moduleId?: string }).id ??
            (item as { moduleId?: string }).moduleId;
          if (typeof id === "string" && id.trim()) ids.add(id.trim());
        }
        if (ids.size >= max) break;
      }
    }
  } catch {
    const re = /"id"\s*:\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(catalogText)) !== null && ids.size < max) {
      ids.add(m[1]);
    }
  }
  return ids;
}

export function parseResolveComponentsText(text: string): ComponentResolution[] {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[MCP_ERROR]")) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed as ComponentResolution[];
    if (parsed && typeof parsed === "object") {
      const results = (parsed as { results?: unknown }).results;
      if (Array.isArray(results)) return results as ComponentResolution[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function resolutionToModuleId(res: ComponentResolution): string | null {
  if (res.status === "not_found") return null;
  const id = res.moduleId?.trim();
  return id || null;
}

export type ComponentResolveHit = {
  moduleId: string;
  exportName?: string;
  status?: ComponentResolution["status"];
};

/** Batch resolve component names → moduleId + optional export from MCP. */
export async function resolveComponentNamesToHits(
  componentSource: ComponentSourcePort,
  userId: string,
  names: string[],
): Promise<Map<string, ComponentResolveHit>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const map = new Map<string, ComponentResolveHit>();
  if (unique.length === 0) return map;

  try {
    const result = await componentSource.resolveComponents(userId, unique);
    const text = unwrapMcpToolText(result);
    for (const res of parseResolveComponentsText(text)) {
      const moduleId = resolutionToModuleId(res);
      if (moduleId && res.query) {
        const key = normalizeComponentKey(res.query);
        const hit: ComponentResolveHit = {
          moduleId,
          exportName: res.exportName?.trim() || undefined,
          status: res.status,
        };
        map.set(key, hit);
        map.set(res.query.trim(), hit);
        map.set(key.toLowerCase(), hit);
      }
    }
  } catch {
    /* caller logs */
  }
  return map;
}

/**
 * Export for hosted preview: only when it exists on the module.
 * Aliases like TextInput→Input must omit exportName (MCP uses primary export).
 */
export function pickPreviewExportName(
  componentName: string,
  moduleId: string,
  tableExportName: string | undefined,
  resolveHit?: ComponentResolveHit,
): string | undefined {
  if (resolveHit?.exportName) return resolveHit.exportName;

  const mod = moduleId.trim();
  const name = componentName.trim();
  const tableExp = tableExportName?.trim();

  if (tableExp && tableExp === mod) return tableExp;
  if (name === mod) return mod;
  if (tableExp && tableExp === name && name === mod) return tableExp;

  return undefined;
}

/** Batch resolve component display names → real MCP moduleId. */
export async function resolveComponentNamesToModuleIds(
  componentSource: ComponentSourcePort,
  userId: string,
  names: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const hits = await resolveComponentNamesToHits(componentSource, userId, names);
  for (const [query, hit] of hits) {
    map.set(query, hit.moduleId);
  }
  return map;
}

export function pickModuleIdForPreview(
  componentName: string,
  tableModuleId: string,
  resolveMap: Map<string, string>,
  catalogIds: Set<string>,
  exportName?: string,
): { moduleId: string; source: "resolve" | "catalog" | "table" | "none" } {
  const queries = [componentName, exportName, stripMarkdownCell(tableModuleId)].filter(
    (q): q is string => !!q?.trim(),
  );

  const fromResolve = lookupResolveModuleId(resolveMap, ...queries);
  if (fromResolve) {
    return {
      moduleId: fromResolve,
      source: catalogIds.has(fromResolve) ? "resolve" : "resolve",
    };
  }

  const tableId = stripMarkdownCell(tableModuleId);
  if (tableId && catalogIds.has(tableId)) return { moduleId: tableId, source: "catalog" };

  return { moduleId: "", source: "none" };
}

export function parseSearchModulesHits(
  text: string,
): Array<{ id: string; name?: string }> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[MCP_ERROR]")) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { hits?: unknown }).hits)
        ? (parsed as { hits: unknown[] }).hits
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { modules?: unknown }).modules)
          ? (parsed as { modules: unknown[] }).modules
          : [];
    const hits: Array<{ id: string; name?: string }> = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const id =
        (item as { id?: string; moduleId?: string }).id ??
        (item as { moduleId?: string }).moduleId;
      if (typeof id === "string" && id.trim()) {
        hits.push({
          id: id.trim(),
          name: typeof (item as { name?: string }).name === "string" ? (item as { name: string }).name : undefined,
        });
      }
    }
    return hits;
  } catch {
    return [];
  }
}

/** Prefer exact name/id match, then first catalog hit. */
export function pickBestSearchHit(
  query: string,
  searchText: string,
  catalogIds: Set<string>,
): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const hits = parseSearchModulesHits(searchText);
  for (const hit of hits) {
    if (!catalogIds.has(hit.id)) continue;
    const name = (hit.name ?? "").toLowerCase();
    if (hit.id.toLowerCase() === q || name === q) return hit.id;
  }
  for (const hit of hits) {
    if (catalogIds.has(hit.id)) return hit.id;
  }
  return null;
}

/** Resolve moduleId for preview: resolve_components → catalog table → search_modules. */
export async function resolvePreviewModuleId(
  componentSource: ComponentSourcePort,
  userId: string,
  input: { componentName: string; tableModuleId: string; exportName?: string },
  resolveMap: Map<string, string>,
  catalogIds: Set<string>,
  searchCache: Map<string, string | null>,
): Promise<{ moduleId: string; exportName?: string; source: string }> {
  const { componentName, tableModuleId, exportName } = input;
  const picked = pickModuleIdForPreview(
    componentName,
    tableModuleId,
    resolveMap,
    catalogIds,
    exportName,
  );
  if (picked.moduleId && picked.source !== "none") {
    return { moduleId: picked.moduleId, exportName, source: picked.source };
  }

  const searchQueries = [
    componentName.trim(),
    exportName?.trim(),
    stripMarkdownCell(tableModuleId),
  ].filter((q, i, arr) => q && arr.indexOf(q) === i) as string[];

  for (const query of searchQueries) {
    if (searchCache.has(query)) {
      const cached = searchCache.get(query);
      if (cached) return { moduleId: cached, exportName, source: "search-cache" };
      continue;
    }
    try {
      const result = await componentSource.searchModules(userId, query);
      const hit = pickBestSearchHit(query, unwrapMcpToolText(result), catalogIds);
      searchCache.set(query, hit);
      if (hit) return { moduleId: hit, exportName, source: "search" };
    } catch {
      searchCache.set(query, null);
    }
  }

  return { moduleId: "", exportName, source: "none" };
}

/** Parses get_component MCP text → executable source. */
export function parseComponentCodeText(
  text: string,
  moduleIdHint?: string,
): { code: string; error?: string } {
  const trimmed = text.trim();
  const label = moduleIdHint ?? "módulo";

  if (!trimmed) {
    return { code: "", error: `Sin código para ${label}` };
  }

  if (trimmed.startsWith("[MCP_ERROR]")) {
    return { code: "", error: trimmed.replace(/^\[MCP_ERROR\]\s*/, "") };
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof parsed.error === "string") {
        return { code: "", error: parsed.error };
      }
      if (typeof parsed.code === "string" && parsed.code.trim()) {
        return { code: parsed.code.trim() };
      }
      if (typeof parsed.source === "string" && parsed.source.trim()) {
        return { code: parsed.source.trim() };
      }
    } catch {
      /* fall through */
    }
  }

  if (/module not found/i.test(trimmed)) {
    return { code: "", error: trimmed };
  }

  return { code: trimmed };
}

export type HostedPreviewKind = "html" | "url" | "unavailable" | "error";

export type HostedPreviewCacheEntry = {
  previewKind: HostedPreviewKind;
  document?: string;
  previewUrl?: string;
  recommendedHeight?: number;
  sandbox?: string;
  error?: string;
  fallback?: { kind: string; url?: string; screenshotUrl?: string };
};

const PREVIEW_BATCH_MAX = 40;

/** User-facing preview error (Spanish). */
export function formatPreviewError(message: string): string {
  const m = message.trim();
  if (/module not found/i.test(m)) {
    return "Módulo no encontrado en el catálogo MCP. Regenera wireframes o corrige el mapeo en la tabla DS.";
  }
  if (/export not found|export_not_found/i.test(m)) {
    return "Export no válido para ese módulo (p. ej. TextInput no es un export de Input).";
  }
  if (/no preview template|no_template|preview no disponible/i.test(m)) {
    return "Preview no disponible para este componente en el design system.";
  }
  if (/standalone/i.test(m) && /get_component/i.test(m)) {
    return "Sin plantilla standalone; no se pudo obtener código alternativo del MCP.";
  }
  if (/standalone/i.test(m)) {
    return "Componente compuesto sin preview standalone en el catálogo MCP.";
  }
  return m;
}

export function previewCacheKey(moduleId: string, exportName?: string): string {
  return `${moduleId}::${exportName?.trim() ?? ""}`;
}

/** Match batch row when request omitted exportName but MCP returns exportName=moduleId. */
export function findBatchPreviewEntry(
  batchMap: Map<string, HostedPreviewCacheEntry>,
  moduleId: string,
  exportName?: string,
): HostedPreviewCacheEntry | undefined {
  const mod = moduleId.trim();
  const candidates = [
    previewCacheKey(mod, exportName),
    previewCacheKey(mod, undefined),
    previewCacheKey(mod, mod),
    exportName?.trim() ? previewCacheKey(mod, exportName.trim()) : "",
  ].filter(Boolean);

  for (const key of candidates) {
    const hit = batchMap.get(key);
    if (hit) return hit;
  }

  const prefix = `${mod}::`;
  for (const [key, value] of batchMap) {
    if (key.startsWith(prefix)) return value;
  }
  return undefined;
}

/** Drop allow-same-origin unless url preview from a trusted plugin origin. */
export function isTrustedPreviewUrl(previewUrl: string, trustedOrigins: string[]): boolean {
  if (!previewUrl.trim() || trustedOrigins.length === 0) return false;
  try {
    const origin = new URL(previewUrl).origin;
    return trustedOrigins.some((t) => t === origin);
  } catch {
    return false;
  }
}

export function trustedOriginsFromComponentSourceUrl(mcpUrl?: string | null): string[] {
  const url = mcpUrl?.trim();
  if (!url) return [];
  try {
    return [new URL(url).origin];
  } catch {
    return [];
  }
}

export function sanitizePreviewSandbox(
  sandbox?: string,
  opts?: {
    previewKind?: HostedPreviewKind;
    previewUrl?: string;
    trustedOrigins?: string[];
  },
): string {
  const allowSameOrigin =
    opts?.previewKind === "url" &&
    opts.previewUrl &&
    isTrustedPreviewUrl(opts.previewUrl, opts.trustedOrigins ?? []);

  const tokens = (sandbox ?? "allow-scripts")
    .trim()
    .split(/\s+/)
    .filter((t) => t && (allowSameOrigin || t !== "allow-same-origin"));
  if (!tokens.includes("allow-scripts")) tokens.unshift("allow-scripts");
  return [...new Set(tokens)].join(" ");
}

export function parseCatalogPreviewCapabilities(healthText: string): {
  supported: boolean;
  defaultMode: "html" | "url";
} {
  const trimmed = healthText.trim();
  if (!trimmed || trimmed.startsWith("[MCP_ERROR]")) {
    return { supported: false, defaultMode: "html" };
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      preview?: {
        supported?: boolean;
        defaultMode?: string;
        modes?: unknown[];
      };
      tools?: Record<string, boolean>;
    };
    const preview = parsed.preview;
    const tools = parsed.tools;
    const hasPreviewTool =
      tools?.get_component_preview === true || tools?.get_component_previews === true;
    const modesSupported =
      Array.isArray(preview?.modes) &&
      preview.modes.some((m) => m === "html" || m === "url");
    const supported =
      preview?.supported === true || hasPreviewTool || modesSupported;
    return {
      supported,
      defaultMode: preview?.defaultMode === "url" ? "url" : "html",
    };
  } catch {
    return { supported: false, defaultMode: "html" };
  }
}

export function normalizeHostedPreviewRow(
  row: Record<string, unknown>,
  trustedOrigins: string[] = [],
): HostedPreviewCacheEntry {
  if (typeof row.error === "string") {
    const msg =
      typeof row.message === "string" ? `${row.error}: ${row.message}` : row.error;
    return { previewKind: "error", error: msg };
  }

  const preview = row.preview as Record<string, unknown> | undefined;
  if (!preview || typeof preview !== "object") {
    return { previewKind: "error", error: "Respuesta MCP sin preview" };
  }

  const kind = String(preview.kind ?? "");
  if (kind === "html") {
    const document = typeof preview.document === "string" ? preview.document : "";
    if (!document.trim()) {
      return { previewKind: "error", error: "Preview HTML vacío" };
    }
    return {
      previewKind: "html",
      document,
      recommendedHeight:
        typeof preview.recommendedHeight === "number" ? preview.recommendedHeight : 240,
      sandbox: sanitizePreviewSandbox(
        typeof preview.sandbox === "string" ? preview.sandbox : undefined,
        { previewKind: "html", trustedOrigins },
      ),
    };
  }

  if (kind === "url") {
    const url = typeof preview.url === "string" ? preview.url : "";
    if (!url.trim()) {
      return { previewKind: "error", error: "Preview URL vacía" };
    }
    return {
      previewKind: "url",
      previewUrl: url,
      recommendedHeight:
        typeof preview.recommendedHeight === "number" ? preview.recommendedHeight : 240,
      sandbox: sanitizePreviewSandbox(
        typeof preview.sandbox === "string" ? preview.sandbox : undefined,
        { previewKind: "url", previewUrl: url, trustedOrigins },
      ),
    };
  }

  if (kind === "unavailable") {
    const fallback = preview.fallback as Record<string, unknown> | undefined;
    return {
      previewKind: "unavailable",
      error:
        typeof preview.message === "string"
          ? preview.message
          : "Preview no disponible",
      fallback: fallback
        ? {
            kind: String(fallback.kind ?? "docs"),
            url: typeof fallback.url === "string" ? fallback.url : undefined,
            screenshotUrl:
              typeof fallback.screenshotUrl === "string" ? fallback.screenshotUrl : undefined,
          }
        : undefined,
    };
  }

  return { previewKind: "error", error: `Preview kind desconocido: ${kind}` };
}

export function parseHostedPreviewBatchText(
  text: string,
  trustedOrigins: string[] = [],
): Map<string, HostedPreviewCacheEntry> {
  const map = new Map<string, HostedPreviewCacheEntry>();
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[MCP_ERROR]")) {
    return map;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.error === "string") {
      const entry: HostedPreviewCacheEntry = {
        previewKind: "error",
        error:
          typeof parsed.message === "string"
            ? `${parsed.error}: ${parsed.message}`
            : parsed.error,
      };
      map.set("__batch__", entry);
      return map;
    }

    const results = Array.isArray(parsed.results) ? parsed.results : [];
    for (const item of results) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const moduleId = String(row.moduleId ?? "");
      const exportName = typeof row.exportName === "string" ? row.exportName : undefined;
      if (!moduleId) continue;
      const entry = normalizeHostedPreviewRow(row, trustedOrigins);
      const mod = moduleId.trim();
      const exp = exportName?.trim();
      map.set(previewCacheKey(mod, exp), entry);
      map.set(previewCacheKey(mod, undefined), entry);
      if (exp && exp !== mod) {
        map.set(previewCacheKey(mod, mod), entry);
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

export async function fetchHostedPreviewCapabilities(
  componentSource: ComponentSourcePort,
  userId: string,
): Promise<{ supported: boolean; defaultMode: "html" | "url" }> {
  try {
    const health = await componentSource.catalogHealth(userId);
    return parseCatalogPreviewCapabilities(unwrapMcpToolText(health));
  } catch {
    return { supported: false, defaultMode: "html" };
  }
}

/** Batch hosted previews from component source MCP (html by default). */
export async function fetchHostedPreviewsBatch(
  componentSource: ComponentSourcePort,
  userId: string,
  items: Array<{ moduleId: string; exportName?: string }>,
  mode: "html" | "url" = "html",
  trustedOrigins: string[] = [],
): Promise<Map<string, HostedPreviewCacheEntry>> {
  const cache = new Map<string, HostedPreviewCacheEntry>();
  if (items.length === 0) return cache;

  const unique = new Map<string, { moduleId: string; exportName?: string }>();
  for (const item of items) {
    if (!item.moduleId.trim()) continue;
    unique.set(previewCacheKey(item.moduleId, item.exportName), item);
  }

  const list = Array.from(unique.values());
  for (let i = 0; i < list.length; i += PREVIEW_BATCH_MAX) {
    const chunk = list.slice(i, i + PREVIEW_BATCH_MAX);
    try {
      const result = await componentSource.getComponentPreviews(userId, {
        items: chunk.map((c) => ({
          moduleId: c.moduleId,
          ...(c.exportName ? { exportName: c.exportName } : {}),
        })),
        mode,
        theme: "light",
      });
      const batchMap = parseHostedPreviewBatchText(unwrapMcpToolText(result), trustedOrigins);
      const batchErr = batchMap.get("__batch__");
      if (batchErr) {
        for (const item of chunk) {
          cache.set(previewCacheKey(item.moduleId, item.exportName), batchErr);
        }
        continue;
      }
      for (const item of chunk) {
        const key = previewCacheKey(item.moduleId, item.exportName);
        let entry = findBatchPreviewEntry(batchMap, item.moduleId, item.exportName) ?? {
          previewKind: "error" as const,
          error: "Sin resultado en batch",
        };
        if (
          entry.previewKind === "error" &&
          /export not found|export_not_found/i.test(entry.error ?? "")
        ) {
          const retryKey = previewCacheKey(item.moduleId, undefined);
          if (!item.exportName) {
            cache.set(key, entry);
            continue;
          }
          try {
            const single = await componentSource.getComponentPreview(userId, {
              moduleId: item.moduleId,
              mode,
              theme: "light",
            });
            const row = JSON.parse(unwrapMcpToolText(single)) as Record<string, unknown>;
            entry = normalizeHostedPreviewRow(row, trustedOrigins);
            cache.set(retryKey, entry);
            cache.set(key, entry);
            continue;
          } catch {
            /* keep original error */
          }
        }
        cache.set(key, entry);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const item of chunk) {
        try {
          const single = await componentSource.getComponentPreview(userId, {
            moduleId: item.moduleId,
            exportName: item.exportName,
            mode,
            theme: "light",
          });
          const row = JSON.parse(unwrapMcpToolText(single)) as Record<string, unknown>;
          cache.set(previewCacheKey(item.moduleId, item.exportName), normalizeHostedPreviewRow(row, trustedOrigins));
        } catch (singleErr) {
          cache.set(previewCacheKey(item.moduleId, item.exportName), {
            previewKind: "error",
            error: singleErr instanceof Error ? singleErr.message : msg,
          });
        }
      }
    }
  }

  return cache;
}

export function shouldFallbackFromProductionSnippet(errorMsg: string | undefined, rawText: string): boolean {
  const blob = `${errorMsg ?? ""} ${rawText}`.toLowerCase();
  return (
    blob.includes("standalone") ||
    blob.includes("module not found") ||
    blob.includes("get_component") ||
    rawText.startsWith("[MCP_ERROR]")
  );
}

/** get_production_snippet first; on missing/standalone → get_component. */
export async function fetchPreviewSnippet(
  componentSource: ComponentSourcePort,
  userId: string,
  moduleId: string,
  exportName?: string,
): Promise<{ snippet: string; error?: string }> {
  let rawProduction = "";
  try {
    const result = await componentSource.getProductionSnippet(userId, moduleId);
    rawProduction = unwrapMcpToolText(result);
    const { code, error: prodError } = parseProductionSnippetText(rawProduction, moduleId);
    if (code && !prodError) {
      return { snippet: code };
    }
    if (!shouldFallbackFromProductionSnippet(prodError, rawProduction)) {
      return { snippet: "", error: prodError ?? "Sin snippet de producción" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!shouldFallbackFromProductionSnippet(msg, rawProduction)) {
      return { snippet: "", error: msg };
    }
  }

  try {
    const compResult = await componentSource.getComponent(
      userId,
      moduleId,
      exportName?.trim() || undefined,
    );
    const compText = unwrapMcpToolText(compResult);
    const { code, error: compError } = parseComponentCodeText(compText, moduleId);
    if (code) {
      return { snippet: code };
    }
    const prodParsed = parseProductionSnippetText(rawProduction, moduleId);
    return {
      snippet: "",
      error: compError ?? prodParsed.error ?? "Sin código ejecutable",
    };
  } catch (err) {
    const prodParsed = parseProductionSnippetText(rawProduction, moduleId);
    return {
      snippet: "",
      error: prodParsed.error ?? (err instanceof Error ? err.message : String(err)),
    };
  }
}

function formatPropsCell(props: unknown): string {
  if (props == null) return "—";
  if (typeof props === "string") return props || "—";
  try {
    return JSON.stringify(props);
  } catch {
    return "—";
  }
}

function buildDsTableMarkdown(mappings: ComponentMapping[]): string {
  const lines = [
    "### Componentes del Design System",
    "| Componente requerido | Módulo DS | Export | Confianza | Props principales |",
    "|---|---|---|---|---|",
  ];
  for (const m of mappings) {
    const moduleId = m.mcpModuleId?.trim() || "—";
    const exportName = m.mcpExportName?.trim() || "—";
    const confidence = m.matchConfidence ?? "none";
    const props = formatPropsCell(m.mcpProps);
    lines.push(
      `| ${m.requiredComponent} | ${moduleId} | ${exportName} | ${confidence} | ${props} |`,
    );
  }
  return lines.join("\n");
}

/**
 * Replaces or inserts DS component tables from validated mappings (real MCP moduleIds).
 */
export function injectWireframeComponentTables(
  markdown: string,
  mappings: ComponentMapping[],
): string {
  if (!mappings.length) return markdown;

  const byScreenId = new Map<string, ComponentMapping[]>();
  for (const m of mappings) {
    const sid = m.screenId?.trim();
    if (!sid) continue;
    const list = byScreenId.get(sid) ?? [];
    list.push(m);
    byScreenId.set(sid, list);
  }

  const screenRegex = /^## Pantalla:\s*(.+)$/gm;
  const starts: number[] = [];
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = screenRegex.exec(markdown)) !== null) {
    starts.push(headerMatch.index);
  }
  if (starts.length === 0) return markdown;

  const out: string[] = [markdown.slice(0, starts[0])];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : markdown.length;
    let section = markdown.slice(start, end);
    const idMatch = section.match(/\*\*ID\*\*:\s*`([^`]+)`/);
    const screenId = idMatch?.[1]?.trim();
    const screenMappings = screenId ? byScreenId.get(screenId) : undefined;

    if (screenMappings?.length) {
      const tableBlock = buildDsTableMarkdown(screenMappings);
      const dsHeadingRe = /### Componentes del Design System[\s\S]*?(?=\n### |\n---\n|$)/;
      if (dsHeadingRe.test(section)) {
        section = section.replace(dsHeadingRe, tableBlock);
      } else {
        const navIdx = section.search(/\n### Navegaci[oó]n/);
        if (navIdx >= 0) {
          section = `${section.slice(0, navIdx)}\n${tableBlock}\n${section.slice(navIdx)}`;
        } else {
          section = `${section.trimEnd()}\n\n${tableBlock}\n`;
        }
      }
    }
    out.push(section);
  }
  return out.join("");
}

/** Align mapper output with catalog + resolve_components. */
export async function reconcileComponentMappings(
  componentSource: ComponentSourcePort,
  userId: string,
  mappings: ComponentMapping[],
  catalogText: string,
): Promise<ComponentMapping[]> {
  const catalogIds = extractCatalogModuleIds(catalogText);
  const names = mappings.map((m) => m.requiredComponent).filter(Boolean);
  const resolveMap = await resolveComponentNamesToModuleIds(componentSource, userId, names);

  return mappings.map((m) => {
    const name = normalizeComponentKey(m.requiredComponent);
    const resolved =
      lookupResolveModuleId(resolveMap, m.requiredComponent, name) ??
      resolveMap.get(name.toLowerCase());
    const current = m.mcpModuleId?.trim() ?? "";

    let mcpModuleId = current;
    let matchConfidence = m.matchConfidence;

    if (resolved) {
      mcpModuleId = resolved;
      if (matchConfidence === "none") matchConfidence = catalogIds.has(resolved) ? "exact" : "partial";
    } else if (current && !catalogIds.has(current)) {
      matchConfidence = "none";
      mcpModuleId = current;
    } else if (!current && !resolved) {
      matchConfidence = "none";
    }

    return { ...m, mcpModuleId: mcpModuleId || null, matchConfidence };
  });
}

/** Maps screenId → display name from wireframes markdown sections. */
export function parseScreenIdNameMap(markdown: string): Map<string, string> {
  const map = new Map<string, string>();
  const screenRegex = /^## Pantalla:\s*(.+)$/gm;
  const starts: number[] = [];
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = screenRegex.exec(markdown)) !== null) {
    starts.push(headerMatch.index);
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : markdown.length;
    const section = markdown.slice(start, end);
    const nameMatch = section.match(/^## Pantalla:\s*(.+)$/m);
    const idMatch = section.match(/\*\*ID\*\*:\s*`([^`]+)`/);
    const screenId = idMatch?.[1]?.trim();
    const screenName = stripMarkdownCell(nameMatch?.[1] ?? "");
    if (screenId && screenName) map.set(screenId, screenName);
  }
  return map;
}

/** Build preview component rows from persisted mapper JSON (fallback: markdown tables). */
export function buildScreenComponentMapFromMappings(
  markdown: string,
  mappings: ComponentMapping[],
): Array<{ screenName: string; components: Array<{ name: string; moduleId: string; exportName?: string }> }> {
  if (!mappings.length) return [];

  const idToName = parseScreenIdNameMap(markdown);
  const byScreen = new Map<string, ComponentMapping[]>();
  for (const m of mappings) {
    const sid = m.screenId?.trim();
    if (!sid) continue;
    const list = byScreen.get(sid) ?? [];
    list.push(m);
    byScreen.set(sid, list);
  }

  const result: Array<{
    screenName: string;
    components: Array<{ name: string; moduleId: string; exportName?: string }>;
  }> = [];

  for (const [screenId, screenMappings] of byScreen) {
    const screenName = idToName.get(screenId) ?? screenId;
    const components = screenMappings
      .filter((m) => m.matchConfidence !== "none" && m.mcpModuleId?.trim())
      .map((m) => ({
        name: m.requiredComponent.trim(),
        moduleId: m.mcpModuleId!.trim(),
        exportName: m.mcpExportName?.trim() || undefined,
      }));
    if (components.length > 0) {
      result.push({ screenName, components });
    }
  }

  return result;
}
