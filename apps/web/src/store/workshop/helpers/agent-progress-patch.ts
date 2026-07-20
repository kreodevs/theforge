import { mergeAgentProgressFromMddEvent } from "../../../utils/agentProgress";
import type { WorkshopState } from "../workshop-state.types";

export function patchAgentProgressFromMddEvent(
  set: (partial: Partial<WorkshopState> | ((state: WorkshopState) => Partial<WorkshopState>)) => void,
  raw: unknown,
): void {
  set((s) => ({
    agentProgress: mergeAgentProgressFromMddEvent(s.agentProgress, raw),
  }));
}
