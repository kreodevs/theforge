import type { DesignReference } from "./data/design-references.js";
import { designExtractorImportPresent } from "./data/design-extractor-import.loader.js";

/** Texto corto reutilizable en API y UI. */
export const DESIGN_EXTRACTOR_ATTRIBUTION_NOTE =
  "Referencias visuales inspiradas en sistemas públicos curados en design-extractor.com. " +
  "The Forge adapta tokens al dominio del proyecto; no es copia ni producto oficial de esas marcas.";

export type DesignRefInspiration = {
  inspirationSource: "design-extractor" | "builtin";
  inspirationUrl?: string;
  attributionNote?: string;
  hasDesignMdImport: boolean;
};

export function designRefUsesDesignExtractor(ref: DesignReference): boolean {
  return (
    ref.source === "design-extractor" ||
    Boolean(ref.galleryUrl?.includes("design-extractor.com")) ||
    designExtractorImportPresent(ref.slug)
  );
}

export function getDesignRefInspiration(ref: DesignReference): DesignRefInspiration {
  const hasDesignMdImport = designExtractorImportPresent(ref.slug);
  const fromExtractor = designRefUsesDesignExtractor(ref);
  if (!fromExtractor) {
    return { inspirationSource: "builtin", hasDesignMdImport: false };
  }
  return {
    inspirationSource: "design-extractor",
    inspirationUrl: ref.galleryUrl,
    attributionNote: DESIGN_EXTRACTOR_ATTRIBUTION_NOTE,
    hasDesignMdImport,
  };
}
