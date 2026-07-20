import type { StateCreator } from "zustand";
import type { WorkshopState } from "./workshop-state.types";

type UiSliceActions = Pick<
  WorkshopState,
  | "setProjectId"
  | "setLoading"
  | "setSynced"
  | "setError"
  | "setNotice"
  | "bumpDocumentationGapsRefresh"
  | "setModelsUnavailableModalOpen"
  | "clearEvaluatorCritique"
  | "clearLegacyMcpDebugTrace"
  | "clearLegacyDeliverablesDebug"
>;

export const createUiSlice: StateCreator<WorkshopState, [], [], UiSliceActions> = (set) => ({
  setProjectId: (id) => set({ projectId: id }),
  setLoading: (v) => set({ loading: v }),
  setSynced: (v) => set({ synced: v }),
  setError: (e) => set({ error: e }),
  bumpDocumentationGapsRefresh: () =>
    set((s) => ({ documentationGapsRefreshNonce: s.documentationGapsRefreshNonce + 1 })),
  setNotice: (n) => set({ notice: n }),
  setModelsUnavailableModalOpen: (open) => set({ modelsUnavailableModalOpen: open }),
  clearEvaluatorCritique: () => set({ evaluatorCritique: null }),
  clearLegacyMcpDebugTrace: () => set({ legacyMcpDebugTrace: null }),
  clearLegacyDeliverablesDebug: () => set({ lastLegacyDeliverablesDebug: null }),
});
