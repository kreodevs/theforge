import {
  buildWorkshopDocumentTimestampsMap,
  normalizeWorkshopDocumentForEditor,
} from "../../../utils/workshop-document-content.util";
import {
  resolveWorkshopStageDeliverables,
  workshopDeliverableStoreSlice,
  type WorkshopStageDeliverableField,
} from "../../../utils/workshopStageDeliverables";
import { pickDefaultStageId } from "./pick-default-stage";
import type { Project, WorkshopStage } from "../types";

export function legacyDebugFromStages(stages: WorkshopStage[], activeStageId: string | null) {
  const stage =
    (activeStageId ? stages.find((s) => s.id === activeStageId) : null) ??
    (pickDefaultStageId(stages) ? stages.find((s) => s.id === pickDefaultStageId(stages)) : null);
  return stage?.legacyChangeState?.lastDeliverablesDebug ?? null;
}

export function legacyCodebaseDocFromStages(stages: WorkshopStage[], activeStageId: string | null): string {
  const stage =
    (activeStageId ? stages.find((s) => s.id === activeStageId) : null) ??
    (pickDefaultStageId(stages) ? stages.find((s) => s.id === pickDefaultStageId(stages)) : null);
  return (stage?.legacyChangeState?.codebaseDoc ?? "").trim();
}

/** MDD efectivo para regenerar §N: store + etapa activa (evita mandar borrador vacío al API). */
export function effectiveMddContentForSectionRegen(getState: () => {
  mddContent: string;
  activeStageId: string | null;
  project: Project | null;
}): string {
  const { mddContent, activeStageId, project } = getState();
  const fromStore = (mddContent ?? "").trim();
  if (fromStore.length >= 100) return fromStore;
  const st = project?.stages?.find((s) => s.id === activeStageId);
  return (normalizeWorkshopDocumentForEditor(st?.mddContent ?? null) ??
    normalizeWorkshopDocumentForEditor(project?.mddContent ?? null) ??
    "").trim();
}

function workshopDeliverableStorePatch(
  deliverables: ReturnType<typeof resolveWorkshopStageDeliverables>,
): Record<WorkshopStageDeliverableField, string | null> {
  const slice = workshopDeliverableStoreSlice(deliverables);
  return {
    specContent: normalizeWorkshopDocumentForEditor(slice.specContent),
    architectureContent: normalizeWorkshopDocumentForEditor(slice.architectureContent),
    useCasesContent: normalizeWorkshopDocumentForEditor(slice.useCasesContent),
    userStoriesContent: normalizeWorkshopDocumentForEditor(slice.userStoriesContent),
    blueprintContent: normalizeWorkshopDocumentForEditor(slice.blueprintContent),
    tasksContent: normalizeWorkshopDocumentForEditor(slice.tasksContent),
    apiContractsContent: normalizeWorkshopDocumentForEditor(slice.apiContractsContent),
    logicFlowsContent: normalizeWorkshopDocumentForEditor(slice.logicFlowsContent),
    infraContent: normalizeWorkshopDocumentForEditor(slice.infraContent),
    agentGovernanceContent: slice.agentGovernanceContent,
    uxUiGuideContent: normalizeWorkshopDocumentForEditor(slice.uxUiGuideContent),
    uiScreensContent: normalizeWorkshopDocumentForEditor(slice.uiScreensContent),
    phase0SummaryContent: slice.phase0SummaryContent,
    aemContent: normalizeWorkshopDocumentForEditor(slice.aemContent),
  };
}

export function workshopFlatFromStage(
  p: Project,
  stageId: string | null,
): Pick<Project, "mddContent" | "status" | "precisionScore" | "estimation"> {
  const stages = p.stages;
  if (!stageId || !stages?.length) {
    return {
      mddContent: p.mddContent,
      status: p.status,
      precisionScore: p.precisionScore,
      estimation: p.estimation,
    };
  }
  const st = stages.find((s) => s.id === stageId);
  if (!st) {
    return {
      mddContent: p.mddContent,
      status: p.status,
      precisionScore: p.precisionScore,
      estimation: p.estimation,
    };
  }
  return {
    mddContent: st.mddContent ?? null,
    status: st.status,
    precisionScore: st.precisionScore,
    estimation: st.estimation ?? null,
  };
}

/** Alinea proyecto + campos del store con la etapa en foco (MDD y entregables editables). */
export function workshopStateFromProjectStage(p: Project, stageId: string | null) {
  const stages = p.stages ?? [];
  const deliverables = resolveWorkshopStageDeliverables({ ...p, stages }, stageId);
  const flat = workshopFlatFromStage(p, stageId);
  const deliverablePatch = workshopDeliverableStorePatch(deliverables);
  return {
    project: {
      ...p,
      ...flat,
      ...deliverablePatch,
      dbgaContent: normalizeWorkshopDocumentForEditor(p.dbgaContent),
      stages,
    },
    activeStageId: stageId,
    mddContent: normalizeWorkshopDocumentForEditor(flat.mddContent) ?? "",
    documentTimestamps: buildWorkshopDocumentTimestampsMap(p, stageId),
    ...deliverablePatch,
  };
}

/** Tras respuesta API con `stages[]`, mantiene foco si la etapa sigue existiendo. */
export function mergeProjectWithActiveStage(
  proj: Project,
  prevActiveId: string | null,
): { project: Project; activeStageId: string | null; mddContent: string } {
  const stages = proj.stages ?? [];
  const activeStageId =
    prevActiveId && stages.some((s) => s.id === prevActiveId) ? prevActiveId : pickDefaultStageId(stages);
  const focused = workshopStateFromProjectStage(proj, activeStageId);
  return {
    project: focused.project,
    activeStageId,
    mddContent: focused.mddContent,
  };
}

/** Proyecto tras evento `done` del orquestador: conserva etapa activa y limpia documentos mostrados. */
export function projectWithUxAfterStream(
  proj: Project | undefined,
  uxFromApi: string | null | undefined,
  prevActiveId: string | null,
): { project: Project; mddContent: string; activeStageId: string | null } | null {
  if (!proj) return null;
  const merged = mergeProjectWithActiveStage(proj, prevActiveId);
  const p = merged.project;
  return {
    project: {
      ...p,
      complexityPending:
        proj != null && proj.complexityPending !== undefined
          ? proj.complexityPending
          : p.complexityPending ?? null,
      uxUiGuideContent: normalizeWorkshopDocumentForEditor(uxFromApi ?? p.uxUiGuideContent ?? null),
      blueprintContent: normalizeWorkshopDocumentForEditor(p.blueprintContent ?? null),
      dbgaContent: normalizeWorkshopDocumentForEditor(p.dbgaContent ?? null),
      specContent: normalizeWorkshopDocumentForEditor(p.specContent ?? null),
      apiContractsContent: normalizeWorkshopDocumentForEditor(p.apiContractsContent ?? null),
      logicFlowsContent: normalizeWorkshopDocumentForEditor(p.logicFlowsContent ?? null),
      tasksContent: normalizeWorkshopDocumentForEditor(p.tasksContent ?? null),
      architectureContent: normalizeWorkshopDocumentForEditor(p.architectureContent ?? null),
      useCasesContent: normalizeWorkshopDocumentForEditor(p.useCasesContent ?? null),
      userStoriesContent: normalizeWorkshopDocumentForEditor(p.userStoriesContent ?? null),
      infraContent: normalizeWorkshopDocumentForEditor(p.infraContent ?? null),
    },
    mddContent: merged.mddContent,
    activeStageId: merged.activeStageId,
  };
}
