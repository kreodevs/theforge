/**
 * DesignRefService — catálogo de referencias visuales para Guía UX/UI.
 */
import { Injectable } from "@nestjs/common";
import {
  getDesignBySlugFromCatalog,
  getDesignReferenceListMerged,
  matchDesignByDomainMerged,
} from "./data/design-catalog.js";
import { formatDesignReferencePrompt } from "./data/design-references.js";
import { getDesignRefInspiration } from "./design-ref-inspiration.util.js";
import { lintDesignMd, type DesignMdLintResult } from "./design-md-lint.util.js";

@Injectable()
export class DesignRefService {
  list() {
    return getDesignReferenceListMerged();
  }

  /**
   * Valida un DESIGN.md con el CLI oficial `@google/design.md` (contraste WCAG,
   * orden de secciones, referencias rotas, etc.).
   */
  lint(content: string): Promise<DesignMdLintResult> {
    return lintDesignMd(content);
  }

  getBySlug(slug: string) {
    const ref = getDesignBySlugFromCatalog(slug);
    if (!ref) return null;
    return { ...ref, ...getDesignRefInspiration(ref) };
  }

  autoMatch(mddContext: string) {
    return matchDesignByDomainMerged(mddContext);
  }

  getPromptBlock(slug: string, mode: "explicit" | "auto-matched" = "explicit"): string | null {
    const ref = getDesignBySlugFromCatalog(slug);
    if (!ref) return null;
    return formatDesignReferencePrompt(ref, mode);
  }
}
