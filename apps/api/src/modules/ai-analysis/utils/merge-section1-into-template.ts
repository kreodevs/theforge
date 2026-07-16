import { getMddTemplatePlaceholder } from "../state/mdd-structured.schema.js";
import { mergeSection1IntoDraft } from "./mdd-sanitize.js";

/**
 * Builds a canonical MDD skeleton with §1 filled from clarifier output; §2–7 stay as placeholders.
 */
export function mergeSection1IntoTemplate(contextoAlcance: string, _clarifiedScope?: string): string {
  const section1 = (contextoAlcance ?? "").trim();
  if (!section1) {
    throw new Error("Clarifier no pudo estructurar el alcance del BRD");
  }
  return getMddTemplatePlaceholder(section1);
}

/**
 * Applies clarifier §1 onto an existing draft when §2–7 must be preserved (refinement path).
 */
export function buildMddDraftFromClarifierOutput(input: {
  contextoAlcance: string;
  clarifiedScope?: string;
  previousDraft?: string;
  preserveSectionsBeyond1?: boolean;
}): string {
  const section1Draft = mergeSection1IntoTemplate(input.contextoAlcance, input.clarifiedScope);
  const previous = (input.previousDraft ?? "").trim();
  if (input.preserveSectionsBeyond1 && previous.length > 0) {
    return mergeSection1IntoDraft(previous, section1Draft);
  }
  return section1Draft;
}
