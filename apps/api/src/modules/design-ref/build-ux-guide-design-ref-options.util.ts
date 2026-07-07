import type { UxGuideProjectFields } from "../ai/ux-guide-llm-context.js";
import { resolveUxGuideDesignRef } from "./ux-guide-design-ref.util.js";

export type UxGuideLlmDesignRefOptions = {
  uxGuideDesignRef?: string;
  uxGuideDesignRefPromptBlock?: string;
  uxGuideDesignRefEffectiveSlug?: string;
  uxGuideDesignRefMode?: "explicit" | "auto-matched" | "none";
};

/**
 * Resuelve referencia visual + bloque de prompt para generación de Guía UX/UI.
 */
export function buildUxGuideDesignRefOptions(
  project: Pick<UxGuideProjectFields, "uxGuideDesignRef">,
  mddContext: string,
): UxGuideLlmDesignRefOptions {
  const resolved = resolveUxGuideDesignRef(project.uxGuideDesignRef, mddContext);
  if (!resolved.promptBlock || !resolved.effectiveSlug) {
    return { uxGuideDesignRefMode: resolved.mode };
  }
  return {
    uxGuideDesignRef: resolved.effectiveSlug,
    uxGuideDesignRefPromptBlock: resolved.promptBlock,
    uxGuideDesignRefEffectiveSlug: resolved.effectiveSlug,
    uxGuideDesignRefMode: resolved.mode,
  };
}
