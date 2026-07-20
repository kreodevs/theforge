import { serverWouldDropGovernancePatterns } from "@theforge/shared-types/mdd-governance-patterns";
import {
  normalizeWorkshopDocumentForEditor,
  workshopMddEditorBaseline,
} from "../../../utils/workshop-document-content.util";
import type { Project, WorkshopStage } from "../types";
import type { WorkshopState } from "../workshop-state.types";
import { selectPersistedMddBaseline } from "../selectors";
import { shouldApplyWorkshopUpdate } from "./workshop-scope";
import { workshopStateFromProjectStage } from "./stage-focus";

export function selectRawMddFromStage(s: WorkshopState): string {
  const stages = s.workshopStages.length > 0 ? s.workshopStages : (s.project?.stages ?? []);
  const st = stages.find((x) => x.id === s.activeStageId);
  return String(st?.mddContent ?? s.project?.mddContent ?? "").trim();
}

export function normalizedMddForPersistCompare(content: string | null | undefined): string {
  return normalizeWorkshopDocumentForEditor(content) ?? "";
}

export function mddContentForEditor(content: string | null | undefined): string {
  return workshopMddEditorBaseline(content);
}

export function patchWorkshopMddStagesWithEditorContent(
  project: Project,
  stages: WorkshopStage[],
  stageId: string | null | undefined,
  editorContent: string,
): { project: Project & { stages: WorkshopStage[] }; stages: WorkshopStage[] } {
  const nextStages = stages.map((s) =>
    stageId && s.id === stageId ? { ...s, mddContent: editorContent } : s,
  );
  const stageMdd =
    stageId && nextStages.length
      ? (nextStages.find((s) => s.id === stageId)?.mddContent ?? editorContent)
      : editorContent;
  return {
    project: { ...project, stages: nextStages, mddContent: stageMdd },
    stages: nextStages,
  };
}

function resolveWorkshopStagesList(
  projectStages: WorkshopStage[] | undefined,
  fallback: WorkshopStage[],
): WorkshopStage[] {
  if (projectStages?.length) return projectStages;
  return fallback;
}

export function applyMddEditorBaselineToWorkshop(
  project: Project,
  workshopStages: WorkshopStage[],
  stageId: string | null | undefined,
  editorBaseline: string,
) {
  const stages = resolveWorkshopStagesList(project.stages, workshopStages);
  const patched = patchWorkshopMddStagesWithEditorContent(
    project,
    stages,
    stageId,
    editorBaseline,
  );
  const focused = workshopStateFromProjectStage(patched.project, stageId ?? null);
  const alignedStages = patched.stages.length > 0 ? patched.stages : stages;
  return {
    project: { ...focused.project, stages: alignedStages, mddContent: editorBaseline },
    workshopStages: alignedStages,
    mddContent: editorBaseline,
    mddPersistedBaseline: editorBaseline,
  };
}

export function applyMddFromFetchedProject(
  get: () => WorkshopState,
  set: (partial: Partial<WorkshopState> | ((state: WorkshopState) => Partial<WorkshopState>)) => void,
  project: Project | null | undefined,
): void {
  if (!project) return;
  const stageId = get().activeStageId;
  const st = project.stages?.find((s) => s.id === stageId);
  const raw = (st?.mddContent ?? project.mddContent ?? "").trim();
  if (raw.length < 48) return;
  const editorBaseline = normalizeWorkshopDocumentForEditor(raw) ?? raw;
  if (editorBaseline.trim().length < 48) return;
  const patch = applyMddEditorBaselineToWorkshop(
    project,
    get().workshopStages.length > 0 ? get().workshopStages : (project.stages ?? []),
    stageId,
    editorBaseline,
  );
  set(patch);
}

export function streamMarkdownPreservesGovernancePatterns(current: string, incoming: string): boolean {
  return !serverWouldDropGovernancePatterns(current, incoming);
}

let mddStreamPersistDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let mddPersistQueue: Promise<void> = Promise.resolve();

export function enqueueMddPersist(task: () => Promise<void>): Promise<void> {
  const next = mddPersistQueue.then(task, task);
  mddPersistQueue = next.catch(() => {});
  return next;
}

/** Persiste MDD tras eventos interrupt/done del stream Manager (debounce + sin fetchProject). */
export async function persistMddFromChatStream(
  get: () => WorkshopState,
  set: (partial: Partial<WorkshopState>) => void,
  markdown: string,
  requestProjectId: string,
): Promise<void> {
  const incoming = markdown.trim();
  if (incoming.length <= 80) return;

  if (!shouldApplyWorkshopUpdate(get, requestProjectId)) return;

  const current = get().mddContent ?? "";
  if (serverWouldDropGovernancePatterns(current, incoming)) return;

  set({ mddContent: mddContentForEditor(incoming) });

  if (mddStreamPersistDebounceTimer) clearTimeout(mddStreamPersistDebounceTimer);
  await new Promise<void>((resolve) => {
    mddStreamPersistDebounceTimer = setTimeout(() => {
      mddStreamPersistDebounceTimer = null;
      resolve();
    }, 400);
  });

  if (!shouldApplyWorkshopUpdate(get, requestProjectId)) return;

  const baseline = normalizedMddForPersistCompare(selectPersistedMddBaseline(get()));
  const normalized = normalizedMddForPersistCompare(incoming);
  if (normalized === baseline) {
    set({ synced: true, mddPersistedBaseline: normalized });
    return;
  }

  const errBefore = get().error;
  await get().persistMddContent(incoming);
  if (!shouldApplyWorkshopUpdate(get, requestProjectId)) return;
  if (errBefore) set({ error: errBefore });
}
