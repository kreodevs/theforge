/**
 * Metadatos de la galería design-extractor.com (P1 — 26 sitios).
 * El DESIGN.md completo se importa con `scripts/sync-design-extractor-gallery.mjs`.
 *
 * @see https://www.design-extractor.com/gallery
 */
import type { DesignReference } from "./design-references.js";
import { gallerySlugForCatalog } from "./design-extractor-slugs.js";

function galleryUrlForCatalogSlug(catalogSlug: string): string {
  return `https://www.design-extractor.com/gallery/${gallerySlugForCatalog(catalogSlug)}`;
}

/**
 * Entradas adicionales desde design-extractor (sin duplicar slugs builtin).
 * Builtin enriquecido vía `enrichBuiltinWithGalleryUrls`.
 */
export const DESIGN_EXTRACTOR_GALLERY: DesignReference[] = [
  {
    slug: "dribbble",
    name: "Dribbble",
    category: "design-productivity",
    style: "Pink community brand, card grid, designer portfolio energy",
    tags: ["design", "community", "pink", "portfolio", "creative"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("dribbble"),
    colors: {
      primary: "#ea4c89",
      background: "#ffffff",
      text: "#0d0c22",
      textSecondary: "#9e9ea7",
    },
    fonts: { primary: "Mona Sans / system-ui" },
    description:
      "Rosa signature (#ea4c89), grid de shots y cards con hover lift. Comunidad creativa — útil para marketplaces visuales y showcases.",
  },
  {
    slug: "duolingo",
    name: "Duolingo",
    category: "enterprise-consumer",
    style: "Bright green gamified UI, rounded shapes, playful motion",
    tags: ["green", "gamification", "education", "consumer", "playful"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("duolingo"),
    colors: {
      primary: "#58cc02",
      accent: "#1cb0f6",
      background: "#ffffff",
      text: "#4b4b4b",
    },
    fonts: { primary: "DIN Round / Nunito" },
    description:
      "Verde brillante gamificado, formas redondeadas y feedback inmediato. Ideal para onboarding y apps consumer con progreso.",
  },
  {
    slug: "harvey",
    name: "Harvey",
    category: "ai-ml",
    style: "Editorial serif on warm ivory, legal AI premium",
    tags: ["ai", "editorial", "serif", "premium", "legal"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("harvey"),
    colors: {
      primary: "#141413",
      background: "#faf9f5",
      surface: "#f5f4ef",
      text: "#141413",
      textSecondary: "#6b6b6b",
    },
    fonts: { primary: "Harvey Serif / Harvey Sans" },
    description:
      "Identidad editorial premium: serif display sobre ivory cálido. Autoridad y restricción — dashboards profesionales con datos densos.",
  },
  {
    slug: "ikea",
    name: "IKEA",
    category: "enterprise-consumer",
    style: "Swedish blue and yellow, catalog clarity, accessible retail",
    tags: ["retail", "blue", "yellow", "catalog", "accessible"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("ikea"),
    colors: {
      primary: "#0058a3",
      accent: "#ffdb00",
      background: "#ffffff",
      text: "#111111",
    },
    fonts: { primary: "Noto IKEA / Verdana" },
    description:
      "Azul IKEA (#0058a3) con acento amarillo. Jerarquía clara de catálogo, grids de producto y navegación accesible.",
  },
  {
    slug: "klarna",
    name: "Klarna",
    category: "fintech",
    style: "Dark navy primary with signature pink accent, rounded fintech UI",
    tags: ["fintech", "finance", "pink", "dark", "consumer"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("klarna"),
    colors: {
      primary: "#0b051d",
      accent: "#ffa8cd",
      background: "#ffffff",
      text: "#0b051d",
      textSecondary: "#6b7280",
    },
    fonts: { primary: "Klarna Sans / system-ui" },
    description:
      "Navy profundo (#0b051d) con rosa signature (#ffa8cd). Esquinas generosas (32px). Fintech consumer y pagos.",
  },
  {
    slug: "lassie",
    name: "Lassie",
    category: "enterprise-consumer",
    style: "Soft pet-insurance brand, friendly illustration, calm greens",
    tags: ["insurance", "pets", "friendly", "consumer", "green"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("lassie"),
    colors: {
      primary: "#2d6a4f",
      background: "#f8faf8",
      text: "#1a1a1a",
    },
    fonts: { primary: "Inter / system-ui" },
    description:
      "Marca pet-friendly con verdes suaves e ilustración. Confianza y calma — útil para seguros y servicios consumer.",
  },
  {
    slug: "neon",
    name: "Neon",
    category: "infra-cloud",
    style: "Dark developer console, neon green accent on charcoal",
    tags: ["postgres", "database", "developer", "dark", "green"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("neon"),
    colors: {
      primary: "#00E599",
      background: "#0a0a0a",
      surface: "#141414",
      text: "#ededed",
    },
    fonts: { primary: "Inter" },
    description:
      "Console oscuro con acento verde neón. Postgres serverless — patrones de dashboard técnico y métricas.",
  },
  {
    slug: "paperclip",
    name: "Paperclip",
    category: "ai-ml",
    style: "Minimal AI workspace, monochrome with subtle accent",
    tags: ["ai", "workspace", "minimal", "monochrome"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("paperclip"),
    colors: {
      primary: "#111111",
      background: "#fafafa",
      text: "#171717",
      textSecondary: "#737373",
    },
    fonts: { primary: "Inter" },
    description:
      "Workspace AI minimalista, tipografía neutra y densidad moderada. Productividad sin ruido visual.",
  },
  {
    slug: "paypal",
    name: "PayPal",
    category: "fintech",
    style: "Sky-blue hero, ultra-heavy display type, pill CTAs",
    tags: ["fintech", "payments", "blue", "consumer"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("paypal"),
    colors: {
      primary: "#60CDFF",
      accent: "#0070ba",
      background: "#ffffff",
      text: "#000000",
      textSecondary: "#4d4d4d",
    },
    fonts: { primary: "PayPal Pro / Inter" },
    description:
      "Hero azul cielo (#60CDFF) con tipografía display ultra-bold. CTAs pill. Pagos y wallets consumer.",
  },
  {
    slug: "railway",
    name: "Railway",
    category: "infra-cloud",
    style: "Purple deploy platform, dark UI, glass cards",
    tags: ["deploy", "cloud", "purple", "developer", "dark"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("railway"),
    colors: {
      primary: "#853bce",
      background: "#13111c",
      surface: "#1c1a27",
      text: "#ffffff",
    },
    fonts: { primary: "Inter" },
    description:
      "Plataforma deploy con púrpura (#853bce) sobre fondo oscuro. Cards glass y estados de servicio en tiempo real.",
  },
  {
    slug: "shopify",
    name: "Shopify",
    category: "enterprise-consumer",
    style: "Dark cinematic hero, mint-green accent, commerce-forward",
    tags: ["dark", "green", "commerce", "developer"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("shopify"),
    colors: {
      primary: "#36f4a4",
      background: "#02090a",
      surface: "#111111",
      text: "#ffffff",
      textSecondary: "#b3b3b3",
    },
    fonts: { primary: "Neue Haas Grotesk" },
    description:
      "Hero casi negro con acento mint (#36f4a4). Commerce y plataformas B2B2C.",
  },
  {
    slug: "snapchat",
    name: "Snapchat",
    category: "enterprise-consumer",
    style: "Yellow brand burst, bold type, mobile-first social",
    tags: ["yellow", "social", "mobile", "consumer", "bold"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("snapchat"),
    colors: {
      primary: "#fffc00",
      background: "#ffffff",
      text: "#000000",
    },
    fonts: { primary: "Avenir Next / Helvetica Neue" },
    description:
      "Amarillo signature (#fffc00), tipografía bold y UI mobile-first. Social consumer de alto contraste.",
  },
  {
    slug: "the-onion",
    name: "The Onion",
    category: "enterprise-consumer",
    style: "Satirical news, serif headlines, newspaper grid",
    tags: ["editorial", "news", "serif", "humor", "media"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("the-onion"),
    colors: {
      primary: "#000000",
      background: "#ffffff",
      text: "#111111",
      accent: "#c4122e",
    },
    fonts: { primary: "Helvetica Neue / Georgia" },
    description:
      "Grid periodístico con titulares serif y acento rojo. Editorial denso — referencia para medios y contenido.",
  },
  {
    slug: "wired",
    name: "WIRED",
    category: "enterprise-consumer",
    style: "Tech magazine, bold condensed type, high-contrast black",
    tags: ["magazine", "tech", "editorial", "bold", "media"],
    source: "design-extractor",
    galleryUrl: galleryUrlForCatalogSlug("wired"),
    colors: {
      primary: "#000000",
      background: "#ffffff",
      text: "#111111",
      accent: "#e63946",
    },
    fonts: { primary: "WIRED Sans / Georgia" },
    description:
      "Revista tech con tipografía condensada y alto contraste. Layout editorial para contenido largo.",
  },
];

/** Slugs de catálogo con página en design-extractor (builtin + gallery-only). */
const GALLERY_CATALOG_SLUGS = new Set([
  "airbnb",
  "apple",
  "claude",
  "dribbble",
  "duolingo",
  "figma",
  "harvey",
  "ikea",
  "klarna",
  "lassie",
  "linear-app",
  "lovable",
  "neon",
  "notion",
  "paperclip",
  "paypal",
  "railway",
  "shopify",
  "snapchat",
  "stripe",
  "supabase",
  "the-onion",
  "uber",
  "vercel",
  "wired",
  "x-ai",
]);

export function enrichBuiltinWithGalleryUrls(ref: DesignReference): DesignReference {
  if (!GALLERY_CATALOG_SLUGS.has(ref.slug)) return ref;
  return {
    ...ref,
    galleryUrl: ref.galleryUrl ?? galleryUrlForCatalogSlug(ref.slug),
  };
}
