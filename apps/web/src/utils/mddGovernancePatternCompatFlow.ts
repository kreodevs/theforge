import type { GovernancePatternCorrection } from "@theforge/shared-types";
import { resolveGovernancePatternIncompatibilities } from "@theforge/shared-types/mdd-governance-pattern-compat";

export type PendingMddAfterPatternCompat =
  | { kind: "generate-benchmark" }
  | { kind: "upstream-sync"; sections: number[] }
  | { kind: "wizard-initial"; seedMarkdown: string }
  | { kind: "edit-patterns-only" };

export type GovernancePatternCompatOffer =
  | { proceed: true; correctedIds: Set<string> }
  | {
      proceed: false;
      correctedIds: Set<string>;
      corrections: GovernancePatternCorrection[];
    };

/** Si hay incompatibilidades, el caller debe mostrar confirmación antes de continuar. */
export function offerGovernancePatternCompat(
  selectedIds: ReadonlySet<string>,
): GovernancePatternCompatOffer {
  const { correctedIds, corrections } = resolveGovernancePatternIncompatibilities(selectedIds);
  if (corrections.length === 0) {
    return { proceed: true, correctedIds };
  }
  return { proceed: false, correctedIds, corrections };
}
