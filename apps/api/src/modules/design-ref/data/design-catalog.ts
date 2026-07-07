import {
  DESIGN_REFERENCES,
  getBuiltinDesignReferences,
  matchDesignByDomain as matchBuiltinByDomain,
  type DesignReference,
} from "./design-references.js";
import { DESIGN_EXTRACTOR_GALLERY, enrichBuiltinWithGalleryUrls } from "./design-extractor-gallery.js";
import { getDesignRefInspiration } from "../design-ref-inspiration.util.js";

let mergedCache: DesignReference[] | null = null;

/** Catálogo unificado: builtin + design-extractor (P1). Builtin gana en colisión de slug. */
export function getMergedDesignReferences(): DesignReference[] {
  if (mergedCache) return mergedCache;
  const builtinSlugs = new Set(DESIGN_REFERENCES.map((r) => r.slug));
  const enrichedBuiltin = getBuiltinDesignReferences().map(enrichBuiltinWithGalleryUrls);
  const extra = DESIGN_EXTRACTOR_GALLERY.filter((g) => !builtinSlugs.has(g.slug));
  mergedCache = [...enrichedBuiltin, ...extra];
  return mergedCache;
}

export function getDesignBySlugFromCatalog(slug: string): DesignReference | undefined {
  return getMergedDesignReferences().find((r) => r.slug === slug);
}

export function matchDesignByDomainMerged(mddContext: string): DesignReference[] {
  const ctx = mddContext.toLowerCase();
  const scores: { ref: DesignReference; score: number }[] = [];
  const builtinMatches = matchBuiltinByDomain(mddContext);
  const scoreBySlug = new Map<string, number>();
  for (const ref of builtinMatches) {
    scoreBySlug.set(ref.slug, (scoreBySlug.get(ref.slug) ?? 0) + 2);
  }
  for (const ref of getMergedDesignReferences()) {
    for (const tag of ref.tags) {
      if (tag.length >= 4 && ctx.includes(tag.toLowerCase())) {
        scoreBySlug.set(ref.slug, (scoreBySlug.get(ref.slug) ?? 0) + 1);
      }
    }
  }
  for (const [slug, score] of scoreBySlug) {
    const ref = getDesignBySlugFromCatalog(slug);
    if (ref) scores.push({ ref, score });
  }
  return scores.sort((a, b) => b.score - a.score).map((s) => s.ref).slice(0, 5);
}

export function getDesignReferenceListMerged() {
  return getMergedDesignReferences().map((ref) => {
    const inspiration = getDesignRefInspiration(ref);
    return {
      slug: ref.slug,
      name: ref.name,
      category: ref.category,
      style: ref.style,
      tags: ref.tags,
      source: ref.source ?? "builtin",
      galleryUrl: ref.galleryUrl,
      hasDesignMdImport: inspiration.hasDesignMdImport,
      inspirationSource: inspiration.inspirationSource,
      inspirationUrl: inspiration.inspirationUrl,
      attributionNote: inspiration.attributionNote,
      colors: {
        primary: ref.colors.primary,
        background: ref.colors.background,
        accent: ref.colors.accent,
      },
    };
  });
}

/** Limpia cache (tests). */
export function resetDesignCatalogCache(): void {
  mergedCache = null;
}
