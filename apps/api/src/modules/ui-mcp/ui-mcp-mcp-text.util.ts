/**
 * @fileoverview Utilidades para parsear respuestas de tools MCP que devuelven markdown + JSON embebido.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

/** Extrae el primer bloque JSON válido de un texto MCP (markdown o JSON puro). */
export function extractJsonFromMcpText(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    /* markdown u otro envoltorio */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

/** Nombres de componente en tablas markdown de catálogo MCP (`| DataTable | composable | …`). */
export function parseCatalogTableComponentNames(markdown: string): string[] {
  const names = new Set<string>();
  for (const line of markdown.split("\n")) {
    if (line.includes("---")) continue;
    const m = line.match(/^\|\s*([A-Z][A-Za-z0-9]+)\s*\|\s*([a-z-]+)\s*\|/);
    if (m?.[1] && m[1] !== "Componente") names.add(m[1]);
  }
  return [...names];
}

/** @deprecated Usar `parseCatalogTableComponentNames`. */
export function parseKreoCatalogComponentNames(markdown: string): string[] {
  return parseCatalogTableComponentNames(markdown);
}
