/**
 * Slugs reales en design-extractor.com/gallery/{slug}
 * (algunos incluyen sufijo hash; ver sitemap/galería).
 */
export const DESIGN_EXTRACTOR_GALLERY_SLUGS = [
  "airbnb",
  "anthropic",
  "apple",
  "dribbble",
  "duolingo",
  "figma",
  "harvey-2cd5a19d5b",
  "ikea-ae3b91b472",
  "klarna",
  "lassie",
  "linear-638bvy",
  "lovable",
  "neon",
  "notion-3b6ysb",
  "paperclip",
  "paypal",
  "railway",
  "shopify",
  "snapchat",
  "stripe",
  "supabase",
  "theonion",
  "uber",
  "vercel",
  "wired",
  "x",
] as const;

export type DesignExtractorGallerySlug = (typeof DESIGN_EXTRACTOR_GALLERY_SLUGS)[number];

/** Slug del catálogo The Forge → slug URL en design-extractor. */
export const CATALOG_TO_GALLERY_SLUG: Record<string, string> = {
  "linear-app": "linear-638bvy",
  claude: "anthropic",
  "x-ai": "x",
  harvey: "harvey-2cd5a19d5b",
  ikea: "ikea-ae3b91b472",
  notion: "notion-3b6ysb",
  "the-onion": "theonion",
};

export function gallerySlugForCatalog(catalogSlug: string): string {
  return CATALOG_TO_GALLERY_SLUG[catalogSlug] ?? catalogSlug;
}

export function catalogSlugFromGallerySlug(gallerySlug: string): string {
  for (const [catalog, gallery] of Object.entries(CATALOG_TO_GALLERY_SLUG)) {
    if (gallery === gallerySlug) return catalog;
  }
  if (gallerySlug === "anthropic") return "claude";
  if (gallerySlug === "x") return "x-ai";
  if (gallerySlug === "linear-638bvy") return "linear-app";
  if (gallerySlug === "notion-3b6ysb") return "notion";
  if (gallerySlug === "harvey-2cd5a19d5b") return "harvey";
  if (gallerySlug === "ikea-ae3b91b472") return "ikea";
  if (gallerySlug === "theonion") return "the-onion";
  return gallerySlug;
}
