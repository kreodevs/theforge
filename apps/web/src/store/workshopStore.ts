import { create } from "zustand";
import type {
  MddDeliveryGateResult,
  MddUpstreamSyncStatus,
  PlanValidationPersisted,
  ProjectGenerationStatus,
  TraceabilityGapInput,
  TraceabilitySuggestFixResponse,
} from "@theforge/shared-types";
import {
  buildUpstreamChangeSummaryForPipeline,
  mddMarkdownHasKnownFormatCorruption,
  mddMarkdownNeedsStructuralRepair,
} from "@theforge/shared-types";
import {
  governancePatternSelectionDiffers,
  selectedPatternIdsFromMdd,
  serverWouldDropGovernancePatterns,
  shouldAllowGovernancePatternChangeOnPersist,
} from "@theforge/shared-types/mdd-governance-patterns";
import {
  documentPersistFieldLabel,
  isChangelogOnlyDocument,
  validateDocumentForPersist,
  type ClarifyableDocumentField,
} from "@theforge/shared-types";
import { contentIncludesVisionBlock } from "@theforge/shared-types/session";
import { isFormatDocumentChatCommand } from "../utils/documentFormatCommand";
import {
  formatDbgaDocument,
  formatDocumentMarkdown,
} from "@theforge/shared-types/format-document-markdown";
import { apiFetch, API_BASE, fetchWithRetry, addToOfflineQueue, flushOfflineQueue, getOfflineQueue } from "../utils/apiClient";
import { queueAndPoll } from "../utils/queueAndPoll";
import { enqueueAndPollLegacyMdd, enqueueAndPollMddJob } from "../utils/pollMddJob";
import {
  mergeProjectBaselinesAfterPersist,
  shouldApplyPersistedFieldContent,
  WORKSHOP_PERSIST_BASELINE_FIELDS,
} from "../utils/persist-field-guard";
import {
  cleanDocForWorkshop as cleanDoc,
  extractWorkshopDocumentTimestamps,
  normalizeWorkshopDocumentForEditor,
  workshopDocumentBodiesEqual,
  workshopMddEditorBaseline,
} from "../utils/workshop-document-content.util";
import { resolveMddFetchMerge } from "../utils/workshop-mdd-sync.util";
import {
  parseApiErrorPayloadFromResponse,
  parseErrorMessageFromResponse,
} from "../utils/httpError";
import { parseNdjsonLine } from "../utils/ndjson";
import { mddHasSection6Heading, buildMddSectionRegenNotice } from "../utils/mddSectionRegen";
import { appendMddTraceSection } from "../utils/appendMddTraceSection";
import { isWorkshopAgentsBusy } from "../utils/workshopAgentsBusy";
import { shouldPreserveWorkshopBusyState } from "../utils/workshopBusyRefresh";
import {
  applyDeliverableCascadeProgressUpdate,
  ensurePostPassCascadeRow,
  markAllAgentProgressTerminated,
  readDeliverableCascadeProgressStep,
} from "../utils/deliverableCascadeProgress";
import { CASCADE_POST_PASS_STEP_LABEL } from "@theforge/shared-types";
import {
  isStageScopedDeliverableField,
  resolveWorkshopStageDeliverables,
} from "../utils/workshopStageDeliverables";
import { mddJobProgressEventFields, mergeAgentProgressFromMddEvent } from "../utils/agentProgress";
import { primaryMddJob } from "../utils/projectGenerationGate";
import {
  advanceAgentGovernanceProgressItems,
  completeAgentGovernanceProgressItems,
  createAgentGovernanceProgressItems,
} from "../constants/agent-governance-loading-steps";
import {
  buildPlanApprovalChatContents,
  isPlanApprovalResumeMessage,
} from "../utils/planApprovalChat";
import {
  deliverableStepLabelsForComplexity,
  deliverableStepLabelsForKinds,
  planLegacyDeliverablesToGenerate,
} from "@theforge/shared-types";
import { listGovernancePatternOptions } from "@theforge/shared-types/mdd-governance-patterns";
import {
  orchestratorDocSnapshot,
  resolveOrchestratorDocUnchangedError,
} from "../utils/orchestratorDocGuard";
import {
  isSsotPatternsNotice,
  isWorkshopConnectionError,
  SSOT_PATTERNS_RESTORED_NOTICE,
} from "../utils/workshopSyncStatus";
import { pickDefaultStageId } from "./workshop/helpers/pick-default-stage";

import { workshopInitialState } from "./workshop/initial-state";
import type { WorkshopState } from "./workshop/workshop-state.types";
import { createUiSlice } from "./workshop/slice-ui";
import { selectPersistedMddBaseline } from "./workshop/selectors";
export {
  isMddEditorDirty,
  selectPersistedMddBaseline,
  selectWorkshopAgentsBusy,
} from "./workshop/selectors";
export { sessionMessageBody } from "./workshop/helpers/session-message";
import { sessionMessageBody } from "./workshop/helpers/session-message";
export type {
  Status,
  ChatMessage,
  Estimation,
  LiveMetricsResult,
  PrecisionBreakdown,
  DocumentCompleteness,
  CrossDocumentGap,
  ConformanceResult,
  ApiConformanceResult,
  LegacyDeliverablesDebugStep,
  LegacySectionMergeTraceGroup,
  LegacySectionMergeTrace,
  LogicFlowsSection5CoverageReport,
  LegacyDeliverablesDebugReport,
  LegacyFlowState,
  WorkshopStage,
  ComplexityPending,
  Project,
  LegacyMcpDebugEntry,
  Session,
} from "./workshop/types";
import type {
  ApiConformanceResult,
  ComplexityPending,
  ConformanceResult,
  CrossDocumentGap,
  DocumentCompleteness,
  LegacyDeliverablesDebugReport,
  LegacyMcpDebugEntry,
  LiveMetricsResult,
  PrecisionBreakdown,
  Project,
  Session,
  WorkshopStage,
} from "./workshop/types";
import { shouldApplyWorkshopUpdate, workshopScopeProjectId } from "./workshop/helpers/workshop-scope";
import {
  errorStateFromCaught,
  friendlyFetchError,
  streamErrorPatch,
  throwStreamHttpError,
} from "./workshop/helpers/store-errors";
import {
  deliveryGateFromStreamEvent,
  formatDeliveryGateInsertBlocker,
  hasDeliveryGateBlockers,
} from "./workshop/helpers/delivery-gate";
import {
  generationStatusPoll,
  mergeGenerationStatusWithMddUpstreamSync,
  stopGenerationStatusPolling,
} from "./workshop/helpers/generation-status";
import {
  applyMddEditorBaselineToWorkshop,
  applyMddFromFetchedProject,
  enqueueMddPersist,
  mddContentForEditor,
  normalizedMddForPersistCompare,
  patchWorkshopMddStagesWithEditorContent,
  persistMddFromChatStream,
  selectRawMddFromStage,
  streamMarkdownPreservesGovernancePatterns,
} from "./workshop/helpers/mdd-editor";
import {
  effectiveMddContentForSectionRegen,
  legacyCodebaseDocFromStages,
  legacyDebugFromStages,
  projectWithUxAfterStream,
  workshopFlatFromStage,
  workshopStateFromProjectStage,
} from "./workshop/helpers/stage-focus";
import {
  lastMddUserMessageContent,
  pickEvaluatorCritique,
} from "./workshop/helpers/session-message";
import { workshopStorePatchForClarifiedField } from "./workshop/helpers/clarified-field-patch";





function patchAgentProgressFromMddEvent(
  set: (partial: Partial<WorkshopState> | ((state: WorkshopState) => Partial<WorkshopState>)) => void,
  raw: unknown,
): void {
  set((s) => ({
    agentProgress: mergeAgentProgressFromMddEvent(s.agentProgress, raw),
  }));
}
/** Helper para persist*Content: aplica retry, offline queue y setea error en el store. */
type PersistFieldResult = { ok: true } | { ok: false; error: string };

async function persistField(
  fieldName: string,
  content: string | null,
  getState: () => WorkshopState,
  setState: (partial: Partial<WorkshopState>) => void,
): Promise<PersistFieldResult> {
  const { projectId, project, activeStageId } = getState();
  if (!projectId || !project) return { ok: false, error: "No hay proyecto activo." };
  const stageDeliverables = resolveWorkshopStageDeliverables(
    { ...project, stages: project.stages ?? [] },
    activeStageId,
  );
  const persistedBaseline = isStageScopedDeliverableField(fieldName)
    ? (stageDeliverables[fieldName] ?? "")
    : (((project as unknown as Record<string, unknown>)[fieldName] as string | null | undefined) ?? "");
  if (content === persistedBaseline || workshopDocumentBodiesEqual(content, persistedBaseline)) {
    return { ok: true };
  }

  const cleaned = cleanDoc(content) || content || "";
  const currentRaw = String(persistedBaseline);
  const persistValidation = validateDocumentForPersist(currentRaw, cleaned, {
    fieldLabel: documentPersistFieldLabel(fieldName),
  });
  if (!persistValidation.ok) {
    setState({ synced: true, error: persistValidation.message });
    return { ok: false, error: persistValidation.message };
  }
  const localAtSaveStart = String(
    ((getState() as unknown as Record<string, unknown>)[fieldName] as string | null | undefined) ??
      "",
  );
  setState({ synced: false, error: null, notice: null });

  const stageIdForPatch =
    fieldName === "mddContent" || isStageScopedDeliverableField(fieldName)
      ? activeStageId ?? undefined
      : undefined;

  try {
    const r = await fetchWithRetry(`${API_BASE}/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [fieldName]: cleaned,
        ...(stageIdForPatch ? { stageId: stageIdForPatch } : {}),
      }),
    });
    if (r.ok) {
      const data = (await r.json()) as Project & { mddGovernancePatternsReverted?: boolean };
      const stages = data.stages ?? project.stages ?? [];
      let mergedProject: Project = { ...data, stages };
      if (stageIdForPatch && (isStageScopedDeliverableField(fieldName) || fieldName === "mddContent")) {
        mergedProject = {
          ...mergedProject,
          stages: stages.map((s) =>
            s.id === stageIdForPatch ? { ...s, [fieldName]: cleaned } : s,
          ),
        };
      }
      const focused = workshopStateFromProjectStage(mergedProject, activeStageId);
      const serverRaw =
        fieldName === "mddContent"
          ? ((focused.project.mddContent as string | undefined) ?? cleaned)
          : isStageScopedDeliverableField(fieldName)
            ? (focused[fieldName] ?? cleaned)
            : ((data[fieldName as keyof Project] as string | undefined) ?? cleaned);
      const serverCleaned =
        normalizeWorkshopDocumentForEditor(serverRaw) ?? cleanDoc(serverRaw) ?? serverRaw ?? "";
      const patternsReverted =
        fieldName === "mddContent" && data.mddGovernancePatternsReverted === true;
      const localNow = String(
        ((getState() as unknown as Record<string, unknown>)[fieldName] as string | null | undefined) ??
          "",
      );
      const stateNow = getState();
      const localFields = Object.fromEntries(
        WORKSHOP_PERSIST_BASELINE_FIELDS.map((f) => [
          f,
          (stateNow as unknown as Record<string, unknown>)[f] as string | null | undefined,
        ]),
      );
      const alignedProject = mergeProjectBaselinesAfterPersist(
        focused.project as unknown as Record<string, unknown>,
        {
          savedField: fieldName,
          prevProject: project as unknown as Record<string, unknown>,
          activeStageId,
          localFields,
        },
      ) as unknown as Project;
      const editorBaseline = serverCleaned;
      (alignedProject as unknown as Record<string, unknown>)[fieldName] = editorBaseline;
      if (fieldName === "mddContent" && activeStageId && alignedProject.stages?.length) {
        alignedProject.stages = alignedProject.stages.map((s) =>
          s.id === activeStageId ? { ...s, mddContent: editorBaseline } : s,
        );
      } else if (isStageScopedDeliverableField(fieldName) && activeStageId && alignedProject.stages?.length) {
        alignedProject.stages = alignedProject.stages.map((s) =>
          s.id === activeStageId ? { ...s, [fieldName]: editorBaseline } : s,
        );
      }
      const patch: Partial<WorkshopState> = {
        project: alignedProject,
        synced: true,
        error: null,
        notice: patternsReverted ? SSOT_PATTERNS_RESTORED_NOTICE : null,
      };
      const fieldTimestamps = extractWorkshopDocumentTimestamps(serverRaw);
      if (fieldTimestamps) {
        patch.documentTimestamps = {
          ...getState().documentTimestamps,
          [fieldName]: fieldTimestamps,
        };
      }
      if (shouldApplyPersistedFieldContent(localNow, localAtSaveStart, cleaned) || patternsReverted) {
        (patch as Record<string, unknown>)[fieldName] = serverCleaned;
      }
      if (fieldName === "mddContent" && alignedProject.stages?.length) {
        patch.workshopStages = alignedProject.stages;
      }
      if (
        fieldName === "mddContent" &&
        (shouldApplyPersistedFieldContent(localNow, localAtSaveStart, cleaned) || patternsReverted)
      ) {
        patch.mddPersistedBaseline = serverCleaned;
      }
      setState(patch);
      // Flush offline queue oportunistically
      flushOfflineQueue().catch(() => {});
      if (fieldName === "dbgaContent" || fieldName === "phase0SummaryContent") {
        void getState().fetchGenerationStatus(projectId);
      }
      return { ok: true };
    }

    const errText = await parseErrorMessageFromResponse(r, "Error al guardar");
    if (r.status >= 400 && r.status < 500) {
      setState({ synced: true, error: `Error: ${errText}` });
      return { ok: false, error: errText };
    }
    addToOfflineQueue({ field: fieldName, content: cleaned, projectId, timestamp: Date.now() });
    setState({ synced: true, error: `Error: ${errText}. Cambio guardado localmente.` });
    return { ok: false, error: errText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addToOfflineQueue({ field: fieldName, content: cleaned, projectId, timestamp: Date.now() });
    setState({ synced: true, error: `Sin conexión: ${msg}. Cambio guardado localmente.` });
    return { ok: false, error: msg };
  }
}





export const useWorkshopStore = create<WorkshopState>((set, get, api) => ({
  ...workshopInitialState,
  ...createUiSlice(set, get, api),
  setWorkshopActiveDocPanel: (panel) => {
    const state = get();
    if (isWorkshopAgentsBusy(state)) return;
    set({ workshopActiveDocPanel: panel });
  },
  setProject: (p) => {
    if (!p) {
      set({
        project: null,
        activeStageId: null,
        workshopStages: [],
        mddPersistedBaseline: "",
        lastLegacyDeliverablesDebug: null,
        pluginData: {},
      });
      return;
    }
    const stages = p.stages ?? [];
    const prev = get().activeStageId;
    const activeStageId = prev && stages.some((s) => s.id === prev) ? prev : pickDefaultStageId(stages);
    const focused = workshopStateFromProjectStage({ ...p, stages }, activeStageId);
    set({
      project: focused.project,
      workshopStages: stages,
      activeStageId,
      mddContent: focused.mddContent,
      mddPersistedBaseline: focused.mddContent ?? "",
      documentTimestamps: focused.documentTimestamps,
      uxUiGuideContent: focused.uxUiGuideContent,
      dbgaContent: p.dbgaContent ?? null,
      phase0SummaryContent: focused.phase0SummaryContent,
      blueprintContent: focused.blueprintContent,
      apiContractsContent: focused.apiContractsContent,
      logicFlowsContent: focused.logicFlowsContent,
      architectureContent: focused.architectureContent,
      useCasesContent: focused.useCasesContent,
      userStoriesContent: focused.userStoriesContent,
      infraContent: focused.infraContent,
      aemContent: focused.aemContent,
      specContent: focused.specContent,
      tasksContent: focused.tasksContent,
      uiScreensContent: focused.uiScreensContent,
      agentGovernanceContent: focused.agentGovernanceContent,
      lastLegacyDeliverablesDebug: legacyDebugFromStages(stages, activeStageId),
      pluginData: (p.pluginData as Record<string, unknown> | null | undefined) ?? {},
    });
  },
  patchPluginData: (pluginId, data) =>
    set((s) => ({
      pluginData: { ...s.pluginData, [pluginId]: data },
      project: s.project
        ? {
            ...s.project,
            pluginData: { ...(s.project.pluginData as Record<string, unknown> | undefined), [pluginId]: data },
          }
        : s.project,
    })),
  setSession: (s) => set({ session: s }),
  setMddContent: (content) => set({ mddContent: mddContentForEditor(content) }),
  retryWorkshopSync: async () => {
    const { projectId, error } = get();
    const pid = projectId?.trim();
    if (!pid) return;
    const hadConnectionError = isWorkshopConnectionError(error);
    if (hadConnectionError) set({ error: null, synced: false });
    try {
      await flushOfflineQueue();
      const r = await fetchWithRetry(`${API_BASE}/projects/${pid}`, undefined, 1);
      if (r.ok) {
        const data = (await r.json()) as Project;
        get().setProject(data);
        set({ synced: true, error: null });
        return;
      }
      if (hadConnectionError) {
        set({
          synced: true,
          error: "Sin conexión con el servidor. Reintenta en unos segundos.",
        });
      }
    } catch {
      if (hadConnectionError || getOfflineQueue().length > 0) {
        set({
          synced: true,
          error: "Sin conexión: cambios pendientes en cola local. Reintenta al reconectar.",
        });
      }
    }
  },

  setActiveStageId: (stageId) => {
    const { project, projectId, workshopStages } = get();
    if (!project || !stageId) return;
    const stages = workshopStages.length > 0 ? workshopStages : (project.stages ?? []);
    if (!stages.some((s) => s.id === stageId)) return;
    const focused = workshopStateFromProjectStage({ ...project, stages }, stageId);
    set({
      activeStageId: stageId,
      project: focused.project,
      mddContent: focused.mddContent,
      mddPersistedBaseline: focused.mddContent ?? "",
      documentTimestamps: focused.documentTimestamps,
      specContent: focused.specContent,
      architectureContent: focused.architectureContent,
      useCasesContent: focused.useCasesContent,
      userStoriesContent: focused.userStoriesContent,
      blueprintContent: focused.blueprintContent,
      tasksContent: focused.tasksContent,
      apiContractsContent: focused.apiContractsContent,
      logicFlowsContent: focused.logicFlowsContent,
      infraContent: focused.infraContent,
      agentGovernanceContent: focused.agentGovernanceContent,
      uxUiGuideContent: focused.uxUiGuideContent,
      uiScreensContent: focused.uiScreensContent,
      phase0SummaryContent: focused.phase0SummaryContent,
      aemContent: focused.aemContent,
    });
    const pid = projectId ?? project.id;
    if (pid?.trim()) {
      const qs = new URLSearchParams({ projectId: pid.trim(), stageId });
      void apiFetch(`${API_BASE}/ai-analysis/mdd/thread?${qs.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { threadId?: string | null } | null) => {
          if (data?.threadId) set({ managerThreadId: data.threadId });
          else set({ managerThreadId: null });
        })
        .catch(() => {});
      void get()
        .fetchEstimation(pid.trim())
        .catch(() => {});
    }
  },

  createWorkshopStage: async (opts) => {
    const { projectId, project, workshopStages } = get();
    if (!projectId?.trim()) return null;
    const body: Record<string, unknown> = { activate: true };
    if (opts.name?.trim()) body.name = opts.name.trim();
    if (opts.key?.trim()) body.key = opts.key.trim();
    if (opts.copyMddFromStageId?.trim()) body.copyMddFromStageId = opts.copyMddFromStageId.trim();
    if (opts.copyLegacyChangeFromStageId?.trim()) body.copyLegacyChangeFromStageId = opts.copyLegacyChangeFromStageId.trim();
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "No se pudo crear la etapa");
      }
      const data = (await r.json()) as { stage?: WorkshopStage } | Project;
      const newStage = "stage" in data && data.stage ? data.stage : null;
      if (newStage && project) {
        const prev = workshopStages.length > 0 ? workshopStages : (project.stages ?? []);
        const stages = [...prev.filter((s) => s.id !== newStage.id), newStage].sort((a, b) => a.ordinal - b.ordinal);
        const nextProject: Project = { ...project, stages };
        const activeStageId = newStage.id;
        const flat = workshopFlatFromStage(nextProject, activeStageId);
        set({
          workshopStages: stages,
          project: { ...nextProject, ...flat },
          activeStageId,
          mddContent: normalizeWorkshopDocumentForEditor(flat.mddContent) ?? "",
          mddPersistedBaseline: normalizeWorkshopDocumentForEditor(flat.mddContent) ?? "",
          error: null,
        });
        const pid = projectId.trim();
        const threadQs = new URLSearchParams({ projectId: pid, stageId: activeStageId });
        void apiFetch(`${API_BASE}/ai-analysis/mdd/thread?${threadQs.toString()}`)
          .then((tr) => (tr.ok ? tr.json() : null))
          .then((d: { threadId?: string | null } | null) => {
            if (d?.threadId) set({ managerThreadId: d.threadId });
            else set({ managerThreadId: null });
          })
          .catch(() => {});
        void get().fetchEstimation(pid).catch(() => {});
        return get().project;
      }
      return await get().fetchProject(projectId.trim());
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al crear etapa" });
      return null;
    }
  },

  patchWorkshopStage: async (stageId, body) => {
    const { projectId } = get();
    if (!projectId?.trim() || !stageId?.trim()) {
      set({ error: "Falta proyecto o etapa" });
      return false;
    }
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/stages/${stageId.trim()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(err.message) ? err.message.join("; ") : err.message;
        throw new Error(msg ?? "PATCH etapa falló");
      }
      await get().fetchProject(projectId.trim());
      if ("brdContent" in body) {
        void get().fetchGenerationStatus(projectId.trim());
      }
      set({ error: null });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al actualizar etapa" });
      return false;
    }
  },

  setProjectRequireBrdTobeGate: async (projectId, requireBrdTobeGate) => {
    if (!projectId?.trim()) {
      set({ error: "Falta proyecto" });
      return false;
    }
    // Optimistic update: reflejar cambio al instante en el store
    const prev = get().project;
    if (prev) {
      set({ project: { ...prev, requireBrdTobeGate } });
    }
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireBrdTobeGate }),
      });
      if (!r.ok) {
        // Revertir optimismo si falló
        if (prev) {
          set({ project: prev });
        }
        const err = (await r.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(err.message) ? err.message.join("; ") : err.message;
        throw new Error(msg ?? "PATCH proyecto falló");
      }
      await get().fetchProject(projectId.trim());
      set({ error: null });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al actualizar proyecto" });
      return false;
    }
  },

  fetchGenerationStatus: async (projectId, stageId) => {
    const requestedId = projectId.trim();
    if (!requestedId) return null;
    const sid = stageId?.trim() || get().activeStageId?.trim();
    const qs = sid ? `?stageId=${encodeURIComponent(sid)}` : "";
    try {
      const r = await apiFetch(`${API_BASE}/projects/${requestedId}/generation-status${qs}`);
      if (!r.ok) return null;
      const raw = (await r.json()) as ProjectGenerationStatus;
      const status: ProjectGenerationStatus = { ...raw, mddJobs: raw.mddJobs ?? [] };
      if (!shouldApplyWorkshopUpdate(get, requestedId)) return status;
      const wasBusy = get().generationStatus?.busy === true;
      set({ generationStatus: status });
      const mddJob = primaryMddJob(status);
      if (
        mddJob &&
        (status.mddStreamActive ||
          get().loadingReason === "mdd" ||
          get().loadingReason === "mdd-section") &&
        ((mddJob.progressSteps?.length ?? 0) > 0 || mddJob.progressActive)
      ) {
        set((s) => ({
          agentProgress: mergeAgentProgressFromMddEvent(s.agentProgress, {
            steps: mddJob.progressSteps ?? [],
            active: mddJob.progressActive ?? null,
          }),
        }));
      }
      if (status.busy) {
        if (generationStatusPoll.projectId !== requestedId) {
          stopGenerationStatusPolling();
          generationStatusPoll.projectId = requestedId;
          generationStatusPoll.timer = setInterval(() => {
            void get().fetchGenerationStatus(requestedId);
          }, 5000);
        }
      } else {
        stopGenerationStatusPolling();
        if (wasBusy) {
          void get()
            .fetchProject(requestedId, { preferServerMdd: true })
            .then((project) => {
              applyMddFromFetchedProject(get, set, project ?? get().project);
            });
        }
      }
      return status;
    } catch {
      return null;
    }
  },

  cancelMddJob: async (projectId, jobId) => {
    const pid = projectId.trim();
    const jid = jobId.trim();
    if (!pid || !jid) return false;
    try {
      const r = await apiFetch(`${API_BASE}/projects/${pid}/mdd-jobs/${jid}`, { method: "DELETE" });
      if (!r.ok) {
        set({
          error: await parseErrorMessageFromResponse(r, "No se pudo cancelar el job MDD"),
        });
        return false;
      }
      set({
        loading: false,
        loadingReason: null,
        agentProgress: [],
        notice:
          "Generación MDD cancelada. El pipeline puede tardar unos segundos en detenerse entre nodos.",
      });
      await get().fetchGenerationStatus(pid);
      return true;
    } catch (e) {
      set({ error: friendlyFetchError(e) });
      return false;
    }
  },

  fetchPlanValidation: async (projectId, stageId) => {
    const requestedId = projectId.trim();
    if (!requestedId) return null;
    try {
      const q = stageId?.trim() ? `?stageId=${encodeURIComponent(stageId.trim())}` : "";
      const r = await apiFetch(`${API_BASE}/projects/${requestedId}/plan-validation${q}`);
      if (!r.ok) return null;
      const data = (await r.json()) as { validation?: PlanValidationPersisted | null };
      const validation = data.validation ?? null;
      if (shouldApplyWorkshopUpdate(get, requestedId)) {
        set({ planValidation: validation });
      }
      return validation;
    } catch {
      return null;
    }
  },

  validateChangePlan: async (projectId, stageId) => {
    const requestedId = projectId.trim();
    if (!requestedId) return null;
    set({ loading: true, error: null });
    try {
      const q = stageId?.trim() ? `?stageId=${encodeURIComponent(stageId.trim())}` : "";
      const r = await apiFetch(`${API_BASE}/projects/${requestedId}/validate-change-plan${q}`, {
        method: "POST",
      });
      if (!r.ok) {
        throw new Error(await parseErrorMessageFromResponse(r, "Error al validar plan"));
      }
      const data = (await r.json()) as {
        skipped?: boolean;
        persisted?: PlanValidationPersisted;
      };
      const validation = data.persisted ?? null;
      if (validation && shouldApplyWorkshopUpdate(get, requestedId)) {
        set({ planValidation: validation });
      }
      return validation;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al validar plan" });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  refreshWorkshopOnTabVisible: async (projectId) => {
    const requestedId = projectId.trim();
    if (!requestedId) return;
    await get().fetchGenerationStatus(requestedId);
    const state = get();
    if (state.agentProgress.length > 0 || !state.loading) return;
    const reason = state.loadingReason;
    if (reason !== "deliverables-cascade" && reason !== "legacy-deliverables") return;

    const complexity = state.project?.complexity ?? "HIGH";
    const stepLabels =
      reason === "legacy-deliverables"
        ? deliverableStepLabelsForKinds(
            planLegacyDeliverablesToGenerate({
              complexity,
              hasMddContent: !!state.project?.mddContent?.trim(),
            }),
          )
        : deliverableStepLabelsForComplexity(complexity);
    if (stepLabels.length === 0) return;

    const completed = Math.min(state.cascadeCompleted, stepLabels.length);
    set({
      agentProgress: stepLabels.map((label, index) => ({
        agent: "Entregables",
        message:
          index < completed ? `✅ ${label} — Terminado` : `⚪ ${label} — Generando…`,
        step: label,
        status: index < completed ? ("terminado" as const) : ("generando" as const),
      })),
      cascadeTotal: stepLabels.length,
    });
  },

  fetchProject: async (projectId, options) => {
    const requestedId = projectId.trim();
    if (!requestedId) return null;
    try {
      const switchingProject =
        !!get().projectId?.trim() && get().projectId!.trim() !== requestedId;
      const preserveBusy = !switchingProject && shouldPreserveWorkshopBusyState(get(), requestedId);
      set({
        ...(preserveBusy
          ? {}
          : {
              session: null,
              managerThreadId: null,
              streamingUserMessage: null,
              streamingUserImages: null,
              streamingContent: null,
              streamingTab: null,
              agentProgress: [],
            }),
        ...(switchingProject
          ? {
              loading: false,
              loadingReason: null,
              pendingPlanApproval: null,
              evaluatorCritique: null,
            }
          : {}),
      });
      const r = await apiFetch(`${API_BASE}/projects/${requestedId}`);
      if (!r.ok) throw new Error("Proyecto no encontrado");
      const data: Project = await r.json();
      const stages = data.stages ?? [];
      const prev = get().activeStageId;
      const activeStageId = prev && stages.some((s) => s.id === prev) ? prev : pickDefaultStageId(stages);
      const focused = workshopStateFromProjectStage({ ...data, stages }, activeStageId);
      if (!shouldApplyWorkshopUpdate(get, requestedId)) return null;
      const localMdd = get().mddContent ?? "";
      const persistedMdd = selectPersistedMddBaseline(get());
      const serverMdd = focused.mddContent ?? "";
      const sameProjectLoaded =
        get().project?.id === requestedId && workshopScopeProjectId(get) === requestedId;
      const preferServerMdd =
        options?.preferServerMdd === true ||
        get().loadingReason === "mdd" ||
        get().loadingReason === "mdd-section" ||
        get().loadingReason === "legacy-mdd";
      const { nextMddContent, updatePersistedBaseline } = resolveMddFetchMerge({
        switchingProject,
        sameProjectLoaded,
        mddPersisting: get().mddPersisting,
        preferServerMdd,
        localMdd,
        persistedMdd,
        serverMdd,
      });
      let nextStages = stages;
      let nextProject: typeof focused.project = focused.project;
      if (activeStageId) {
        const patched = patchWorkshopMddStagesWithEditorContent(
          focused.project,
          stages,
          activeStageId,
          nextMddContent,
        );
        nextStages = patched.stages;
        nextProject = patched.project;
      }
      set({
        project: nextProject,
        workshopStages: nextStages,
        activeStageId,
        mddContent: nextMddContent,
        ...(updatePersistedBaseline ? { mddPersistedBaseline: nextMddContent } : {}),
        documentTimestamps: focused.documentTimestamps,
        uxUiGuideContent: focused.uxUiGuideContent,
        dbgaContent: normalizeWorkshopDocumentForEditor(data.dbgaContent ?? null),
        specContent: focused.specContent,
        phase0SummaryContent: focused.phase0SummaryContent,
        blueprintContent: focused.blueprintContent,
        tasksContent: focused.tasksContent,
        apiContractsContent: focused.apiContractsContent,
        logicFlowsContent: focused.logicFlowsContent,
        architectureContent: focused.architectureContent,
        useCasesContent: focused.useCasesContent,
        userStoriesContent: focused.userStoriesContent,
        infraContent: focused.infraContent,
        aemContent: focused.aemContent,
        uiScreensContent: focused.uiScreensContent,
        agentGovernanceContent: focused.agentGovernanceContent,
        error: null,
        legacyMcpDebugTrace: null,
        synced: true,
        pluginData: (data.pluginData as Record<string, unknown> | null | undefined) ?? {},
      });
      const sessionsRes = await apiFetch(`${API_BASE}/sessions/project/${requestedId}`);
      if (sessionsRes.ok) {
        const sessions: Session[] = await sessionsRes.json();
        if (!shouldApplyWorkshopUpdate(get, requestedId)) return null;
        const scoped = sessions.filter((s) => s.projectId === requestedId);
        set({ session: scoped.length > 0 ? scoped[0] : null });
      }
      if (!shouldApplyWorkshopUpdate(get, requestedId)) return null;
      const sid = get().activeStageId;
      const threadQs = new URLSearchParams({ projectId: requestedId });
      if (sid) threadQs.set("stageId", sid);
      const threadRes = await apiFetch(`${API_BASE}/ai-analysis/mdd/thread?${threadQs.toString()}`).catch(() => null);
      if (threadRes?.ok) {
        const threadData = (await threadRes.json()) as { threadId?: string | null };
        if (shouldApplyWorkshopUpdate(get, requestedId) && threadData.threadId) {
          set({ managerThreadId: threadData.threadId });
        }
      }
      // Break stack to avoid recursion
      setTimeout(() => {
        if (!shouldApplyWorkshopUpdate(get, requestedId)) return;
        get().fetchEstimation(requestedId).catch(() => { });
        get().fetchAdrs(requestedId).catch(() => { });
        get().fetchGenerationStatus(requestedId).catch(() => { });
        get().fetchPlanValidation(requestedId).catch(() => { });
      }, 0);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar proyecto";
      set({ error: msg });
      return null;
    }
  },

  fetchWelcome: async (projectId, activeTab) => {
    const { session, projectId: storeProjectId } = get();
    const pid = (projectId ?? storeProjectId ?? "").trim();
    if (!pid) return;
    set({ loading: true, error: null });
    try {
      const stageWelcome = get().activeStageId;
      const r = await apiFetch(`${API_BASE}/ai-orchestrator/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          sessionId: session?.id,
          activeTab: activeTab ?? undefined,
          ...(stageWelcome ? { stageId: stageWelcome } : {}),
        }),
      });
      if (!r.ok) {
        const payload = await parseApiErrorPayloadFromResponse(r, "Error al cargar bienvenida");
        set({
          ...streamErrorPatch(payload),
          synced: true,
          loading: false,
        });
        return;
      }
      const data: { session: Session; project: Project } = await r.json();
      if (
        !shouldApplyWorkshopUpdate(get, pid) ||
        data.session.projectId !== pid ||
        data.project.id !== pid
      ) {
        return;
      }
      const p = data.project;
      const stages = p.stages ?? [];
      const prev = get().activeStageId;
      const activeStageId = prev && stages.some((s) => s.id === prev) ? prev : pickDefaultStageId(stages);
      const focused = workshopStateFromProjectStage({ ...p, stages }, activeStageId);
      const nextMdd = focused.mddContent || get().mddContent;
      set({
        session: data.session,
        project: focused.project,
        workshopStages: stages,
        activeStageId,
        mddContent: nextMdd,
        mddPersistedBaseline: focused.mddContent || get().mddPersistedBaseline,
        documentTimestamps: focused.documentTimestamps,
        uxUiGuideContent: focused.uxUiGuideContent,
        dbgaContent: focused.project.dbgaContent ?? normalizeWorkshopDocumentForEditor(p.dbgaContent ?? null),
        specContent: focused.specContent,
        phase0SummaryContent: focused.phase0SummaryContent,
        blueprintContent: focused.blueprintContent,
        tasksContent: focused.tasksContent,
        apiContractsContent: focused.apiContractsContent,
        logicFlowsContent: focused.logicFlowsContent,
        architectureContent: focused.architectureContent,
        useCasesContent: focused.useCasesContent,
        userStoriesContent: focused.userStoriesContent,
        infraContent: focused.infraContent,
        aemContent: focused.aemContent,
        uiScreensContent: focused.uiScreensContent,
        synced: true,
        error: null,
      });
    } catch (e) {
      set({
        ...errorStateFromCaught(e),
        synced: true,
      });
    } finally {
      set({ loading: false });
    }
  },

  clearChat: async (projectId, activeTab) => {
    const { session } = get();
    if (!projectId?.trim()) return;
    set({ loading: true, error: null, managerThreadId: null });
    try {
      const r = await apiFetch(`${API_BASE}/ai-orchestrator/clear-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sessionId: session?.id }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message ?? "Error al borrar historial");
      }
      const data: { session: Session | null; project: Project } = await r.json();
      const p = data.project;
      const stages = p.stages ?? [];
      const prev = get().activeStageId;
      const activeStageId = prev && stages.some((s) => s.id === prev) ? prev : pickDefaultStageId(stages);
      const flat = workshopFlatFromStage(p, activeStageId);
      set({
        session: data.session,
        project: { ...p, ...flat },
        activeStageId,
        error: null,
        managerThreadId: null,
        evaluatorCritique: null,
        streamingUserMessage: null,
        streamingUserImages: null,
        streamingContent: null,
        streamingTab: null,
      });
      if (data.session) {
        await get().fetchWelcome(projectId, activeTab);
      }
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Error al borrar historial",
      });
    } finally {
      set({ loading: false });
    }
  },

  formatDocumentForActiveTab: async (activeTab) => {
    const tab = activeTab ?? "mdd";
    const { projectId, project, activeStageId } = get();
    if (!projectId?.trim()) {
      return { ok: false, message: "No hay proyecto activo." };
    }

    const fmt = (raw: string | null | undefined) => formatDocumentMarkdown((raw ?? "").trim());

    const persistProjectField = async (
      field: keyof Project,
      raw: string | null | undefined,
      label: string,
    ): Promise<{ ok: boolean; message: string; changed: boolean }> => {
      const source = (raw ?? "").trim();
      if (!source) return { ok: false, message: `No hay contenido en ${label} para formatear.`, changed: false };
      const formatted = fmt(source);
      const toPersist = cleanDoc(formatted) || formatted;
      const currentProject = get().project;
      const currentServer = cleanDoc(
        String(
          ((currentProject as unknown as Record<string, unknown>)[field as string] as
            | string
            | null
            | undefined) ?? "",
        ),
      ) || String((currentProject as unknown as Record<string, unknown>)[field as string] ?? "");
      const changed = toPersist !== currentServer;
      if (!changed) {
        return { ok: true, message: `${label}: sin cambios detectables tras formatear.`, changed: false };
      }
      const validation = validateDocumentForPersist(currentServer, toPersist, { fieldLabel: label });
      if (!validation.ok) {
        return { ok: false, message: `${label}: ${validation.message}`, changed: false };
      }
      const saved = await persistField(field as string, formatted, get, set);
      if (!saved.ok) {
        return { ok: false, message: `${label}: ${saved.error}`, changed: false };
      }
      set({ [field]: formatted } as Partial<WorkshopState>);
      return {
        ok: true,
        message: `${label} formateado (tablas, SQL pegado, fences). Revisa el panel.`,
        changed: true,
      };
    };

    switch (tab) {
      case "benchmark": {
        const dbga = (get().dbgaContent ?? project?.dbgaContent ?? "").trim();
        const spec = (get().specContent ?? project?.specContent ?? "").trim();
        const p0 = (get().phase0SummaryContent ?? project?.phase0SummaryContent ?? "").trim();
        const parts: string[] = [];
        let anyChanged = false;
        let allOk = true;

        if (dbga.length > 0) {
          const { formatted, strippedMdd, deduplicated } = formatDbgaDocument(dbga);
          const changed = formatted !== dbga;
          if (!changed && !strippedMdd) {
            parts.push("Fase 0 (DBGA): sin cambios detectables tras formatear.");
          } else {
            const dbgaSaved = await persistField("dbgaContent", formatted, get, set);
            if (!dbgaSaved.ok) {
              parts.push(`Fase 0 (DBGA): ${dbgaSaved.error}`);
              allOk = false;
            } else {
              set({ dbgaContent: formatted });
              let msg = deduplicated
                ? "Fase 0 (DBGA) deduplicado y formateado (secciones repetidas fusionadas). Revisa el panel Análisis."
                : "Fase 0 (DBGA) formateado (tablas, SQL, secciones). Revisa el panel Análisis.";
              if (strippedMdd) {
                const kb = Math.round(strippedMdd.length / 1024);
                const mddEmpty = !(get().mddContent ?? project?.mddContent ?? "").trim();
                if (mddEmpty) {
                  const mddSaved = await persistField("mddContent", strippedMdd, get, set);
                  if (mddSaved.ok) {
                    set({ mddContent: strippedMdd });
                    msg += ` MDD duplicado al final del DBGA (~${kb} KB) movido a pestaña MDD (no se borró).`;
                  } else {
                    allOk = false;
                    msg += ` No se pudo mover el MDD embebido: ${mddSaved.error}`;
                  }
                } else {
                  msg += ` Hay un MDD pegado al final del DBGA (~${kb} KB) que se quitó del panel; el MDD del proyecto ya tenía contenido — revísalo en el chat/historial si lo necesitas.`;
                }
              }
              parts.push(msg);
              anyChanged = true;
            }
          }
        }
        if (spec.length > 0) {
          const specBody = cleanDoc(spec) || spec;
          if (isChangelogOnlyDocument(specBody)) {
            parts.push(
              "Fase 0 (Spec): omitido (solo registro de cambios; genera o edita el Spec antes de formatear).",
            );
          } else {
            const r = await persistProjectField("specContent", spec, "Fase 0 (Spec)");
            parts.push(r.message);
            if (!r.ok) allOk = false;
            anyChanged = anyChanged || r.changed;
          }
        }
        if (p0.length > 0) {
          const r = await persistProjectField("phase0SummaryContent", p0, "Benchmark (Deep Research)");
          parts.push(r.message);
          if (!r.ok) allOk = false;
          anyChanged = anyChanged || r.changed;
        }
        if (!dbga && !spec && !p0) {
          return { ok: false, message: "No hay documento en Fase 0 / Benchmark para formatear." };
        }
        return {
          ok: allOk,
          message: anyChanged
            ? parts.join(" ")
            : `${parts.join(" ")} Si el panel no cambió, confirma que estás en la pestaña correcta (Fase 0 vs Benchmark).`,
        };
      }
      case "brd": {
        const sid = activeStageId;
        const st = project?.stages?.find((s) => s.id === sid);
        const brd = (st?.brdContent ?? "").trim();
        if (!brd) return { ok: false, message: "No hay BRD en la etapa activa." };
        if (!sid) return { ok: false, message: "Selecciona una etapa para formatear el BRD." };
        const formatted = fmt(brd);
        if (formatted === brd) {
          return { ok: true, message: "BRD: sin cambios detectables tras formatear." };
        }
        const ok = await get().patchWorkshopStage(sid, { brdContent: formatted });
        return ok
          ? { ok: true, message: "BRD formateado (tablas, Mermaid, fences). Revisa el panel." }
          : { ok: false, message: "No se pudo guardar el BRD formateado." };
      }
      case "mdd-inicial":
      case "legacy": {
        const { activeStageId, workshopStages } = get();
        const stages = workshopStages.length > 0 ? workshopStages : (project?.stages ?? []);
        const doc = legacyCodebaseDocFromStages(stages, activeStageId);
        if (!doc) {
          return {
            ok: false,
            message: "No hay documentación de partida (MDD Inicial / legacy) para formatear.",
          };
        }
        const formatted = fmt(doc);
        const saved = await get().legacyUpdateCodebaseDoc(projectId, formatted);
        return saved
          ? { ok: true, message: "Documentación de partida formateada. Revisa el panel." }
          : { ok: false, message: "No se pudo guardar el documento formateado." };
      }
      case "adrs":
        return { ok: false, message: "ADRs: edita y formatea desde el panel del documento." };
      case "mdd": {
        const source = effectiveMddContentForSectionRegen(get);
        if (!source) return { ok: false, message: "No hay MDD para formatear." };
        const rawFromDb = selectRawMddFromStage(get());
        const repairInput = rawFromDb.length >= source.length ? rawFromDb : source;
        const needsStructuralRepair =
          mddMarkdownNeedsStructuralRepair(repairInput) ||
          mddMarkdownNeedsStructuralRepair(rawFromDb) ||
          mddMarkdownNeedsStructuralRepair(source);
        const hadFormatCorruption =
          mddMarkdownHasKnownFormatCorruption(repairInput) ||
          mddMarkdownHasKnownFormatCorruption(rawFromDb) ||
          mddMarkdownHasKnownFormatCorruption(source);
        const before = normalizedMddForPersistCompare(source);
        await get().persistMddContent(repairInput, { force: true, mddFormatOnly: true });
        const saved = selectPersistedMddBaseline(get());
        set({ mddContent: saved });
        const after = normalizedMddForPersistCompare(saved);
        const stillCorrupt = mddMarkdownHasKnownFormatCorruption(saved);
        if (!needsStructuralRepair && !hadFormatCorruption && after === before) {
          return { ok: true, message: "MDD: ya estaba bien formateado (sin cambios)." };
        }
        if (stillCorrupt) {
          return {
            ok: true,
            message:
              "MDD: se aplicó formato pero aún hay bloques §4 o secciones por revisar manualmente.",
          };
        }
        return {
          ok: true,
          message: needsStructuralRepair || hadFormatCorruption
            ? "MDD reparado (JSON §4, secciones y fences). Revisa el panel."
            : "MDD formateado (headings, fences, tablas y Mermaid). Revisa el panel.",
        };
      }
      case "spec": {
        const raw = (get().specContent ?? project?.specContent ?? "").trim();
        const body = cleanDoc(raw) || raw;
        if (!body) return { ok: false, message: "No hay contenido en Spec para formatear." };
        if (isChangelogOnlyDocument(body)) {
          return {
            ok: false,
            message:
              "Spec: solo tiene registro de cambios. Genera o escribe el Spec antes de formatear.",
          };
        }
        return persistProjectField("specContent", raw, "Spec");
      }
      case "ux-ui-guide":
        return persistProjectField(
          "uxUiGuideContent",
          get().uxUiGuideContent ?? project?.uxUiGuideContent,
          "Guía UX/UI",
        );
      case "blueprint":
        return persistProjectField("blueprintContent", get().blueprintContent, "Blueprint");
      case "tasks":
        return persistProjectField("tasksContent", get().tasksContent, "Tasks");
      case "api-contracts":
        return persistProjectField("apiContractsContent", get().apiContractsContent, "Contratos API");
      case "logic-flows":
        return persistProjectField("logicFlowsContent", get().logicFlowsContent, "Flujos");
      case "architecture":
        return persistProjectField("architectureContent", get().architectureContent, "Arquitectura");
      case "use-cases":
        return persistProjectField("useCasesContent", get().useCasesContent, "Casos de uso");
      case "user-stories":
        return persistProjectField("userStoriesContent", get().userStoriesContent, "Historias de usuario");
      case "infra":
        return persistProjectField("infraContent", get().infraContent, "Infraestructura");
      default:
        return { ok: false, message: `Tab «${tab}» sin documento formateable desde el chat.` };
    }
  },

  sendMessage: async (message, activeTab, options) => {
    const { projectId, session } = get();
    const images = options?.images ?? [];
    const requestProjectId = projectId?.trim() ?? "";
    if (!requestProjectId || (!message.trim() && !images.length)) return;
    const tab = activeTab ?? "mdd";
    const msg = message.trim();
    const regenerateSection = options?.regenerateSection;
    const regenerateSectionGaps = options?.regenerateSectionGaps?.filter((g) => g?.trim()) ?? [];

    if (isFormatDocumentChatCommand(msg) && !images.length) {
      set({ loading: true, error: null, synced: false });
      try {
        const result = await get().formatDocumentForActiveTab(tab);
        if (session?.id) {
          const stageId = get().activeStageId;
          const userRes = await apiFetch(`${API_BASE}/sessions/${session.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: sessionMessageBody({ role: "user", content: msg, tab }, stageId),
          });
          let nextSession = session;
          if (userRes.ok) nextSession = (await userRes.json()) as Session;
          const asstRes = await apiFetch(`${API_BASE}/sessions/${session.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: sessionMessageBody(
              { role: "assistant", content: result.message, tab },
              stageId,
            ),
          });
          if (asstRes.ok) nextSession = (await asstRes.json()) as Session;
          set({ session: nextSession, error: result.ok ? null : result.message });
        } else {
          set({ error: result.ok ? null : result.message });
        }
      } catch (e) {
        set({ error: e instanceof Error ? e.message : "Error al formatear el documento" });
      } finally {
        set({ loading: false });
      }
      return;
    }

    // Comandos /: regenerar §N vía API (projectId + mddContent); sesión de chat opcional (historial).
    if (tab === "mdd" && typeof regenerateSection === "number" && regenerateSection >= 1 && regenerateSection <= 7) {
      set({
        loading: true,
        loadingReason: "mdd-section",
        notice: buildMddSectionRegenNotice(regenerateSection),
        error: null,
        synced: false,
        agentProgress: [],
      });
      try {
        const chatSessionId = session?.id;
        if (chatSessionId) {
          const appendRes = await apiFetch(`${API_BASE}/sessions/${chatSessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: sessionMessageBody({ role: "user", content: msg, tab: "mdd" }, get().activeStageId),
          });
          if (appendRes.ok) {
            const updatedSession = (await appendRes.json()) as Session;
            set({ session: updatedSession });
          }
        }
        const mddContent = effectiveMddContentForSectionRegen(get);
        const regStage = get().activeStageId;
        void get().fetchGenerationStatus(requestProjectId);
        const pollResult = await enqueueAndPollMddJob(
          {
            mode: "section",
            projectId: requestProjectId,
            section: regenerateSection,
            mddContent: mddContent || undefined,
            ...(regenerateSectionGaps.length ? { gapReasons: regenerateSectionGaps } : {}),
            ...(regStage ? { stageId: regStage } : {}),
          },
          requestProjectId,
          {
            onProgress: (p) => {
              patchAgentProgressFromMddEvent(set, p);
            },
          },
        );
        if (!shouldApplyWorkshopUpdate(get, requestProjectId)) return;
        const { fetchProject, fetchEstimation, fetchConformance } = get();
        await fetchProject(requestProjectId);
        const merged = selectPersistedMddBaseline(get()) || get().mddContent || "";
        if (merged.trim().length <= 80) {
          set({
            error:
              merged.trim().length > 0
                ? "La regeneración devolvió un documento demasiado corto; la sección no se aplicó al MDD."
                : "La regeneración terminó sin markdown actualizado.",
            loading: false,
            loadingReason: null,
            notice: null,
            agentProgress: [],
            evaluatorCritique: null,
          });
          return;
        }
        if (regenerateSection === 6 && !mddHasSection6Heading(merged)) {
          set({
            error:
              "El servidor respondió OK pero el MDD no incluye ## 6. Seguridad. Reintenta /seguridad; si persiste, recarga la página.",
            loading: false,
            loadingReason: null,
            notice: null,
            agentProgress: [],
            evaluatorCritique: null,
          });
          return;
        }
        await fetchEstimation(requestProjectId, merged).catch(() => {});
        fetchConformance(requestProjectId).catch(() => {});
        await get().fetchGenerationStatus(requestProjectId, regStage ?? undefined);
        const syncFromJob = (pollResult.result as { mddUpstreamSync?: MddUpstreamSyncStatus } | undefined)
          ?.mddUpstreamSync;
        if (syncFromJob) {
          set((s) => ({
            generationStatus: mergeGenerationStatusWithMddUpstreamSync(s.generationStatus, syncFromJob),
          }));
        }
        const editorMerged = mddContentForEditor(merged);
        const stateAfterFetch = get();
        const mddPatch =
          stateAfterFetch.project != null
            ? applyMddEditorBaselineToWorkshop(
                stateAfterFetch.project,
                stateAfterFetch.workshopStages,
                stateAfterFetch.activeStageId,
                editorMerged,
              )
            : {
                mddContent: editorMerged,
                mddPersistedBaseline: editorMerged,
                workshopStages: stateAfterFetch.workshopStages,
                project: stateAfterFetch.project,
              };
        set({
          ...(stateAfterFetch.project != null
            ? { project: mddPatch.project, workshopStages: mddPatch.workshopStages }
            : {}),
          mddContent: mddPatch.mddContent,
          mddPersistedBaseline: mddPatch.mddPersistedBaseline,
          loading: false,
          loadingReason: null,
          notice: null,
          agentProgress: [],
          evaluatorCritique: null,
          error: null,
        });
        const sessAfterRegen = get().session?.id;
        if (sessAfterRegen) {
          const assistantRes = await apiFetch(`${API_BASE}/sessions/${sessAfterRegen}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: sessionMessageBody(
              {
                role: "assistant",
                content: `Sección §${regenerateSection} regenerada. Revisa el documento en el panel central (pestaña MDD).`,
                tab: "mdd",
              },
              get().activeStageId,
            ),
          });
          if (assistantRes.ok) {
            const sess = (await assistantRes.json()) as Session;
            set({ session: sess });
          }
        }
        return;
      } catch (e) {
        const msg = e instanceof Error ? friendlyFetchError(e) : "Error al regenerar sección";
        const code =
          e instanceof Error && "code" in e && typeof (e as { code?: string }).code === "string"
            ? (e as { code?: string }).code
            : undefined;
        set({
          ...streamErrorPatch({ message: msg, code }),
          loading: false,
          loadingReason: null,
          notice: null,
          agentProgress: [],
          evaluatorCritique: null,
        });
      }
      return;
    }

    if (tab === "mdd" && session?.id) {
      const managerThreadId = get().managerThreadId;
      const pendingPlan = get().pendingPlanApproval;
      const approvingPlan =
        Boolean(pendingPlan?.plan?.length) &&
        managerThreadId != null &&
        isPlanApprovalResumeMessage(msg);
      const wantsManager = true;

      const looksLikeMddDocument =
        msg.length > 500 &&
        /^#\s*Master\s+Design\s+Document/i.test(msg) &&
        /\n##\s*1\.\s*Contexto/i.test(msg);
      const messageToSend = looksLikeMddDocument ? "" : msg;
      const messageForApi =
        messageToSend ||
        (managerThreadId != null ? "sí" : "Quiero refinar el MDD según los requisitos que indiqué.");
      if (looksLikeMddDocument) {
        console.warn("[Workshop] El mensaje parece el documento MDD, no la petición del usuario; se envía texto por defecto al API.");
      }

      if (wantsManager) {
        set({
          loading: true,
          loadingReason: "mdd",
          error: null,
          synced: false,
          agentProgress: [],
          streamingUserMessage: looksLikeMddDocument
            ? messageForApi
            : msg || (images.length ? "(Imagen adjunta)" : ""),
          streamingUserImages: images.length ? images : null,
          pendingPlanApproval: null,
          mddJustGeneratedFromBenchmark: false,
          evaluatorCritique: null,
        });
        try {
          let sessionForManager: Session | null = session;
          if (!looksLikeMddDocument) {
            const appendRes = await apiFetch(`${API_BASE}/sessions/${session.id}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: sessionMessageBody(
                {
                  role: "user",
                  content: msg || (images.length ? "(Imagen adjunta)" : msg),
                  tab: "mdd",
                  ...(images.length ? { images } : {}),
                },
                get().activeStageId,
              ),
            });
            if (!appendRes.ok) throw new Error("Error al enviar mensaje");
            const updatedSession = (await appendRes.json()) as Session;
            sessionForManager = updatedSession;
            set({ session: updatedSession });
          }

          if (approvingPlan && pendingPlan && sessionForManager?.id) {
            const stageId = get().activeStageId;
            for (const content of buildPlanApprovalChatContents(
              pendingPlan.planMessage,
              pendingPlan.plan,
            )) {
              const planArchiveRes = await apiFetch(
                `${API_BASE}/sessions/${sessionForManager.id}/messages`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: sessionMessageBody({ role: "assistant", content, tab: "mdd" }, stageId),
                },
              );
              if (planArchiveRes.ok) {
                sessionForManager = (await planArchiveRes.json()) as Session;
                set({ session: sessionForManager });
              }
            }
          }

          set({ streamingUserMessage: null, streamingUserImages: null });

          const enrichedFromChat = lastMddUserMessageContent(sessionForManager?.chatLog);
          const managerText =
            enrichedFromChat && contentIncludesVisionBlock(enrichedFromChat)
              ? enrichedFromChat
              : messageForApi;
          const imagesForManager =
            images.length > 0 && !contentIncludesVisionBlock(managerText) ? images : [];

          const url =
            managerThreadId != null
              ? `${API_BASE}/ai-analysis/mdd/stream/resume`
              : `${API_BASE}/ai-analysis/mdd/stream/manager`;
          const mddStage = get().activeStageId;
          const draftForMdd = (get().mddContent ?? get().project?.mddContent ?? "").trim() || undefined;
          const mddSnapshotBeforeStream = draftForMdd ?? "";
          const body =
            managerThreadId != null
              ? {
                projectId: requestProjectId,
                threadId: managerThreadId,
                userMessage: managerText,
                mddContent: draftForMdd,
                ...(imagesForManager.length ? { images: imagesForManager } : {}),
              }
              : {
                projectId: requestProjectId,
                dbgaContent: (get().dbgaContent ?? get().project?.dbgaContent ?? "").trim() || undefined,
                initialMessage: managerText,
                mddContent: draftForMdd,
                ...(mddStage ? { stageId: mddStage } : {}),
                ...(imagesForManager.length ? { images: imagesForManager } : {}),
              };
          const r = await apiFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!r.ok) {
            await throwStreamHttpError(r, "Error en el flujo MDD");
          }
          const reader = r.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                for (const raw of parseNdjsonLine(line)) {
                try {
                  const event = raw as {
                    type: string;
                    agent?: string;
                    message?: string;
                    reply?: string;
                    questions?: string[];
                    threadId?: string;
                    markdown?: string;
                    precision?: number;
                    status?: "red" | "yellow" | "green";
                    precisionBreakdown?: PrecisionBreakdown;
                    auditorFeedback?: string;
                    auditTrail?: string[];
                    /** Plan para aprobación (HITL 4.4) */
                    plan?: Array<{ step_id: string; task_description: string; node: string }>;
                    planMessage?: string;
                    code?: string;
                  };
                  if (event.type === "progress" && event.agent != null && event.message != null) {
                    set((s) => {
                      if ((s.projectId ?? s.project?.id ?? "").trim() !== requestProjectId) return s;
                      return {
                        agentProgress: mergeAgentProgressFromMddEvent(s.agentProgress, {
                          agent: event.agent!,
                          message: event.message!,
                        }),
                      };
                    });
                  } else if (event.type === "draft" && event.markdown != null && event.markdown.trim().length > 80) {
                    if (!shouldApplyWorkshopUpdate(get, requestProjectId)) continue;
                    const draftGate = deliveryGateFromStreamEvent(event as { deliveryGate?: MddDeliveryGateResult });
                    const currentMdd = get().mddContent ?? "";
                    if (streamMarkdownPreservesGovernancePatterns(currentMdd, event.markdown)) {
                      set({
                        mddContent: mddContentForEditor(event.markdown),
                        ...(draftGate ? { deliveryGate: draftGate } : {}),
                      });
                    }
                  } else if (event.type === "interrupt") {
                    set({
                      managerThreadId: event.threadId ?? get().managerThreadId ?? null,
                      pendingPlanApproval:
                        Array.isArray(event.plan) && event.plan.length > 0
                          ? { plan: event.plan, planMessage: event.planMessage ?? "¿Ejecutar este plan?" }
                          : null,
                    });
                    if (event.markdown != null && event.markdown.trim().length > 80) {
                      const incoming = event.markdown.trim();
                      const unchanged =
                        mddSnapshotBeforeStream.length > 80 && incoming === mddSnapshotBeforeStream;
                      const replyClaimsEdit =
                        typeof event.reply === "string" &&
                        /\b(ajust|elimin|actualiz|modific|ya no contiene|sin referencias)\b/i.test(
                          event.reply,
                        );
                      if (unchanged && replyClaimsEdit) {
                        set({
                          error:
                            "El chat indicó cambios pero el MDD no se actualizó. Revisa si hay un plan pendiente de aprobar, o usa /infraestructura o /seguridad para forzar la regeneración.",
                        });
                      }
                      const currentMdd = get().mddContent ?? "";
                      if (streamMarkdownPreservesGovernancePatterns(currentMdd, incoming)) {
                        set({ mddContent: mddContentForEditor(incoming) });
                        if (!unchanged) {
                          await persistMddFromChatStream(get, set, incoming, requestProjectId);
                        }
                      }
                    }

                    // No sobrescribir mddContent con markdown vacío (auditar puede venir de checkpoint sin draft)
                    const precisionBreakdown = (event as any).precisionBreakdown;
                    const auditTrail = (event as any).auditTrail;
                    const auditorFeedback = (event as any).auditorFeedback;
                    const interruptGate = deliveryGateFromStreamEvent(event as { deliveryGate?: MddDeliveryGateResult });

                    // Actualizar estado para el semáforo/modal, NO enviar al chat
                    if (precisionBreakdown || auditTrail || auditorFeedback || interruptGate) {
                      set({
                        precisionBreakdown: precisionBreakdown ?? get().precisionBreakdown,
                        auditTrail: auditTrail ?? get().auditTrail,
                        auditorFeedback: auditorFeedback ?? get().auditorFeedback,
                        ...(interruptGate ? { deliveryGate: interruptGate } : {}),
                      });
                    }

                    const hasPlanForApproval =
                      Array.isArray(event.plan) && event.plan.length > 0;
                    // plan_approval: PlanApprovalCard ya muestra planMessage + tabla «Tareas y responsables»;
                    // no duplicar el mismo texto como burbuja en el historial del chat.
                    const clarifierContent = hasPlanForApproval
                      ? null
                      : event.reply != null && event.reply !== ""
                        ? event.reply
                        : Array.isArray(event.questions) && event.questions.length > 0
                          ? event.questions.join("\n\n")
                          : "Responde en el chat para continuar con la entrevista (objetivos del sistema, integraciones, etc.).";

                    let sess = get().session;
                    if (clarifierContent) {
                      const appendAssistant = await apiFetch(`${API_BASE}/sessions/${session.id}/messages`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: sessionMessageBody(
                          { role: "assistant", content: clarifierContent, tab: "mdd" },
                          get().activeStageId,
                        ),
                      });
                      if (appendAssistant.ok) {
                        sess = (await appendAssistant.json()) as Session;
                        set({ session: sess });
                      }
                    }
                    set({
                      loading: false,
                      loadingReason: null,
                      agentProgress: [],
                      streamingUserMessage: null,
                      streamingUserImages: null,
                      streamingContent: null,
                      evaluatorCritique: null,
                    });
                    return;
                  } else if (event.type === "done" && event.markdown != null) {
                    set({ managerThreadId: null, pendingPlanApproval: null });
                    const markdownOk = event.markdown.trim().length > 80;
                    const mddBeforeFetch = (get().mddContent ?? "").trim();
                    if (
                      markdownOk &&
                      streamMarkdownPreservesGovernancePatterns(mddBeforeFetch, event.markdown)
                    ) {
                      set({ mddContent: mddContentForEditor(event.markdown) });
                    }

                    const precisionBreakdown = (event as any).precisionBreakdown;
                    const auditTrail = (event as any).auditTrail;
                    const auditorFeedback = (event as any).auditorFeedback;
                    const doneGate = deliveryGateFromStreamEvent(event as { deliveryGate?: MddDeliveryGateResult });

                    if (precisionBreakdown || auditTrail || auditorFeedback || doneGate) {
                      set({
                        precisionBreakdown: precisionBreakdown ?? get().precisionBreakdown,
                        auditTrail: auditTrail ?? get().auditTrail,
                        auditorFeedback: auditorFeedback ?? get().auditorFeedback,
                        ...(doneGate ? { deliveryGate: doneGate } : {}),
                      });
                    }

                    if (markdownOk) {
                      await persistMddFromChatStream(get, set, event.markdown, requestProjectId);
                    } else if (mddBeforeFetch.length > 80) {
                      // `done` con markdown corto (p. ej. placeholder) no debe vaciar borradores ya mostrados por eventos `draft`.
                      const current = get();
                      const flat = workshopFlatFromStage(current.project as Project, get().activeStageId);
                      const serverMdd = (normalizeWorkshopDocumentForEditor(flat.mddContent) ?? "").trim();
                      if (serverMdd.length < mddBeforeFetch.length) {
                        set({
                          mddContent: mddBeforeFetch,
                          project: current.project ? { ...current.project, mddContent: mddBeforeFetch } : current.project,
                        });
                      }
                    }

                    const assistantContent = "MDD generado. Revisa el documento en el panel central.";
                    const assistantRes = await apiFetch(`${API_BASE}/sessions/${session.id}/messages`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: sessionMessageBody(
                        { role: "assistant", content: assistantContent, tab: "mdd" },
                        get().activeStageId,
                      ),
                    });
                    if (assistantRes.ok) {
                      const sess = (await assistantRes.json()) as Session;
                      set({ session: sess });
                    }
                    set({
                      loading: false,
                      loadingReason: null,
                      agentProgress: [],
                      streamingUserMessage: null,
                      streamingUserImages: null,
                      streamingContent: null,
                      pendingPlanApproval: null,
                      evaluatorCritique: null,
                    });
                    return;
                  } else if (event.type === "blocked" && event.message) {
                    set({
                      managerThreadId: null,
                      pendingPlanApproval: null,
                      error: String(event.message),
                      loading: false,
                      loadingReason: null,
                      agentProgress: [],
                      streamingUserMessage: null,
                      streamingUserImages: null,
                      streamingContent: null,
                      evaluatorCritique: null,
                    });
                    return;
                  } else if (event.type === "error" && event.message) {
                    set({
                      managerThreadId: null,
                      pendingPlanApproval: null,
                      ...streamErrorPatch(event as { message: string; code?: string }),
                      loading: false,
                      loadingReason: null,
                      agentProgress: [],
                      streamingUserMessage: null,
                      streamingUserImages: null,
                      streamingContent: null,
                      evaluatorCritique: null,
                    });
                    return;
                  }
                } catch (_) {
                  // ignore
                }
                }
              }
            }
          }
        } catch (e) {
          const msg = friendlyFetchError(e);
          const code =
            e instanceof Error && "code" in e && typeof (e as { code?: string }).code === "string"
              ? (e as { code?: string }).code
              : undefined;
          set({
            managerThreadId: null,
            pendingPlanApproval: null,
            ...streamErrorPatch({ message: msg, code }),
            loading: false,
            loadingReason: null,
            agentProgress: [],
            streamingUserMessage: null,
            streamingUserImages: null,
            evaluatorCritique: null,
          });
          return;
        }
      }

      // No encadenar `ai-orchestrator/chat/stream` tras el Manager MDD: un segundo stream vaciaba el
      // panel (done del orquestador trae `project` sin MDD persistido) y duplicaba respuesta en chat.
      set({
        loading: false,
        loadingReason: null,
        agentProgress: [],
        streamingUserMessage: null,
        streamingUserImages: null,
        streamingContent: null,
        streamingTab: null,
      });
      return;
    } else {
      // Chat genérico para Guía UX/UI, benchmark, spec, etc. (tabs que no usan el flujo MDD/Manager)
      set({
        loading: true,
        error: null,
        synced: false,
        streamingUserMessage: msg || (images.length ? "(Imagen adjunta)" : ""),
        streamingUserImages: images.length ? images : null,
        streamingContent: "",
        streamingTab: tab,
        evaluatorCritique: null,
      });
      const orchestratorDocSnapshotBefore = orchestratorDocSnapshot(get(), tab);
      try {
        const body: Record<string, unknown> = {
          projectId: requestProjectId,
          sessionId: session?.id,
          message: msg || "",
          activeTab: tab,
        };
        if (tab === "mdd") {
          body.mddContent = get().mddContent || undefined;
        }
        if (tab === "ux-ui-guide") {
          body.uxUiGuideContent = get().uxUiGuideContent ?? get().project?.uxUiGuideContent ?? undefined;
        }
        {
          const sf = get().activeStageId;
          if (sf) body.stageId = sf;
        }
        if (tab === "benchmark") {
          const dbga = get().dbgaContent ?? get().project?.dbgaContent ?? null;
          if (dbga != null) body.dbgaContent = dbga;
        }
        if (tab === "brd") {
          const aid = get().activeStageId;
          const st = get().project?.stages?.find((x) => x.id === aid);
          if (tab === "brd") body.brdContent = st?.brdContent ?? "";
        }
        if (tab === "spec") {
          const sc = get().specContent ?? get().project?.specContent;
          if (sc != null && String(sc).trim()) body.specContent = sc;
        }
        if (tab === "architecture") {
          const ac = get().architectureContent ?? get().project?.architectureContent;
          if (ac != null && String(ac).trim()) body.architectureContent = ac;
        }
        if (tab === "blueprint") {
          const bc = get().blueprintContent;
          if (bc != null && String(bc).trim()) body.blueprintContent = bc;
        }
        if (tab === "use-cases") {
          const uc = get().useCasesContent;
          if (uc != null && String(uc).trim()) body.useCasesContent = uc;
        }
        if (tab === "user-stories") {
          const us = get().userStoriesContent;
          if (us != null && String(us).trim()) body.userStoriesContent = us;
        }
        if (tab === "api-contracts") {
          const ac = get().apiContractsContent;
          if (ac != null && String(ac).trim()) body.apiContractsContent = ac;
        }
        if (tab === "logic-flows") {
          const lf = get().logicFlowsContent;
          if (lf != null && String(lf).trim()) body.logicFlowsContent = lf;
        }
        if (tab === "tasks") {
          const tc = get().tasksContent;
          if (tc != null && String(tc).trim()) body.tasksContent = tc;
        }
        if (tab === "infra") {
          const ic = get().infraContent;
          if (ic != null && String(ic).trim()) body.infraContent = ic;
        }
        if (images.length) body.images = images;
        const r = await apiFetch(`${API_BASE}/ai-orchestrator/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.message ?? "Error en la entrevista");
        }
        const reader = r.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        if (!reader) throw new Error("No se pudo leer el stream");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";
          for (const block of lines) {
            let event = "";
            let dataStr = "";
            for (const line of block.split("\n")) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
            }
            if (!event || !dataStr) continue;
            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              if (event === "chunk" && typeof data.content === "string") {
                set((s) => {
                  if ((s.projectId ?? s.project?.id ?? "").trim() !== requestProjectId) return s;
                  return { streamingContent: (s.streamingContent ?? "") + data.content };
                });
              } else if (event === "done") {
                if (!shouldApplyWorkshopUpdate(get, requestProjectId)) continue;
                const sess = data.session as Session | undefined;
                if (sess && sess.projectId !== requestProjectId) continue;
                const proj = data.project as Project | undefined;
                if (proj && proj.id !== requestProjectId) continue;
                const docUnchangedError = resolveOrchestratorDocUnchangedError({
                  tab,
                  snapshotBefore: orchestratorDocSnapshotBefore,
                  data,
                  snapshotSource: get(),
                  userMessage: msg,
                  session: sess,
                });
                const uxFromApi = (data.uxUiGuideContent ?? proj?.uxUiGuideContent) as string | null | undefined;
                const packed = projectWithUxAfterStream(proj, uxFromApi, get().activeStageId);
                const nextStages = packed?.project?.stages ?? proj?.stages;
                const freshUx = cleanDoc(uxFromApi ?? get().uxUiGuideContent ?? null);
                const nextMdd = packed?.mddContent ?? get().mddContent;
                set({
                  session: sess ?? get().session,
                  project: packed?.project ?? get().project,
                  activeStageId: packed?.activeStageId ?? get().activeStageId,
                  mddContent: nextMdd,
                  ...(packed?.mddContent != null ? { mddPersistedBaseline: packed.mddContent } : {}),
                  workshopStages: nextStages && nextStages.length > 0 ? nextStages : get().workshopStages,
                  uxUiGuideContent: freshUx,
                  dbgaContent:
                    packed?.project?.dbgaContent ??
                    normalizeWorkshopDocumentForEditor(
                      (data.dbgaContent as string | null | undefined) ??
                        proj?.dbgaContent ??
                        null,
                    ) ??
                    get().dbgaContent,
                  phase0SummaryContent:
                    cleanDoc(
                      (data.phase0SummaryContent as string | null | undefined) ??
                        proj?.phase0SummaryContent ??
                        null,
                    ) ?? get().phase0SummaryContent,
                  specContent: cleanDoc(proj?.specContent ?? null) ?? get().specContent,
                  architectureContent: cleanDoc(proj?.architectureContent ?? null) ?? get().architectureContent,
                  useCasesContent: cleanDoc(proj?.useCasesContent ?? null) ?? get().useCasesContent,
                  userStoriesContent: cleanDoc(proj?.userStoriesContent ?? null) ?? get().userStoriesContent,
                  blueprintContent: cleanDoc(proj?.blueprintContent ?? null) ?? get().blueprintContent,
                  apiContractsContent: cleanDoc(proj?.apiContractsContent ?? null) ?? get().apiContractsContent,
                  logicFlowsContent: cleanDoc(proj?.logicFlowsContent ?? null) ?? get().logicFlowsContent,
                  tasksContent: cleanDoc(proj?.tasksContent ?? null) ?? get().tasksContent,
                  infraContent: cleanDoc(proj?.infraContent ?? null) ?? get().infraContent,
                  streamingUserMessage: null,
                  streamingUserImages: null,
                  streamingContent: null,
                  streamingTab: null,
                  synced: true,
                  error: docUnchangedError,
                  evaluatorCritique: pickEvaluatorCritique(data),
                });
                // Auto-persist UX/UI guide when the orchestrator returns content on its tab
                if (tab === "ux-ui-guide" && freshUx && !docUnchangedError) {
                  get().persistUxUiGuideContent(freshUx).catch(() => {});
                }
              } else if (event === "error" && data.error) {
                set({
                  error: String(data.error),
                  streamingUserMessage: null,
                  streamingUserImages: null,
                  streamingContent: null,
                  streamingTab: null,
                  synced: true,
                });
              }
            } catch (_) {
              // ignore parse errors for partial chunks
            }
          }
        }
        if (buffer.trim()) {
          let event = "";
          let dataStr = "";
          for (const line of buffer.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
          }
          if (event && dataStr) {
            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              if (event === "chunk" && typeof data.content === "string") {
                set((s) => {
                  if ((s.projectId ?? s.project?.id ?? "").trim() !== requestProjectId) return s;
                  return { streamingContent: (s.streamingContent ?? "") + data.content };
                });
              } else if (event === "done") {
                const sessTail = data.session as Session | undefined;
                const projTail = data.project as Project | undefined;
                const scopeOk =
                  shouldApplyWorkshopUpdate(get, requestProjectId) &&
                  (!sessTail?.projectId || sessTail.projectId === requestProjectId) &&
                  (!projTail?.id || projTail.id === requestProjectId);
                if (scopeOk) {
                  const docUnchangedError = resolveOrchestratorDocUnchangedError({
                    tab,
                    snapshotBefore: orchestratorDocSnapshotBefore,
                    data,
                    snapshotSource: get(),
                    userMessage: msg,
                    session: sessTail,
                  });
                  const uxFromApi = (data.uxUiGuideContent ?? projTail?.uxUiGuideContent) as
                    | string
                    | null
                    | undefined;
                  const packed = projectWithUxAfterStream(projTail, uxFromApi, get().activeStageId);
                  const nextStagesB = packed?.project?.stages ?? projTail?.stages;
                  const freshUx = cleanDoc(uxFromApi ?? get().uxUiGuideContent ?? null);
                  const nextMddTail = packed?.mddContent ?? get().mddContent;
                  set({
                    session: sessTail ?? get().session,
                    project: packed?.project ?? get().project,
                    activeStageId: packed?.activeStageId ?? get().activeStageId,
                    mddContent: nextMddTail,
                    ...(packed?.mddContent != null ? { mddPersistedBaseline: packed.mddContent } : {}),
                    workshopStages: nextStagesB && nextStagesB.length > 0 ? nextStagesB : get().workshopStages,
                    uxUiGuideContent: freshUx,
                    dbgaContent:
                      packed?.project?.dbgaContent ??
                      normalizeWorkshopDocumentForEditor(
                        (data.dbgaContent as string | null | undefined) ??
                          projTail?.dbgaContent ??
                          null,
                      ) ??
                      get().dbgaContent,
                    phase0SummaryContent:
                      cleanDoc(
                        (data.phase0SummaryContent as string | null | undefined) ??
                          projTail?.phase0SummaryContent ??
                          null,
                      ) ?? get().phase0SummaryContent,
                    specContent: cleanDoc(projTail?.specContent ?? null) ?? get().specContent,
                    blueprintContent: cleanDoc(projTail?.blueprintContent ?? null) ?? get().blueprintContent,
                    apiContractsContent: cleanDoc(projTail?.apiContractsContent ?? null) ?? get().apiContractsContent,
                    logicFlowsContent: cleanDoc(projTail?.logicFlowsContent ?? null) ?? get().logicFlowsContent,
                    tasksContent: cleanDoc(projTail?.tasksContent ?? null) ?? get().tasksContent,
                    architectureContent: cleanDoc(projTail?.architectureContent ?? null) ?? get().architectureContent,
                    useCasesContent: cleanDoc(projTail?.useCasesContent ?? null) ?? get().useCasesContent,
                    userStoriesContent: cleanDoc(projTail?.userStoriesContent ?? null) ?? get().userStoriesContent,
                    infraContent: cleanDoc(projTail?.infraContent ?? null) ?? get().infraContent,
                    streamingUserMessage: null,
                    streamingUserImages: null,
                    streamingContent: null,
                    streamingTab: null,
                    synced: true,
                    error: docUnchangedError,
                    evaluatorCritique: pickEvaluatorCritique(data),
                  });
                  if (tab === "ux-ui-guide" && freshUx && !docUnchangedError) {
                    get().persistUxUiGuideContent(freshUx).catch(() => {});
                  }
                }
              } else if (event === "error" && data.error) {
                set({
                  error: String(data.error),
                  streamingUserMessage: null,
                  streamingUserImages: null,
                  streamingContent: null,
                  streamingTab: null,
                  synced: true,
                });
              }
            } catch (_) {
              // ignore
            }
          }
        }
      } catch (e) {
        set({
          error: e instanceof Error ? friendlyFetchError(e) : "Error al enviar",
          streamingUserMessage: null,
          streamingUserImages: null,
          streamingContent: null,
          streamingTab: null,
          synced: true,
        });
      } finally {
        set({ loading: false });
      }
    }
  },

  updateMddContent: (content) => set({ mddContent: mddContentForEditor(content) }),

  setUxUiGuideContent: (content) => set({ uxUiGuideContent: content }),
  persistUxUiGuideContent: async (content) => {
    await persistField("uxUiGuideContent", content, get, set);
  },

  persistUxGuideDesignRef: async (ref) => {
    const { projectId, project } = get();
    if (!projectId || !project) return false;
    const normalized = ref?.trim() || null;
    if (normalized === (project.uxGuideDesignRef ?? null)) return true;
    set({ synced: false, error: null });
    try {
      const r = await fetchWithRetry(`${API_BASE}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uxGuideDesignRef: normalized }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as Project;
      set({ project: data, synced: true, error: null });
      return true;
    } catch (e) {
      set({ error: friendlyFetchError(e), synced: false });
      return false;
    }
  },

  setBlueprintContent: (content) => set({ blueprintContent: content }),

  persistBlueprintContent: async (content) => {
    await persistField("blueprintContent", content, get, set);
  },

  generateBlueprint: async (projectId, options) => {
    if (!projectId?.trim()) return null;
    // Preview mode eliminado — regeneración directa
    // Normal: encolar con queueAndPoll
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = {};
      if (options?.gapsFeedback?.trim()) body.gapsFeedback = options.gapsFeedback.trim();
      const stageId = get().activeStageId;
      if (stageId) body.stageId = stageId;
      const data = await queueAndPoll<Project>(`${API_BASE}/projects/${projectId}/generate-blueprint`, body);
      const raw = data.blueprintContent ?? "";
      const cleaned = raw.replace(/^\s*```(?:markdown)?\s*/i, "").replace(/^\s*```\s*/, "").replace(/\s*```\s*$/, "");
      const stages = data.stages ?? get().project?.stages ?? [];
      const merged: Project = {
        ...data,
        stages: stageId
          ? stages.map((s) => (s.id === stageId ? { ...s, blueprintContent: cleaned || null } : s))
          : stages,
      };
      const focused = workshopStateFromProjectStage(merged, get().activeStageId);
      set({ project: focused.project, blueprintContent: focused.blueprintContent, error: null });
      get().fetchConformance(projectId).catch(() => { });
      return focused.project;
    } catch (e) {
      set({ error: friendlyFetchError(e) });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  setApiContractsContent: (content) => set({ apiContractsContent: content }),
  persistApiContractsContent: async (content) => {
    await persistField("apiContractsContent", content, get, set);
  },
  generateApiContracts: async (projectId, options) => {
    if (!projectId?.trim()) return null;
    const conformancePreCheck = () => {
      const dm = get().conformance?.blueprintDataModel;
      if (dm && !dm.ok) {
        const hint = dm.gaps.length ? ` (${dm.gaps.slice(0, 2).join("; ")}${dm.gaps.length > 2 ? "…" : ""})` : "";
        set({ error: `El Blueprint debe cubrir el modelo de datos del MDD (§3) antes de generar Contratos API.${hint}` });
        return false;
      }
      return true;
    };
    // Preview mode eliminado — regeneración directa
    await get().fetchConformance(projectId.trim());
    if (!conformancePreCheck()) return null;
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = {};
      if (options?.gapsFeedback?.trim()) body.gapsFeedback = options.gapsFeedback.trim();
      const proj = await queueAndPoll<Project>(`${API_BASE}/projects/${projectId}/generate-api-contracts`, body);
      set({ project: proj, apiContractsContent: proj.apiContractsContent ?? null, error: null });
      get().fetchConformance(projectId).catch(() => { });
      return proj;
    } catch (e) { set({ error: friendlyFetchError(e) }); return null; }
    finally { set({ loading: false }); }
  },

  setLogicFlowsContent: (content) => set({ logicFlowsContent: content }),
  persistLogicFlowsContent: async (content) => {
    await persistField("logicFlowsContent", content, get, set);
  },
  generateLogicFlows: async (projectId, options) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = {};
      if (options?.gapsFeedback?.trim()) body.gapsFeedback = options.gapsFeedback.trim();
      const data = await queueAndPoll<Project>(`${API_BASE}/projects/${projectId}/generate-logic-flows`, body);
      set({ project: data, logicFlowsContent: data.logicFlowsContent ?? null, error: null });
      get().fetchConformance(projectId).catch(() => { });
      get().fetchProject(projectId).catch(() => { });
      return data;
    } catch (e) { set({ error: friendlyFetchError(e) }); return null; }
    finally { set({ loading: false }); }
  },

  setInfraContent: (content) => set({ infraContent: content }),
  persistInfraContent: async (content) => {
    await persistField("infraContent", content, get, set);
  },
  generateInfra: async (projectId, options) => {
    if (!projectId?.trim()) return null;
    // Preview mode eliminado — regeneración directa
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = {};
      if (options?.gapsFeedback?.trim()) body.gapsFeedback = options.gapsFeedback.trim();
      const proj = await queueAndPoll<Project>(`${API_BASE}/projects/${projectId}/generate-infra`, body);
      set({ project: proj, infraContent: proj.infraContent ?? null, error: null });
      get().fetchConformance(projectId).catch(() => { });
      return proj;
    } catch (e) { set({ error: friendlyFetchError(e) }); return null; }
    finally { set({ loading: false }); }
  },

  setArchitectureContent: (content) => set({ architectureContent: content }),
  persistArchitectureContent: async (content) => {
    await persistField("architectureContent", content, get, set);
  },
  generateArchitecture: async (projectId) => {
    if (!projectId?.trim()) return null;
    // Preview mode eliminado — regeneración directa
    set({ loading: true, error: null });
    try {
      const proj = await queueAndPoll<Project>(`${API_BASE}/projects/${projectId}/generate-architecture`, {});
      set({ project: proj, architectureContent: proj.architectureContent ?? null, error: null });
      return proj;
    } catch (e) { set({ error: friendlyFetchError(e) }); return null; }
    finally { set({ loading: false }); }
  },

  setUseCasesContent: (content) => set({ useCasesContent: content }),
  persistUseCasesContent: async (content) => {
    await persistField("useCasesContent", content, get, set);
  },
  generateUseCases: async (projectId) => {
    if (!projectId?.trim()) return null;
    // Preview mode eliminado — regeneración directa
    set({ loading: true, error: null });
    try {
      const proj = await queueAndPoll<Project>(`${API_BASE}/projects/${projectId}/generate-use-cases`, {});
      set({ project: proj, useCasesContent: proj.useCasesContent ?? null, error: null });
      return proj;
    } catch (e) { set({ error: friendlyFetchError(e) }); return null; }
    finally { set({ loading: false }); }
  },

  setUserStoriesContent: (content) => set({ userStoriesContent: content }),
  persistUserStoriesContent: async (content) => {
    await persistField("userStoriesContent", content, get, set);
  },
  generateUserStories: async (projectId) => {
    if (!projectId?.trim()) return null;
    // Preview mode eliminado — regeneración directa
    set({ loading: true, error: null });
    try {
      const proj = await queueAndPoll<Project>(`${API_BASE}/projects/${projectId}/generate-user-stories`, {});
      set({ project: proj, userStoriesContent: proj.userStoriesContent ?? null, error: null });
      return proj;
    } catch (e) { set({ error: friendlyFetchError(e) }); return null; }
    finally { set({ loading: false }); }
  },

  setSpecContent: (content) => set({ specContent: content }),
  persistSpecContent: async (content) => {
    await persistField("specContent", content, get, set);
  },
  setAemContent: (content) => set({ aemContent: content }),
  persistAemContent: async (content) => {
    await persistField("aemContent", content, get, set);
  },
  /** POST …/projects/:id/generate-aem — Benchmark + Fase 0 + BRD → AEM + dictamen inversión digital. */
  generateAem: async (projectId, opts) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "aem", error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/generate-aem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketScope: opts.marketScope }),
      });
      const raw = await r.text();
      if (!r.ok) {
        let errMessage = "Error al generar AEM";
        try {
          const err = JSON.parse(raw) as { message?: string };
          if (err?.message) errMessage = err.message;
        } catch {
          if (raw.trim().length > 0 && raw.length < 500) errMessage = raw;
        }
        throw new Error(errMessage);
      }
      let data: Project;
      try {
        data = JSON.parse(raw) as Project;
      } catch {
        throw new Error("El servidor devolvió una respuesta inválida al generar AEM.");
      }
      set({ project: data, aemContent: data.aemContent ?? null, error: null });
      return data;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al generar AEM" });
      return null;
    } finally {
      set({ loading: false, loadingReason: null });
    }
  },

  setUiScreensContent: (content) => set({ uiScreensContent: content }),
  syncUiScreens: async (projectId) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/ui-screens/sync`, {
        method: "POST",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message ?? "Error al sincronizar Pantallas");
      }
      const data = (await r.json()) as { content?: string | null };
      const content = data.content ?? null;
      const current = get().project;
      set({
        uiScreensContent: content,
        project: current ? { ...current, uiScreensContent: content } : current,
      });
      return content;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al sincronizar Pantallas" });
      return null;
    } finally {
      set({ loading: false });
    }
  },
  generateSpec: async (projectId) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, error: null });
    try {
      const data = await queueAndPoll<Project>(`${API_BASE}/projects/${projectId}/generate-spec`, {});
      const raw = data.specContent ?? "";
      const cleaned = raw.replace(/^\s*```(?:markdown)?\s*/i, "").replace(/^\s*```\s*/, "").replace(/\s*```\s*$/, "");
      const newData = { ...data, specContent: cleaned || null };
      set({ project: newData, specContent: cleaned || null, error: null });
      void get().fetchGenerationStatus(projectId);
      return newData;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al generar Spec" });
      return null;
    } finally {
      set({ loading: false });
    }
  },
  setTasksContent: (content) => set({ tasksContent: content }),
  persistTasksContent: async (content) => {
    await persistField("tasksContent", content, get, set);
  },
  generateTasks: async (projectId, options) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, error: null });
    try {
      const qs = options?.acknowledgeGaps === true ? "?acknowledgeGaps=true" : "";
      const data = await queueAndPoll<Project>(
        `${API_BASE}/projects/${projectId}/generate-tasks${qs}`,
        {},
      );
      const nextStages = data.stages ?? get().workshopStages;
      set({
        project: data,
        tasksContent: data.tasksContent ?? null,
        workshopStages: nextStages.length > 0 ? nextStages : get().workshopStages,
        error: null,
      });
      void get().fetchGenerationStatus(projectId);
      void get().fetchPlanValidation(projectId);
      return data;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al generar Tasks" });
      return null;
    } finally {
      set({ loading: false });
    }
  },
  requestGenerateTasks: async (projectId) => {
    if (!projectId?.trim()) return null;
    const gate = get().deliveryGate;
    let acknowledgeGaps = false;
    if (hasDeliveryGateBlockers(gate)) {
      const ok = window.confirm(
        "El gate MDD tiene gaps conocidos. ¿Generar Tasks igual? Se relajará el pre-flight upstream (DocAccuracy medio / gate MDD).",
      );
      if (!ok) return null;
      acknowledgeGaps = true;
    }
    return get().generateTasks(projectId, { acknowledgeGaps });
  },
  generateAgentGovernance: async (projectId) => {
    if (!projectId?.trim()) return null;
    const beforeLen = get().agentGovernanceContent?.length ?? 0;
    console.warn(
      `[agent-gov] workshop generateAgentGovernance start projectId=${projectId} force=true beforeLen=${beforeLen}`,
    );
    set({
      loading: true,
      loadingReason: "agent-governance",
      error: null,
      agentProgress: createAgentGovernanceProgressItems(),
    });

    const stepTimer = setInterval(() => {
      set((s) => {
        if (s.loadingReason !== "agent-governance") return s;
        return { agentProgress: advanceAgentGovernanceProgressItems(s.agentProgress) };
      });
    }, 12_000);

    try {
      const data = await queueAndPoll<Project>(
        `${API_BASE}/projects/${projectId}/generate-agent-governance`,
        { force: true },
      );
      const afterLen = data.agentGovernanceContent?.length ?? 0;
      console.warn(
        `[agent-gov] workshop generateAgentGovernance complete projectId=${projectId} beforeLen=${beforeLen} afterLen=${afterLen} preview=${(data.agentGovernanceContent ?? "").slice(0, 80)}`,
      );
      set({
        project: data,
        agentGovernanceContent: data.agentGovernanceContent ?? null,
        error: null,
        agentProgress: completeAgentGovernanceProgressItems(),
      });
      return data;
    } catch (e) {
      console.warn(
        `[agent-gov] workshop generateAgentGovernance failed projectId=${projectId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      set({
        error: e instanceof Error ? e.message : "Error al generar gobernanza de agentes",
        agentProgress: [],
      });
      return null;
    } finally {
      clearInterval(stepTimer);
      set({ loading: false, loadingReason: null, agentProgress: [] });
    }
  },
  fetchAgentGovernanceExport: async (projectId) => {
    if (!projectId?.trim()) return null;
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/agent-governance-export`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al preparar ZIP de gobernanza");
      }
      const scaffold = (await r.json()) as import("@theforge/shared-types").AgentGovernanceScaffold;
      return scaffold;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Error al preparar ZIP de gobernanza",
      });
      return null;
    }
  },
  generateDeliverablesCascade: async (projectId, options) => {
    if (!projectId?.trim()) return null;
    const pid = projectId.trim();
    const acknowledgeGaps = options?.acknowledgeGaps === true;
    const complexity = get().project?.complexity ?? "HIGH";
    const allStepLabels = deliverableStepLabelsForComplexity(complexity);
    set({
      loading: true,
      loadingReason: "deliverables-cascade",
      error: null,
      agentProgress: allStepLabels.map((label) => ({
        agent: "Entregables",
        message: `⚪ ${label} — Generando…`,
        step: label,
        status: "generando" as const,
      })),
      cascadeTotal: allStepLabels.length,
      cascadeCompleted: 0,
    });
    try {
      const qs = acknowledgeGaps ? "?acknowledgeGaps=true" : "";
      const r = await apiFetch(`${API_BASE}/projects/${pid}/generate-deliverables${qs}`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al generar entregables");
      }
      const data = (await r.json()) as { queued?: boolean; jobId?: string; streamPath?: string };
      if (data.queued === true && typeof data.jobId === "string") {
        const deadline = Date.now() + 45 * 60 * 1000;

        const completedSteps = new Set<string>();
        let lastReportedStep: string | null = null;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          const st = await apiFetch(`${API_BASE}/projects/${pid}/deliverables-jobs/${data.jobId}`);
          if (!st.ok) {
            const err = await st.json().catch(() => ({}));
            throw new Error((err as { message?: string }).message ?? "Error al consultar cola de entregables");
          }
          const j = (await st.json()) as {
            status: string;
            progress?: { step?: string; index?: number; total?: number };
            error?: string;
          };
          if (j.status === "failed") {
            throw new Error(j.error ?? "Cascada de entregables fallida");
          }
          if (j.status === "completed") break;
          if (j.progress != null) {
            const progressUpdate = applyDeliverableCascadeProgressUpdate(
              get().agentProgress,
              completedSteps,
              j.progress,
            );
            if (progressUpdate.matched) {
              set({
                agentProgress: progressUpdate.agentProgress,
                cascadeCompleted: progressUpdate.cascadeCompleted,
              });
            } else {
              const apiStep = readDeliverableCascadeProgressStep(j.progress);
              if (apiStep && apiStep !== "done" && apiStep !== lastReportedStep) {
                lastReportedStep = apiStep;
                set({ agentProgress: progressUpdate.agentProgress });
              }
            }
            const waveStepsDone =
              get().cascadeCompleted >= allStepLabels.length &&
              get().agentProgress.every((item) => item.status === "terminado");
            if (waveStepsDone && !get().agentProgress.some((item) => item.step === CASCADE_POST_PASS_STEP_LABEL)) {
              set({ agentProgress: ensurePostPassCascadeRow(get().agentProgress) });
            }
          }
        }
        set((s) => ({
          agentProgress: markAllAgentProgressTerminated(s.agentProgress),
          cascadeCompleted: Math.max(s.cascadeCompleted, allStepLabels.length),
        }));
        const projQueued = await get().fetchProject(pid);
        await get().fetchEstimation(pid).catch(() => {});
        await get().fetchGenerationStatus(pid);
        get().bumpDocumentationGapsRefresh();
        set({ agentProgress: [] });
        return projQueued;
      }
      set((s) => ({
        agentProgress: markAllAgentProgressTerminated(s.agentProgress),
        cascadeCompleted: Math.max(s.cascadeCompleted, allStepLabels.length),
      }));
      const projSync = await get().fetchProject(pid);
      await get().fetchEstimation(pid).catch(() => {});
      await get().fetchGenerationStatus(pid);
      get().bumpDocumentationGapsRefresh();
      set({ agentProgress: [] });
      return projSync;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al generar entregables", agentProgress: [] });
      return null;
    } finally {
      set({ loading: false, loadingReason: null });
    }
  },

  confirmComplexityProposal: async (projectId) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/confirm-complexity`, {
        method: "POST",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "No se pudo confirmar la complejidad");
      }
      return await get().fetchProject(projectId.trim());
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al confirmar complejidad" });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  dismissComplexityProposal: async (projectId) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearComplexityPending: true }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "No se pudo descartar la propuesta");
      }
      return await get().fetchProject(projectId.trim());
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al descartar propuesta" });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  reassessComplexity: async (projectId, note) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/reassess-complexity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "No se pudo re-valorar la complejidad");
      }
      return await get().fetchProject(projectId.trim());
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al re-valorar" });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  fetchConformance: async (projectId, options) => {
    if (!projectId?.trim()) return;
    const useLlm = options?.useLlm === true;
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/conformance${useLlm ? "?useLlm=true" : ""}`);
      if (r.ok) {
        const data = (await r.json()) as {
          blueprint: ConformanceResult;
          blueprintDataModel?: ConformanceResult;
          api: ApiConformanceResult;
          logicFlows: ConformanceResult;
          infra: ConformanceResult;
        };
        set({
          conformance: {
            ...data,
            blueprintDataModel: data.blueprintDataModel ?? { ok: true, gaps: [] },
          },
        });
      }
    } catch {
      set({ conformance: null });
    }
  },
  verifyDeliverable: async (projectId, deliverable) => {
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/verify-deliverable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverable }),
      });
      if (!r.ok) throw new Error("Error al verificar");
      const text = await r.text();
      return text.replace(/^["']|["']$/g, "").trim();
    } catch {
      return "";
    }
  },
  setDbgaContent: (content) => set({ dbgaContent: content }),

  persistDbgaContent: async (content) => {
    await persistField("dbgaContent", content, get, set);
  },

  setAgentProgress: (progress) => set({ agentProgress: progress }),

  generateBenchmark: async (projectId, userIdea) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "benchmark", error: null, agentProgress: [] });
    try {
      const r = await apiFetch(`${API_BASE}/ai-analysis/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: userIdea?.trim() ?? "",
          projectId: projectId.trim(),
        }),
      });
      if (!r.ok) {
        await throwStreamHttpError(r, "Error al generar Benchmark & Gap Analysis");
      }
      const reader = r.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalMarkdown: string | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            for (const event of parseNdjsonLine(line)) {
              try {
                const ev = event as {
                  type: string;
                  agent?: string;
                  message?: string;
                  markdown?: string;
                  complexityProposal?: ComplexityPending;
                  code?: string;
                };
                if (ev.type === "progress" && ev.agent != null && ev.message != null) {
                  set((s) => ({
                    agentProgress: mergeAgentProgressFromMddEvent(s.agentProgress, {
                      agent: ev.agent!,
                      message: ev.message!,
                    }),
                  }));
                } else if (ev.type === "done" && ev.markdown != null) {
                  finalMarkdown = ev.markdown;
                  if (ev.complexityProposal != null) {
                    set((s) => ({
                      project:
                        s.project != null
                          ? { ...s.project, complexityPending: ev.complexityProposal! }
                          : s.project,
                    }));
                  }
                } else if (ev.type === "error" && ev.message) {
                  const err = new Error(ev.message) as Error & { code?: string };
                  if (ev.code) err.code = ev.code;
                  throw err;
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue;
                throw parseErr;
              }
            }
          }
        }
      }

      if (finalMarkdown != null) {
        set({ dbgaContent: finalMarkdown, error: null });
        const { persistDbgaContent, fetchProject } = get();
        await persistDbgaContent(finalMarkdown);
        const data = await fetchProject(projectId);
        return data ?? get().project;
      }
      return get().project;
    } catch (e) {
      set({
        ...errorStateFromCaught(e),
        loading: false,
        loadingReason: null,
        agentProgress: [],
      });
      return null;
    } finally {
      set({ loading: false, loadingReason: null, agentProgress: [] });
    }
  },

  generateMddFromBenchmark: async (projectId) => {
    if (!projectId?.trim()) return null;
    const pid = projectId.trim();
    const dbgaContent = (get().dbgaContent ?? get().project?.dbgaContent ?? "").trim();
    const benchStage = get().activeStageId;
    set({ loading: true, loadingReason: "mdd", error: null, agentProgress: [] });
    void get().fetchGenerationStatus(pid);

    try {
      await enqueueAndPollMddJob(
        {
          mode: "pipeline",
          projectId: pid,
          dbgaContent: dbgaContent || undefined,
          forceFullPipeline: true,
          mddContent: (get().mddContent ?? "").trim() || undefined,
          ...(benchStage ? { stageId: benchStage } : {}),
        },
        pid,
        {
          onProgress: (p) => {
            patchAgentProgressFromMddEvent(set, p);
            const ev = mddJobProgressEventFields(p);
            if (ev.phase === "persisted" || ev.phase === "draft") {
              void get().fetchProject(pid, { preferServerMdd: true });
            }
          },
        },
      );
      set({ mddJustGeneratedFromBenchmark: true, error: null });
      const data = await get().fetchProject(pid, { preferServerMdd: true });
      applyMddFromFetchedProject(get, set, data ?? get().project);
      await get().fetchEstimation(pid);
      await get().fetchGenerationStatus(pid);
      set({ loading: false, loadingReason: null, agentProgress: [] });
      return data ?? get().project;
    } catch (e) {
      const status = await get().fetchGenerationStatus(pid);
      const stillRunning = Boolean(status?.busy || status?.mddStreamActive);
      const friendly = friendlyFetchError(e);
      if (stillRunning) {
        set({
          notice:
            `${friendly} La regeneración puede seguir en el servidor; recarga el proyecto en unos minutos para ver el MDD.`,
          error: null,
          loading: true,
          loadingReason: "mdd",
        });
      } else {
        set({
          ...errorStateFromCaught(e),
          loading: false,
          loadingReason: null,
          agentProgress: [],
        });
        const recovered = await get().fetchProject(pid, { preferServerMdd: true });
        applyMddFromFetchedProject(get, set, recovered ?? get().project);
      }
      void get().fetchGenerationStatus(pid);
      return null;
    }
  },

  generateMddUpstreamSync: async (projectId, opts) => {
    if (!projectId?.trim()) return null;
    const pid = projectId.trim();
    const stageId = opts?.stageId ?? get().activeStageId ?? undefined;
    const dbgaContent = (get().dbgaContent ?? get().project?.dbgaContent ?? "").trim();
    const syncMeta = get().generationStatus?.mddUpstreamSync;
    const changeSummary =
      syncMeta?.changes?.length && syncMeta.recommendedSections
        ? buildUpstreamChangeSummaryForPipeline({
            hasBaseline: syncMeta.hasBaseline ?? false,
            hasMdd: true,
            baselineCapturedAt: null,
            changedSources: syncMeta.changedSources ?? [],
            changes: syncMeta.changes,
            recommendedSections: syncMeta.recommendedSections,
            expandedSections: syncMeta.expandedSections ?? opts?.sections ?? [],
            canSync: syncMeta.canSync ?? true,
            needsFullRegen: false,
            pendingSync: syncMeta.pendingSync ?? true,
          })
        : undefined;

    set({ loading: true, loadingReason: "mdd", error: null, agentProgress: [] });
    void get().fetchGenerationStatus(pid, stageId);

    try {
      await enqueueAndPollMddJob(
        {
          mode: "upstream-sync",
          projectId: pid,
          dbgaContent: dbgaContent || undefined,
          mddContent: (get().mddContent ?? "").trim() || undefined,
          ...(stageId ? { stageId } : {}),
          ...(opts?.sections?.length ? { upstreamSections: opts.sections } : {}),
          ...(changeSummary ? { upstreamChangeSummary: changeSummary } : {}),
        },
        pid,
        {
          onProgress: (p) => {
            patchAgentProgressFromMddEvent(set, p);
            const ev = mddJobProgressEventFields(p);
            if (ev.phase === "persisted" || ev.phase === "draft") {
              void get().fetchProject(pid, { preferServerMdd: true });
            }
          },
        },
      );
      set({ error: null });
      const data = await get().fetchProject(pid, { preferServerMdd: true });
      applyMddFromFetchedProject(get, set, data ?? get().project);
      await get().fetchEstimation(pid);
      await get().fetchGenerationStatus(pid, stageId);
      set({ loading: false, loadingReason: null, agentProgress: [] });
      return data ?? get().project;
    } catch (e) {
      const status = await get().fetchGenerationStatus(pid, stageId);
      const stillRunning = Boolean(status?.busy || status?.mddStreamActive);
      const friendly = friendlyFetchError(e);
      if (stillRunning) {
        set({
          notice:
            `${friendly} La sincronización puede seguir en el servidor; recarga el proyecto en unos minutos.`,
          error: null,
          loading: true,
          loadingReason: "mdd",
        });
      } else {
        set({
          ...errorStateFromCaught(e),
          loading: false,
          loadingReason: null,
          agentProgress: [],
        });
        const recovered = await get().fetchProject(pid, { preferServerMdd: true });
        applyMddFromFetchedProject(get, set, recovered ?? get().project);
      }
      void get().fetchGenerationStatus(pid);
      return null;
    }
  },

  clearMddJustGeneratedFromBenchmark: () => set({ mddJustGeneratedFromBenchmark: false }),

  setPhase0SummaryContent: (content) => set({ phase0SummaryContent: content }),

  persistPhase0SummaryContent: async (content) => {
    await persistField("phase0SummaryContent", content, get, set);
  },

  phase0DeepResearch: async (projectId, opts) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "phase0-deep-research", error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/phase0-deep-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIdea: opts.userIdea?.trim() || undefined,
          urls: opts.urls?.length ? opts.urls : undefined,
          includeBenchmark: opts.includeBenchmark ?? false,
        }),
      });
      const raw = await r.text();
      if (!r.ok) {
        let errMessage = "Error al generar Deep Research";
        try {
          const err = JSON.parse(raw) as { message?: string };
          if (err?.message) errMessage = err.message;
        } catch {
          if (raw.trim().length > 0 && raw.length < 500) errMessage = raw;
        }
        throw new Error(errMessage);
      }
      let data: Project;
      try {
        data = JSON.parse(raw) as Project;
      } catch {
        console.error("[phase0DeepResearch] Respuesta no es JSON. Preview:", raw.slice(0, 200));
        throw new Error(
          "El servidor devolvió texto en lugar de JSON (posible fallo del proveedor de IA). Intenta de nuevo.",
        );
      }
      set({ project: data, phase0SummaryContent: data.phase0SummaryContent ?? null, error: null });
      return data;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al generar Deep Research" });
      return null;
    } finally {
      set({ loading: false, loadingReason: null });
    }
  },

  clearDbgaContent: async (projectId) => {
    if (!projectId?.trim()) return;
    try {
      void apiFetch(
        `${API_BASE}/ai-analysis/dbga/checkpoint?projectId=${encodeURIComponent(projectId.trim())}`,
        { method: "DELETE" },
      ).catch(() => { });
      const r = await apiFetch(`${API_BASE}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbgaContent: null }),
      });
      if (r.ok) {
        const data: Project = await r.json();
        set({
          project: data,
          dbgaContent: normalizeWorkshopDocumentForEditor(data.dbgaContent ?? null),
        });
      }
    } catch {
      // ignore
    }
  },

  fetchEstimation: async (projectId, mddContentOverride) => {
    if (!projectId?.trim()) return null;
    try {
      const currentMdd = (mddContentOverride ?? get().mddContent ?? get().project?.mddContent ?? "").trim();
      const sid = get().activeStageId;
      const r = await apiFetch(`${API_BASE}/ai-analysis/estimation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId.trim(),
          ...(currentMdd ? { mddContent: currentMdd } : {}),
          ...(sid ? { stageId: sid } : {}),
        }),
      });
      if (!r.ok) return null;
      const data = (await r.json()) as LiveMetricsResult & {
        precisionBreakdown?: PrecisionBreakdown;
        completeness?: DocumentCompleteness;
        crossDocumentGaps?: CrossDocumentGap[];
        consistencyScore?: number;
        auditTrail?: string[];
        lastAuditAt?: string;
      };
      const {
        precisionBreakdown,
        completeness,
        crossDocumentGaps,
        consistencyScore,
        auditTrail,
        deliveryGate,
        ...metrics
      } = data;
      set({
        liveMetrics: metrics,
        deliveryGate: deliveryGate ?? null,
        ...(precisionBreakdown != null ? { precisionBreakdown } : {}),
        ...(completeness != null ? { documentCompleteness: completeness } : {}),
        ...(crossDocumentGaps != null ? { crossDocumentGaps } : {}),
        ...(consistencyScore != null ? { consistencyScore } : {}),
        ...(auditTrail?.length ? { auditTrail } : {}),
      });
      return metrics;
    } catch {
      return null;
    }
  },

  clearPhase0SummaryContent: async (projectId) => {
    if (!projectId?.trim()) return;
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase0SummaryContent: null }),
      });
      if (r.ok) {
        const data: Project = await r.json();
        set({ project: data, phase0SummaryContent: data.phase0SummaryContent ?? null });
      }
    } catch {
      // ignore
    }
  },

  clearWorkshopDocumentContent: async (projectId, panel, options) => {
    if (!projectId?.trim()) return false;
    const pid = projectId.trim();

    try {
      if (panel === "benchmark") {
        if (options?.benchmarkPhaseTab === "benchmark") {
          await get().clearPhase0SummaryContent(pid);
        } else {
          await get().clearDbgaContent(pid);
        }
        return true;
      }

      if (panel === "brd") {
        const stageId = options?.stageId?.trim() ?? get().activeStageId?.trim();
        if (!stageId) return false;
        const ok = await get().patchWorkshopStage(stageId, { brdContent: "" });
        if (ok) set({ error: null });
        return ok;
      }

      if (panel === "mdd-inicial") {
        const ok = await get().legacyUpdateCodebaseDoc(pid, "");
        if (ok) await get().fetchProject(pid);
        return ok;
      }

      const fieldByPanel: Record<string, string> = {
        spec: "specContent",
        mdd: "mddContent",
        "ux-ui-guide": "uxUiGuideContent",
        blueprint: "blueprintContent",
        "api-contracts": "apiContractsContent",
        "logic-flows": "logicFlowsContent",
        tasks: "tasksContent",
        infra: "infraContent",
        architecture: "architectureContent",
        "use-cases": "useCasesContent",
        "user-stories": "userStoriesContent",
        aem: "aemContent",

        "agent-governance": "agentGovernanceContent",
      };

      const fieldName = fieldByPanel[panel];
      if (!fieldName) return false;

      if (panel === "mdd") {
        return get().clearMddContentCompletely(pid);
      }

      const r = await apiFetch(`${API_BASE}/projects/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldName]: null }),
      });
      if (!r.ok) return false;
      const data: Project = await r.json();
      set({
        project: data,
        [fieldName]: (data as unknown as Record<string, unknown>)[fieldName] ?? null,
        synced: true,
        error: null,
      } as Partial<WorkshopState>);
      return true;
    } catch {
      set({ error: "No se pudo limpiar el documento" });
      return false;
    }
  },

  legacyGenerateCodebaseDoc: async (projectId, opts) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "legacy-codebase-doc", error: null });
    try {
      const body: Record<string, unknown> = {};
      if (opts?.responseMode !== undefined) body.responseMode = opts.responseMode;
      if (opts?.stageId?.trim()) body.stageId = opts.stageId.trim();
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/legacy/generate-codebase-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al generar documentación");
      }
      const data = (await r.json()) as {
        codebaseDoc: string;
        mddContent?: string;
        mcpDebugTrace?: LegacyMcpDebugEntry[];
      } | null;
      await get().fetchProject(projectId);
      if (data == null) {
        set({
          loading: false,
          loadingReason: null,
          error:
            "No se pudo generar el MDD inicial: TheForge MCP no está configurado en el backend o la respuesta fue vacía. Revisa THEFORGE_MCP_URL.",
          legacyMcpDebugTrace: null,
        });
        return null;
      }
      set({
        loading: false,
        loadingReason: null,
        error: null,
        legacyMcpDebugTrace: data.mcpDebugTrace ?? null,
      });
      return data;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Error al generar documentación",
        loading: false,
        loadingReason: null,
        legacyMcpDebugTrace: null,
      });
      return null;
    }
  },

  legacyUpdateCodebaseDoc: async (projectId, codebaseDoc) => {
    if (!projectId?.trim()) return false;
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/legacy/codebase-doc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codebaseDoc }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al guardar documentación");
      }
      await get().fetchProject(projectId);
      return true;
    } catch {
      return false;
    }
  },

  legacyStart: async (projectId, description, stageId) => {
    if (!projectId?.trim() || !description?.trim()) return null;
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = { description: description.trim() };
      if (stageId?.trim()) body.stageId = stageId.trim();
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/legacy/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al analizar con Relic");
      }
      const data = (await r.json()) as {
        filesToModify: (string | { path: string; repoId?: string })[];
        questions: string[];
        suggestedAnswers?: Record<string, string>;
      };
      await get().fetchProject(projectId);
      set({ loading: false, error: null });
      return data;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error legacy start", loading: false });
      return null;
    }
  },

  legacyAnswer: async (projectId, answers, stageId) => {
    if (!projectId?.trim()) return false;
    set({ loading: true, error: null });
    try {
      const body: Record<string, unknown> = { answers: answers ?? {} };
      if (stageId?.trim()) body.stageId = stageId.trim();
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/legacy/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al guardar respuestas");
      }
      await get().fetchProject(projectId);
      set({ loading: false, error: null });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error legacy answer", loading: false });
      return false;
    }
  },

  legacyGenerateMdd: async (projectId, stageId) => {
    if (!projectId?.trim()) return null;
    const pid = projectId.trim();
    set({ loading: true, loadingReason: "legacy-mdd", error: null });
    void get().fetchGenerationStatus(pid);
    try {
      const jobStatus = await enqueueAndPollLegacyMdd(pid, stageId, {
        onProgress: (p) => {
          const ev = mddJobProgressEventFields(p);
          if (ev.message) {
            patchAgentProgressFromMddEvent(set, {
              agent: "MDD Legacy",
              message: ev.message,
            });
          }
        },
      });
      if (jobStatus.result?.outcome === "interrupt" && jobStatus.result.threadId) {
        set({ managerThreadId: jobStatus.result.threadId });
      }
      const project = await get().fetchProject(pid);
      const mddContent = project?.mddContent ?? "";
      set({
        mddContent,
        loading: false,
        loadingReason: null,
        error: null,
      });
      await get().fetchGenerationStatus(pid);
      return mddContent.trim() ? { mddContent } : null;
    } catch (e) {
      try {
        const project = await get().fetchProject(pid);
        if (project?.mddContent?.trim()) {
          set({
            mddContent: project.mddContent,
            loading: false,
            loadingReason: null,
            error: null,
          });
          return { mddContent: project.mddContent };
        }
      } catch {
        /* persist recovery failed */
      }
      set({
        error: friendlyFetchError(e),
        loading: false,
        loadingReason: null,
      });
      void get().fetchGenerationStatus(pid);
      return null;
    }
  },

  legacyGenerateAsIsManual: async (projectId) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "legacy-as-is", error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/legacy/generate-as-is-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al generar As-Is");
      }
      const data = (await r.json()) as { asIsManualContent: string; stageId: string };
      await get().fetchProject(projectId.trim());
      set({ loading: false, loadingReason: null, error: null });
      return data;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Error al generar manual As-Is",
        loading: false,
        loadingReason: null,
      });
      return null;
    }
  },

  legacySuggestBrdFromCodebaseDoc: async (projectId, stageId) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "legacy-brd-suggest", error: null });
    const body: Record<string, string> = {};
    if (stageId?.trim()) body.stageId = stageId.trim();
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/legacy/suggest-brd-from-codebase-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al generar BRD");
      }
      const data = (await r.json()) as { brdContent: string; stageId: string };
      await get().fetchProject(projectId.trim());
      set({ loading: false, loadingReason: null, error: null });
      return data;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Error al sugerir BRD",
        loading: false,
        loadingReason: null,
      });
      return null;
    }
  },

  legacyGenerateFromCodebaseDoc: async (projectId, documentType, stageId) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "legacy-brd-suggest", error: null });
    const body: { documentType: string; stageId?: string } = { documentType };
    if (stageId?.trim()) body.stageId = stageId.trim();
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/legacy/generate-from-codebase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al generar documento");
      }
      const data = (await r.json()) as { content: string; field: string };
      await get().fetchProject(projectId.trim());
      set({ loading: false, loadingReason: null, error: null });
      return data;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Error al generar documento desde codebase",
        loading: false,
        loadingReason: null,
      });
      return null;
    }
  },

  suggestBrdFromDbga: async (projectId, opts) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "brd-from-dbga", error: null });
    try {
      const body: { stageId?: string } = {};
      const sid = opts?.stageId?.trim();
      if (sid) body.stageId = sid;
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/suggest-brd-from-dbga`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al generar BRD desde DBGA");
      }
      const data = (await r.json()) as { brdContent: string; stageId: string };
      await get().fetchProject(projectId.trim());
      set({ loading: false, loadingReason: null, error: null });
      return data;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Error al sugerir BRD desde DBGA",
        loading: false,
        loadingReason: null,
      });
      return null;
    }
  },

  legacyGenerateDeliverables: async (projectId) => {
    if (!projectId?.trim()) return false;
    const pid = projectId.trim();
    const stageId = get().activeStageId?.trim() || undefined;
    const project = get().project;
    const complexity = project?.complexity ?? "HIGH";
    const plannedKinds = planLegacyDeliverablesToGenerate({
      complexity,
      hasMddContent: !!project?.mddContent?.trim(),
    });
    const stepLabels = deliverableStepLabelsForKinds(plannedKinds);

    if (stepLabels.length === 0) {
      await get().fetchProject(pid);
      return true;
    }

    set({
      loading: true,
      loadingReason: "legacy-deliverables",
      error: null,
      agentProgress: stepLabels.map((label) => ({
        agent: "Entregables",
        message: `⚪ ${label} — Generando…`,
        step: label,
        status: "generando" as const,
      })),
      cascadeTotal: stepLabels.length,
      cascadeCompleted: 0,
    });

    const pollLegacyDeliverablesJob = async (jobId: string): Promise<boolean> => {
      const deadline = Date.now() + 90 * 60 * 1000;
      const completedSteps = new Set<string>();
      let lastReportedStep: string | null = null;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const st = await apiFetch(`${API_BASE}/projects/${pid}/legacy/deliverables-jobs/${jobId}`);
        if (!st.ok) {
          const err = await st.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? "Error al consultar cola legacy");
        }
        const j = (await st.json()) as {
          status: string;
          progress?: { step?: string; index?: number; total?: number };
          result?: { ok?: boolean; lastDeliverablesDebug?: LegacyDeliverablesDebugReport };
          error?: string;
        };
        if (j.status === "failed") {
          throw new Error(j.error ?? "Cascada legacy fallida");
        }
        if (j.status === "completed") {
          if (j.result?.lastDeliverablesDebug) {
            set({ lastLegacyDeliverablesDebug: j.result.lastDeliverablesDebug });
          }
          return true;
        }
        const apiStep = readDeliverableCascadeProgressStep(j.progress);
        if (j.progress != null && (apiStep !== "done" || (j.progress as { completedSteps?: string[] }).completedSteps?.length)) {
          const progressUpdate = applyDeliverableCascadeProgressUpdate(
            get().agentProgress,
            completedSteps,
            j.progress,
          );
          if (progressUpdate.matched) {
            set({
              agentProgress: progressUpdate.agentProgress,
              cascadeCompleted: progressUpdate.cascadeCompleted,
            });
          } else if (apiStep && apiStep !== "done" && apiStep !== lastReportedStep) {
            lastReportedStep = apiStep;
            set({ agentProgress: progressUpdate.agentProgress });
          }
        }
      }
      throw new Error("Tiempo de espera agotado en cascada legacy (90 min). Revisa el proyecto por si hubo avance parcial.");
    };

    try {
      const r = await apiFetch(`${API_BASE}/projects/${pid}/legacy/generate-deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stageId ? { stageId } : {}),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as {
          message?: string;
          lastDeliverablesDebug?: LegacyDeliverablesDebugReport;
          retryAfterSeconds?: number;
        };
        if (r.status === 429 && err.lastDeliverablesDebug) {
          set({ lastLegacyDeliverablesDebug: err.lastDeliverablesDebug });
        }
        const suffix =
          r.status === 429 && typeof err.retryAfterSeconds === "number"
            ? ` Reintenta en ~${err.retryAfterSeconds}s (límite TPM/RPM del proveedor).`
            : "";
        throw new Error((err.message ?? "Error al generar entregables") + suffix);
      }
      const data = (await r.json()) as {
        queued?: boolean;
        jobId?: string;
        ok?: boolean;
        lastDeliverablesDebug?: LegacyDeliverablesDebugReport;
      };

      if (data.queued === true && typeof data.jobId === "string") {
        await pollLegacyDeliverablesJob(data.jobId);
      } else {
        if (import.meta.env.DEV && data.lastDeliverablesDebug) {
          console.debug("[LegacyDeliverables]", data.lastDeliverablesDebug);
        }
        set({ lastLegacyDeliverablesDebug: data.lastDeliverablesDebug ?? null });
      }

      set((s) => ({
        agentProgress: markAllAgentProgressTerminated(s.agentProgress),
        cascadeCompleted: stepLabels.length,
      }));
      const proj = await get().fetchProject(pid);
      await get().fetchEstimation(pid).catch(() => {});
      await get().fetchGenerationStatus(pid);
      get().bumpDocumentationGapsRefresh();
      set({
        loading: false,
        loadingReason: null,
        error: null,
        agentProgress: [],
      });
      return proj != null;
    } catch (e) {
      try {
        const project = await get().fetchProject(pid);
        const { activeStageId, workshopStages } = get();
        const stages = workshopStages.length > 0 ? workshopStages : (project?.stages ?? []);
        const debug = legacyDebugFromStages(stages, activeStageId);
        const partial =
          debug?.steps?.some((s) => typeof s.outChars === "number" && s.outChars > 48) ?? false;
        if (partial || (project?.specContent?.trim()?.length ?? 0) > 48) {
          set({
            lastLegacyDeliverablesDebug: debug ?? null,
            loading: false,
            loadingReason: null,
            error: null,
            agentProgress: [],
          });
          return true;
        }
      } catch {
        /* fetchProject recovery failed */
      }
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      console.error("[workshopStore] legacyGenerateDeliverables error:", msg, e);
      set({ error: msg, loading: false, loadingReason: null, agentProgress: [] });
      return false;
    }
  },

  persistMddContent: async (content, options) => {
    const state = get();
    if (!state.projectId || !state.project) return;

    const baseline = selectPersistedMddBaseline(state);
    if (!options?.force && workshopDocumentBodiesEqual(content, baseline)) {
      const normalized = normalizedMddForPersistCompare(content);
      set({ synced: true, mddContent: normalized, mddPersistedBaseline: normalized });
      return;
    }

    const rawPrevious = selectRawMddFromStage(state);
    const allowGovernancePatternChange =
      options?.allowGovernancePatternChange === true ||
      shouldAllowGovernancePatternChangeOnPersist(content, rawPrevious) ||
      selectedPatternIdsFromMdd(content).size > 0;

    set({
      mddPersisting: true,
      synced: false,
      error: null,
      notice: null,
      ...(allowGovernancePatternChange
        ? { mddContent: mddContentForEditor(content) }
        : {}),
    });

    return enqueueMddPersist(async () => {
      const { projectId, project, fetchEstimation } = get();
      if (!projectId || !project) return;

      try {
        const stageId = get().activeStageId;
        const r = await apiFetch(`${API_BASE}/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mddContent: content,
            ...(stageId ? { stageId } : {}),
            ...(allowGovernancePatternChange ? { allowGovernancePatternChange: true } : {}),
            ...(options?.mddGovernanceSeedOnly ? { mddGovernanceSeedOnly: true } : {}),
            ...(options?.mddFormatOnly ? { mddFormatOnly: true } : {}),
            ...(options?.clearMddCompletely ? { clearMddCompletely: true } : {}),
          }),
        });
        if (r.ok) {
          const data = (await r.json()) as Project & { mddGovernancePatternsReverted?: boolean };
          const packed = projectWithUxAfterStream(data, data.uxUiGuideContent, get().activeStageId);
          let savedContent = packed?.mddContent ?? data.mddContent ?? content;
          const patternsReverted = data.mddGovernancePatternsReverted === true;
          const sentPatternCount = selectedPatternIdsFromMdd(content).size;
          if (
            sentPatternCount > 0 &&
            (patternsReverted || serverWouldDropGovernancePatterns(content, savedContent)) &&
            selectedPatternIdsFromMdd(savedContent).size === 0
          ) {
            savedContent = content;
          }
          const nextProjectRaw = packed?.project ?? data;
          const stateNow = get();
          const localFields = Object.fromEntries(
            WORKSHOP_PERSIST_BASELINE_FIELDS.map((f) => [
              f,
              (stateNow as unknown as Record<string, unknown>)[f] as string | null | undefined,
            ]),
          );
          const nextProject = mergeProjectBaselinesAfterPersist(
            nextProjectRaw as unknown as Record<string, unknown>,
            {
              savedField: "mddContent",
              prevProject: project as unknown as Record<string, unknown>,
              activeStageId: stageId,
              localFields,
            },
          ) as unknown as Project;
          const editorBaseline = workshopMddEditorBaseline(savedContent);
          const nextTimestamps = extractWorkshopDocumentTimestamps(savedContent);
          const aligned = applyMddEditorBaselineToWorkshop(
            nextProject as Project,
            get().workshopStages,
            stageId,
            editorBaseline,
          );
          set({
            project: aligned.project,
            workshopStages: aligned.workshopStages,
            activeStageId: packed?.activeStageId ?? get().activeStageId,
            mddContent: aligned.mddContent,
            mddPersistedBaseline: aligned.mddPersistedBaseline,
            ...(nextTimestamps
              ? {
                  documentTimestamps: {
                    ...get().documentTimestamps,
                    mddContent: nextTimestamps,
                  },
                }
              : {}),
            synced: true,
            error: null,
            notice: patternsReverted ? SSOT_PATTERNS_RESTORED_NOTICE : null,
          });
          await apiFetch(`${API_BASE}/ai-analysis/estimation/clear-draft`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: projectId.trim(),
              ...(stageId ? { stageId } : {}),
            }),
          }).catch(() => { });
          fetchEstimation(projectId).catch(() => { });
        } else {
          const errText = await parseErrorMessageFromResponse(r, "Error al guardar el MDD");
          set({ synced: false, error: errText });
        }
      } catch {
        set({ synced: false, error: "Error de red al guardar" });
      } finally {
        set({ mddPersisting: false });
      }
    });
  },

  revertMddContent: () => {
    set({ mddContent: get().mddPersistedBaseline });
  },

  clearMddContentCompletely: async (projectId) => {
    const pid = projectId?.trim();
    if (!pid) return false;
    const stageId = get().activeStageId;
    try {
      const r = await apiFetch(`${API_BASE}/projects/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mddContent: "",
          ...(stageId ? { stageId } : {}),
          clearMddCompletely: true,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        set({
          error: (err as { message?: string }).message ?? "No se pudo limpiar el MDD",
        });
        return false;
      }
      const data = (await r.json()) as Project;
      const packed = projectWithUxAfterStream(data, data.uxUiGuideContent, get().activeStageId);
      const nextProject = packed?.project ?? data;
      set({
        project: nextProject,
        workshopStages: nextProject.stages ?? get().workshopStages,
        mddContent: "",
        mddPersistedBaseline: "",
        managerThreadId: null,
        synced: true,
        error: null,
        mddJustGeneratedFromBenchmark: false,
      });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al limpiar el MDD" });
      return false;
    }
  },

  /** Persiste el MDD y refresca estimación/semáforo. No reemplaza el contenido por la respuesta del review
   *  para que las ediciones manuales del usuario se respeten. */
  persistAndReviewMdd: async () => {
    const { projectId, project, mddContent, persistMddContent, fetchEstimation } = get();
    if (!projectId?.trim() || !project) return;
    const content = (mddContent ?? "").trim();
    const baseline = selectPersistedMddBaseline(get());
    if (workshopDocumentBodiesEqual(content, baseline)) return;
    set({ mddReviewing: true });
    try {
      const rawPrevious = selectRawMddFromStage(get()) || baseline;
      const allowPatternPersist =
        selectedPatternIdsFromMdd(content).size > 0 ||
        shouldAllowGovernancePatternChangeOnPersist(content, rawPrevious) ||
        governancePatternSelectionDiffers(content, baseline);
      await persistMddContent(content, {
        force: true,
        ...(allowPatternPersist ? { allowGovernancePatternChange: true } : {}),
      });
      const stateAfterPersist = get();
      if (stateAfterPersist.error && !isSsotPatternsNotice(stateAfterPersist.error)) return;
      const saved = selectPersistedMddBaseline(get()) || content;
      await apiFetch(`${API_BASE}/ai-analysis/mdd/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId.trim(), mddContent: saved }),
      });
      fetchEstimation(projectId).catch(() => { });
    } finally {
      set({ mddReviewing: false });
    }
  },

  reapplyMddFormat: async () => {
    const { projectId, project, mddContent, persistMddContent } = get();
    if (!projectId?.trim() || !project) return;
    const content = (mddContent ?? project.mddContent ?? "").trim();
    if (!content) return;
    const before = selectPersistedMddBaseline(get()) || content;
    const hadCorruption = mddMarkdownHasKnownFormatCorruption(content);
    set({ mddReapplyingFormat: true, error: null, notice: null });
    try {
      await persistMddContent(content, { force: true, mddFormatOnly: true });
      const after = selectPersistedMddBaseline(get());
      const stillCorrupt = mddMarkdownHasKnownFormatCorruption(after);
      set({
        notice:
          stillCorrupt
            ? "MDD: se aplicó formato pero aún hay bloques §4 o secciones por revisar manualmente."
            : after.trim() !== before.trim() || hadCorruption
              ? "MDD reformateado: se aplicaron correcciones deterministas (headings, JSON §4, SQL, coherencia)."
              : "MDD revisado: la pasada de formato no detectó cambios adicionales.",
      });
    } finally {
      set({ mddReapplyingFormat: false });
    }
  },

  fetchAdrs: async (projectId) => {
    try {
      const r = await apiFetch(`${API_BASE}/ai-analysis/mdd/adrs?projectId=${encodeURIComponent(projectId)}`);
      if (r.ok) {
        const data = await r.json();
        set({ adrs: data });
      }
    } catch (err) {
      console.error("Error fetching ADRs:", err);
    }
  },

  suggestGovernancePatterns: async (projectId, stageId) => {
    const pid = projectId?.trim();
    if (!pid) return { patternIds: [] };
    const body: Record<string, string> = { projectId: pid };
    const sid = (stageId ?? get().activeStageId)?.trim();
    if (sid) body.stageId = sid;
    const r = await apiFetch(`${API_BASE}/ai-analysis/mdd/suggest-governance-patterns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? "No se pudo analizar documentos para patrones");
    }
    return (await r.json()) as { patternIds: string[]; rationale?: string };
  },

  suggestTraceabilityFix: async (projectId, gap, opts) => {
    const pid = projectId?.trim();
    if (!pid) return null;
    const body: {
      projectId: string;
      stageId?: string;
      gap: TraceabilityGapInput;
      mddContent?: string;
    } = {
      projectId: pid,
      gap: {
        concept: gap.concept,
        hint: gap.hint,
        brdSection: gap.brdSection,
        brdSubsection: gap.brdSubsection,
        kind: gap.kind,
        missingTerms: gap.missingTerms,
        severity: gap.severity,
      },
    };
    const sid = (opts?.stageId ?? get().activeStageId)?.trim();
    if (sid) body.stageId = sid;
    const mdd = (opts?.mddContent ?? get().mddContent ?? "").trim();
    if (mdd) body.mddContent = mdd;
    try {
      const r = await apiFetch(`${API_BASE}/ai-analysis/traceability/suggest-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: opts?.signal,
      });
      if (!r.ok) {
        const msg = await parseErrorMessageFromResponse(r, "No se pudo generar la sugerencia de trazabilidad");
        set({ error: msg });
        return null;
      }
      return (await r.json()) as TraceabilitySuggestFixResponse;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        set({ error: "La sugerencia tardó demasiado. Inténtalo de nuevo." });
        return null;
      }
      set({
        error: e instanceof Error ? e.message : "Error de red al sugerir parche de trazabilidad",
      });
      return null;
    }
  },

  insertTraceabilityPatch: async (suggestion, targetSection) => {
    const { mddContent, project, persistMddContent, deliveryGate, projectId, fetchEstimation } = get();
    const baseline = (mddContent ?? project?.mddContent ?? "").trim();
    if (!baseline) {
      set({ error: "No hay MDD para insertar el parche" });
      return false;
    }
    if (hasDeliveryGateBlockers(deliveryGate)) {
      set({ error: formatDeliveryGateInsertBlocker(deliveryGate!) });
      return false;
    }
    const merged = appendMddTraceSection(baseline, targetSection, suggestion);
    await persistMddContent(merged, { force: true });
    if (get().error) {
      return false;
    }
    if (projectId) {
      const persisted = (get().mddContent ?? merged).trim();
      await fetchEstimation(projectId, persisted).catch(() => {});
    }
    return true;
  },

  recordGovernancePatternAdrs: async (projectId, patternIds) => {
    const pid = projectId?.trim();
    if (!pid || patternIds.size === 0) return;
    const patterns = listGovernancePatternOptions()
      .filter((o) => patternIds.has(o.id))
      .map((o) => ({
        label: o.label,
        group: o.group,
        affects: o.affects,
        description: o.description,
      }));
    if (patterns.length === 0) return;
    const r = await apiFetch(`${API_BASE}/ai-analysis/mdd/record-governance-pattern-adrs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: pid, patterns }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? "No se pudieron registrar ADRs de patrones");
    }
    const adrs = await r.json();
    set({ adrs });
  },
  convergeTasks: async (projectId, persist = false) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "converge", error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/converge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persist }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error en converge");
      }
      const data = (await r.json()) as {
        convergeSection: string;
        persisted: boolean;
        openTaskCount: number;
        suggestedTasksMarkdown: string;
      };
      if (data.persisted) {
        set({ tasksContent: data.suggestedTasksMarkdown, error: null });
      } else {
        set({ error: null });
      }
      return {
        convergeSection: data.convergeSection,
        persisted: data.persisted,
        openTaskCount: data.openTaskCount,
      };
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error en converge" });
      return null;
    } finally {
      set({ loading: false, loadingReason: null });
    }
  },
  tasksToIssues: async (projectId, body) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "tasks-to-issues", error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/tasks-to-issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al crear issues");
      }
      const data = (await r.json()) as {
        created: Array<{ number: number; html_url: string }>;
        errors: string[];
      };
      set({ error: null });
      return data;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error al crear issues" });
      return null;
    } finally {
      set({ loading: false, loadingReason: null });
    }
  },
  clarifySpec: async (projectId, opts) => {
    const res = await get().clarifyDocument(projectId, {
      field: "specContent",
      persist: opts.persist,
      notes: opts.notes,
      syncMdd: opts.syncMdd,
    });
    if (!res) return null;
    return {
      clarifiedSpec: res.clarifiedContent,
      clarificationMarkerCount: res.clarificationMarkerCount,
      persisted: res.persisted,
      mddSyncQueued: res.mddSyncQueued,
    };
  },
  clarifyDocument: async (projectId, opts) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "clarify-document", error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/clarify-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: opts.field,
          persist: opts.persist,
          notes: opts.notes,
          stageId: opts.stageId ?? undefined,
          syncMdd: opts.syncMdd,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error en clarify-document");
      }
      const data = (await r.json()) as {
        field: ClarifyableDocumentField;
        clarifiedContent: string;
        clarificationMarkerCount: number;
        persisted: boolean;
        mddSyncQueued?: boolean;
      };
      if (data.persisted) {
        set({ ...workshopStorePatchForClarifiedField(data.field, data.clarifiedContent), error: null });
      }
      return data;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Error en clarify-document" });
      return null;
    } finally {
      set({ loading: false, loadingReason: null });
    }
  },
  resolveClarifications: async (projectId, opts) => {
    if (!projectId?.trim()) return null;
    set({ loading: true, loadingReason: "resolve-clarifications", error: null });
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/resolve-clarifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: opts.field,
          answers: opts.answers,
          persist: opts.persist ?? true,
          stageId: opts.stageId ?? undefined,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Error al resolver clarificaciones");
      }
      const data = (await r.json()) as {
        field: ClarifyableDocumentField;
        resolvedContent: string;
        clarificationMarkerCount: number;
        persisted: boolean;
      };
      if (data.persisted) {
        set({ ...workshopStorePatchForClarifiedField(data.field, data.resolvedContent), error: null });
      }
      return data;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Error al resolver clarificaciones",
      });
      return null;
    } finally {
      set({ loading: false, loadingReason: null });
    }
  },
  reset: () => set(workshopInitialState),
}));
