import type { MDDStateType } from "../state/index.js";
import {
  finalizeMddDeliverable,
  fixJwtAlgorithmCoherence,
  fixSection7OutboxNarrative,
  normalizeMddFormat,
  replaceSection6Or7InDraft,
} from "../utils/mdd-sanitize.js";

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:FormatSecInt] ${msg}`, ...args);

/**
 * Merge node for parallel Security + Integration execution.
 * Both nodes stage their section markdown in securitySectionMd / integrationSectionMd
 * instead of writing directly to mddDraft, avoiding the LastValue reducer conflict.
 * This node applies both sections to the accumulated mddDraft and clears the staging fields.
 */
export function createMddFormatSecIntNode() {
  return (state: MDDStateType): Partial<MDDStateType> => {
    const sec6Md = state.securitySectionMd;
    const sec7Md = state.integrationSectionMd;

    if (!sec6Md && !sec7Md) return {};

    let draft = state.mddDraft ?? "";
    if (sec6Md) {
      draft = replaceSection6Or7InDraft(draft, 6, sec6Md);
      LOG("applied §6 draftLen=%s", draft.length);
    }
    if (sec7Md) {
      draft = replaceSection6Or7InDraft(draft, 7, sec7Md);
      LOG("applied §7 draftLen=%s", draft.length);
    }

    draft = fixSection7OutboxNarrative(fixJwtAlgorithmCoherence(draft));

    if (state.executorControlled === true || state.sectionsToRun?.includes("formatter")) {
      draft = finalizeMddDeliverable(normalizeMddFormat(draft));
      LOG("correction sanitize fences/format applied draftLen=%s", draft.length);
    }

    return {
      mddDraft: draft,
      securitySectionMd: undefined,
      integrationSectionMd: undefined,
    };
  };
}
