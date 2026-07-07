import type { MDDStateType } from "../state/index.js";
import { prepareMddForOutput } from "../utils/mdd-prepare-output.js";
import { validateMddForDelivery } from "../utils/mdd-delivery-gate.util.js";
import {
  formatDeliveryGateBlockersFeedback,
  resolveDeliveryGateFixTarget,
  shouldContinueDeliveryGateLoop,
} from "../utils/mdd-delivery-gate-loop.util.js";

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:PrepareOutput] ${msg}`, ...args);

/**
 * Pipeline determinista final + evaluación del delivery gate (Fase 4).
 * Actualiza mddDraft con prepareMddForOutput y prepara feedback para auto-loop.
 */
export function createMddPrepareOutputNode(options?: { uiMcpLibraryLabel?: string | null }) {
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const gateRef: { current?: ReturnType<typeof validateMddForDelivery> } = {};
    const prepared = await prepareMddForOutput(
      { mddDraft: state.mddDraft, mddStructured: state.mddStructured },
      {
        deliveryGateRef: gateRef,
        uiMcpLibraryLabel: options?.uiMcpLibraryLabel ?? null,
      },
    );
    const gate = gateRef.current ?? validateMddForDelivery(prepared);
    const attempt = state.deliveryGateAttempt ?? 0;
    const loop = shouldContinueDeliveryGateLoop(gate, attempt);

    LOG(
      "gate ok=%s score=%s blockers=%d attempt=%d loop=%s",
      gate.ok,
      gate.score,
      gate.blockers.length,
      attempt,
      loop,
    );

    if (loop) {
      const fixTarget = resolveDeliveryGateFixTarget(gate.blockers);
      return {
        mddDraft: prepared,
        deliveryGate: gate,
        deliveryGateAttempt: attempt + 1,
        deliveryGateLoopActive: true,
        deliveryGateFixTarget: fixTarget,
        auditorFeedback: formatDeliveryGateBlockersFeedback(gate.blockers),
        auditorDecision: "clarifier",
      };
    }

    return {
      mddDraft: prepared,
      deliveryGate: gate,
      deliveryGateLoopActive: false,
      deliveryGateFixTarget: undefined,
      auditorFeedback:
        gate.ok
          ? state.auditorFeedback
          : gate.blockers.length > 0
            ? formatDeliveryGateBlockersFeedback(gate.blockers)
            : state.auditorFeedback,
      auditorDecision: gate.ok ? "done" : state.auditorDecision,
    };
  };
}
