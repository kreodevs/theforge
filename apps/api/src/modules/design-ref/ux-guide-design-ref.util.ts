import {
  getDesignBySlugFromCatalog,
  matchDesignByDomainMerged,
} from "./data/design-catalog.js";
import { formatDesignReferencePrompt } from "./data/design-references.js";

export interface ResolvedUxGuideDesignRef {
  /** Valor persistido en proyecto (`auto`, slug o null). */
  storedRef: string | null;
  /** Slug efectivo inyectado al LLM (null = sin bloque de referencia). */
  effectiveSlug: string | null;
  /** Bloque markdown para el prompt de Guía UX/UI. */
  promptBlock: string | null;
  /** Modo de aplicación de tokens. */
  mode: "explicit" | "auto-matched" | "none";
}

/**
 * Resuelve la referencia visual para generar la Guía UX/UI.
 * - slug explícito → usa catálogo
 * - `auto` o null → auto-match por dominio del MDD
 */
export function resolveUxGuideDesignRef(
  storedRef: string | null | undefined,
  mddContext: string,
): ResolvedUxGuideDesignRef {
  const trimmed = storedRef?.trim() ?? null;

  if (trimmed && trimmed !== "auto" && !trimmed.startsWith("url:")) {
    const ref = getDesignBySlugFromCatalog(trimmed);
    if (ref) {
      return {
        storedRef: trimmed,
        effectiveSlug: trimmed,
        promptBlock: formatDesignReferencePrompt(ref, "explicit"),
        mode: "explicit",
      };
    }
  }

  const corpus = mddContext.trim();
  if (!corpus) {
    return { storedRef: trimmed, effectiveSlug: null, promptBlock: null, mode: "none" };
  }

  const matches = matchDesignByDomainMerged(corpus);
  const top = matches[0];
  if (!top) {
    return { storedRef: trimmed, effectiveSlug: null, promptBlock: null, mode: "none" };
  }

  return {
    storedRef: trimmed,
    effectiveSlug: top.slug,
    promptBlock: formatDesignReferencePrompt(top, "auto-matched"),
    mode: "auto-matched",
  };
}
