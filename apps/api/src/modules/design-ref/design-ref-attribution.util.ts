import { getDesignBySlugFromCatalog } from "./data/design-catalog.js";
import { designRefUsesDesignExtractor } from "./design-ref-inspiration.util.js";
import { resolveUxGuideDesignRef, type ResolvedUxGuideDesignRef } from "./ux-guide-design-ref.util.js";

/**
 * Pie de atribución para el markdown de Guía UX/UI (idempotente).
 */
export function formatUxGuideAttributionFooter(resolved: ResolvedUxGuideDesignRef): string | null {
  if (!resolved.effectiveSlug) return null;
  const ref = getDesignBySlugFromCatalog(resolved.effectiveSlug);
  if (!ref || !designRefUsesDesignExtractor(ref)) return null;

  const galleryLink = ref.galleryUrl
    ? `[${ref.name}](${ref.galleryUrl})`
    : ref.name;
  const modeLabel =
    resolved.mode === "auto-matched"
      ? "auto-match por dominio del MDD"
      : resolved.mode === "explicit"
        ? "referencia explícita del proyecto"
        : "referencia visual";

  return (
    `## Atribución\n\n` +
    `Referencia visual **inspirada en** ${galleryLink} (tokens curados vía [Design Extractor](https://www.design-extractor.com/gallery), modo: ${modeLabel}).\n\n` +
    `El Design System de este proyecto fue **adaptado por The Forge** al dominio del MDD. ` +
    `No está avalado ni es producto oficial de la marca citada. Las marcas pertenecen a sus titulares.`
  );
}

/** Añade atribución al final del documento si aplica y aún no existe. */
export function appendUxGuideDesignAttribution(
  content: string,
  storedRef: string | null | undefined,
  mddContext: string,
): string {
  const trimmed = content.trim();
  if (!trimmed || trimmed.includes("## Atribución")) return content;

  const resolved = resolveUxGuideDesignRef(storedRef, mddContext);
  const footer = formatUxGuideAttributionFooter(resolved);
  if (!footer) return content;

  return `${trimmed}\n\n${footer}`;
}
