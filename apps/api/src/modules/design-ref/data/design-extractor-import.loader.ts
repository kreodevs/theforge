import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gallerySlugForCatalog } from "./design-extractor-slugs.js";
const IMPORTS_DIR = join(__dirname, "design-extractor-imports");
/** En build Nest: assets → dist/modules/design-ref/data/design-extractor-imports */
const IMPORTS_DIR_DIST = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "modules",
  "design-ref",
  "data",
  "design-extractor-imports",
);

/** Tope prudente para inyectar DESIGN.md completo en el prompt LLM. */
export const DESIGN_EXTRACTOR_IMPORT_MAX_CHARS = 18_000;

let importCache = new Map<string, string | null>();

export function resetDesignExtractorImportCache(): void {
  importCache = new Map();
}

function importPathForGallerySlug(gallerySlug: string): string | null {
  const filename = `${gallerySlug}.md`;
  for (const dir of [IMPORTS_DIR, IMPORTS_DIR_DIST]) {
    const path = join(dir, filename);
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * Lee DESIGN.md importado desde design-extractor (sync script).
 * @param catalogSlug slug del catálogo The Forge (ej. linear-app, claude)
 */
export function loadDesignExtractorImport(catalogSlug: string): string | null {
  const gallerySlug = gallerySlugForCatalog(catalogSlug);
  if (importCache.has(gallerySlug)) {
    return importCache.get(gallerySlug) ?? null;
  }
  const path = importPathForGallerySlug(gallerySlug);
  if (!path) {
    importCache.set(gallerySlug, null);
    return null;
  }
  try {
    const raw = readFileSync(path, "utf8").trim();
    importCache.set(gallerySlug, raw.length > 0 ? raw : null);
    return raw.length > 0 ? raw : null;
  } catch {
    importCache.set(gallerySlug, null);
    return null;
  }
}

export function formatDesignExtractorImportBlock(
  catalogSlug: string,
  mode: "explicit" | "auto-matched",
): string | null {
  const full = loadDesignExtractorImport(catalogSlug);
  if (!full) return null;

  const truncated =
    full.length > DESIGN_EXTRACTOR_IMPORT_MAX_CHARS
      ? `${full.slice(0, DESIGN_EXTRACTOR_IMPORT_MAX_CHARS)}\n\n… [DESIGN.md truncado por límite de contexto; ver galería design-extractor]`
      : full;

  return (
    `\n\n### DESIGN.md importado (design-extractor.com · modo ${mode})\n\n` +
    `Usa este documento como **base canónica de tokens** (YAML + secciones). Adapta nombres al dominio del proyecto; conserva hex y escala tipográfica salvo conflicto con WCAG.\n\n` +
    truncated
  );
}

export function designExtractorImportPresent(catalogSlug: string): boolean {
  return loadDesignExtractorImport(catalogSlug) !== null;
}
