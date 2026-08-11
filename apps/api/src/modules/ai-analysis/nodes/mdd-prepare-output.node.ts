/**
 * @fileoverview Nodo preparador de salida — ensamblaje final del MDD completo.
 */

import type { MDDStateType } from "../state/index.js";
import { prepareMddForOutput } from "../utils/mdd-prepare-output.js";
import { validateMddForDelivery } from "../utils/mdd-delivery-gate.util.js";
import { preserveValidatedSectionsIfSubstantial } from "../utils/mdd-section-preserve.util.js";
import {
  formatDeliveryGateBlockersFeedback,
  formatDeliveryGateQualityWarningsFeedback,
  fingerprintPlaceholderBlockers,
  hasUnresolvedAutoRepairableGateWarnings,
  resolveDeliveryGateFixTargetFromGate,
  shouldContinueDeliveryGateLoop,
  shouldContinueDeliveryGateQualityLoop,
} from "../utils/mdd-delivery-gate-loop.util.js";
import { isHighSplitArchitectPipeline } from "../utils/mdd-architect-pipeline.util.js";
import { resolveBrdFromMddState, buildInventoryFromMddState } from "../utils/mdd-domain-prompt.util.js";
import {
  applyDeterministicDeliveryGateAutofixes,
  fingerprintDeterministicBlockers,
  shouldCapDeterministicGateLoop,
} from "../utils/mdd-delivery-gate-autofix.util.js";

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:PrepareOutput] ${msg}`, ...args);

/**
 * Pipeline determinista final + evaluación del delivery gate (Fase 4).
 * Actualiza mddDraft con prepareMddForOutput y prepara feedback para auto-loop.
 */
export function createMddPrepareOutputNode(options?: { uiMcpLibraryLabel?: string | null }) {
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const gateRef: { current?: ReturnType<typeof validateMddForDelivery> } = {};
    const brdMarkdown = resolveBrdFromMddState(state) || null;
    const dbgaMarkdown = (state.dbgaContent ?? "").trim() || null;
    const baselineDraft = (state.mddDraft ?? "").trim() || null;
    const prepared = await prepareMddForOutput(
      { mddDraft: state.mddDraft, mddStructured: state.mddStructured },
      {
        deliveryGateRef: gateRef,
        uiMcpLibraryLabel: options?.uiMcpLibraryLabel ?? null,
        brdMarkdown,
        dbgaMarkdown,
        baselineDraft,
        mddComplexity: state.mddComplexity,
        paso0Catalog: state.paso0DecisionCatalog ?? null,
        formatForPersist: false,
        tailSnapshotSource: state,
      },
    );
    const gate =
      gateRef.current ??
      validateMddForDelivery(prepared, {
        brdMarkdown,
        dbgaMarkdown,
        mddComplexity: state.mddComplexity,
        paso0Catalog: state.paso0DecisionCatalog ?? null,
      });
    let workingMarkdown = prepared;
    let workingGate = gate;
    const prevDetFp = state.deliveryGatePlaceholderFingerprint;
    const attempt = state.deliveryGateAttempt ?? 0;

    if (!workingGate.ok && workingGate.blockers.some((b) => b.trim().length > 0)) {
      const { inventory } = buildInventoryFromMddState(state);
      const autofix = applyDeterministicDeliveryGateAutofixes(workingMarkdown, {
        paso0Catalog: state.paso0DecisionCatalog ?? null,
        inventory,
      });
      if (autofix.applied.length > 0) {
        workingMarkdown = autofix.markdown;
        workingGate = validateMddForDelivery(workingMarkdown, {
          brdMarkdown,
          dbgaMarkdown,
          mddComplexity: state.mddComplexity,
          paso0Catalog: state.paso0DecisionCatalog ?? null,
          skipDeterministicRepair: true,
        });
        LOG(
          "deterministic autofix applied=%s gate ok=%s score=%s blockers=%d",
          autofix.applied.join(","),
          workingGate.ok,
          workingGate.score,
          workingGate.blockers.length,
        );
      }
    }

    const qualityPending = hasUnresolvedAutoRepairableGateWarnings(workingGate.warnings);
    const capDeterministicLoop = shouldCapDeterministicGateLoop(
      workingGate.blockers,
      attempt + 1,
      2,
      prevDetFp?.includes("||") ? prevDetFp : fingerprintDeterministicBlockers(workingGate.blockers),
    );
    const loop =
      !capDeterministicLoop &&
      (shouldContinueDeliveryGateLoop(workingGate, attempt) ||
        shouldContinueDeliveryGateQualityLoop(workingGate, attempt));

    LOG(
      "gate ok=%s score=%s blockers=%d warnings=%d attempt=%d loop=%s qualityPending=%s capDet=%s",
      workingGate.ok,
      workingGate.score,
      workingGate.blockers.length,
      workingGate.warnings.length,
      attempt,
      loop,
      qualityPending,
      capDeterministicLoop,
    );

    if (loop) {
      const fixTarget = resolveDeliveryGateFixTargetFromGate(workingGate.blockers, workingGate.warnings, {
        splitArchitectPipeline: isHighSplitArchitectPipeline(state),
        previousPlaceholderFingerprint: state.deliveryGatePlaceholderFingerprint,
        deliveryGateAttempt: attempt + 1,
        sealedSections: {
          mddDraft: workingMarkdown,
          stackArchitectMddDraftSnapshot: state.stackArchitectMddDraftSnapshot,
          dataModelArchitectMddDraftSnapshot: state.dataModelArchitectMddDraftSnapshot,
          apiContractsArchitectMddDraftSnapshot: state.apiContractsArchitectMddDraftSnapshot,
        },
      });
      const agentFeedback = [
        formatDeliveryGateBlockersFeedback(workingGate.blockers),
        formatDeliveryGateQualityWarningsFeedback(workingGate.warnings),
      ]
        .filter(Boolean)
        .join("\n\n");
      const safeDraft = preserveValidatedSectionsIfSubstantial(baselineDraft ?? "", workingMarkdown);
      return {
        mddDraft: safeDraft,
        previousMddDraftForMerge: baselineDraft ?? state.mddDraft,
        deliveryGate: workingGate,
        deliveryGateAttempt: attempt + 1,
        deliveryGateLoopActive: true,
        deliveryGateFixTarget: fixTarget,
        deliveryGatePlaceholderFingerprint: [
          fingerprintPlaceholderBlockers(workingGate.blockers),
          fingerprintDeterministicBlockers(workingGate.blockers),
        ]
          .filter(Boolean)
          .join("||"),
        auditorFeedback: agentFeedback || state.auditorFeedback,
      };
    }

    return {
      mddDraft: workingMarkdown,
      deliveryGate: workingGate,
      deliveryGateLoopActive: false,
      deliveryGateFixTarget: undefined,
      deliveryGatePlaceholderFingerprint: undefined,
      auditorFeedback:
        workingGate.ok
          ? state.auditorFeedback
          : workingGate.blockers.length > 0
            ? formatDeliveryGateBlockersFeedback(workingGate.blockers)
            : state.auditorFeedback,
      auditorDecision: workingGate.ok ? "done" : state.auditorDecision,
    };
  };
}
