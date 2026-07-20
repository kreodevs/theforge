import type { StateCreator } from "zustand";
import type {
  TraceabilityGapInput,
  TraceabilitySuggestFixResponse,
} from "@theforge/shared-types";
import { type ClarifyableDocumentField } from "@theforge/shared-types";
import { listGovernancePatternOptions } from "@theforge/shared-types/mdd-governance-patterns";
import { apiFetch, API_BASE } from "../../utils/apiClient";
import { parseErrorMessageFromResponse } from "../../utils/httpError";
import { appendMddTraceSection } from "../../utils/appendMddTraceSection";
import {
  formatDeliveryGateInsertBlocker,
  hasDeliveryGateBlockers,
} from "./helpers/delivery-gate";
import { workshopStorePatchForClarifiedField } from "./helpers/clarified-field-patch";
import { workshopInitialState } from "./initial-state";
import type { WorkshopState } from "./workshop-state.types";

type ClarifySliceActions = Pick<
  WorkshopState,
  | "fetchAdrs"
  | "suggestGovernancePatterns"
  | "suggestTraceabilityFix"
  | "insertTraceabilityPatch"
  | "recordGovernancePatternAdrs"
  | "convergeTasks"
  | "tasksToIssues"
  | "clarifySpec"
  | "clarifyDocument"
  | "resolveClarifications"
  | "reset"
>;

export const createClarifySlice: StateCreator<
  WorkshopState,
  [],
  [],
  ClarifySliceActions
> = (set, get) => ({
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
});
