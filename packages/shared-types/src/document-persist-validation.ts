import { isChangelogOnlyDocument } from "./document-changelog.js";

/** Rejects persisting a document that deletes most of the current content (fragment without merge). */
export function wouldShrinkDocDangerously(
  current: string,
  next: string,
  minRatio = 0.55,
): boolean {
  const c = current.trim();
  const n = next.trim();
  if (!c || c.length < 400) return false;
  if (!n) return true;
  if (n.length >= c.length * minRatio) return false;
  if (/^#\s/m.test(n) && n.length >= Math.min(c.length * 0.85, 2500)) return false;
  return true;
}

export type DocumentPersistValidation =
  | { ok: true }
  | { ok: false; message: string };

/** Readable labels for `Project` document fields. */
export const DOCUMENT_PERSIST_FIELD_LABELS: Record<string, string> = {
  specContent: "Spec",
  architectureContent: "Arquitectura",
  useCasesContent: "Casos de uso",
  userStoriesContent: "Historias de usuario",
  blueprintContent: "Blueprint",
  apiContractsContent: "Contratos API",
  logicFlowsContent: "Flujos de lógica",
  tasksContent: "Tasks",
  infraContent: "Infraestructura",
  dbgaContent: "DBGA",
  uxUiGuideContent: "Guía UX/UI",
  phase0SummaryContent: "Resumen Fase 0",
  aemContent: "AEM",

  agentGovernanceContent: "Gobernanza Agentes IA",
};

export function documentPersistFieldLabel(field: string): string {
  return DOCUMENT_PERSIST_FIELD_LABELS[field] ?? field;
}

/** Validates that a persisted document is not empty and does not wipe prior content. */
export function validateDocumentForPersist(
  current: string | null | undefined,
  next: string | null | undefined,
  opts?: { minBodyChars?: number; fieldLabel?: string },
): DocumentPersistValidation {
  const minBodyChars = opts?.minBodyChars ?? 80;
  const fieldLabel = opts?.fieldLabel ?? "documento";
  const prev = (current ?? "").trim();
  const trimmedNext = (next ?? "").trim();

  if (!trimmedNext) {
    if (prev.length >= minBodyChars) {
      return {
        ok: false,
        message: `No se puede vaciar ${fieldLabel} mientras tenga contenido sustancial.`,
      };
    }
    return { ok: true };
  }

  if (isChangelogOnlyDocument(trimmedNext, minBodyChars)) {
    return {
      ok: false,
      message: `El resultado no tiene contenido suficiente en ${fieldLabel} (vacío o solo registro de cambios); no se guardó.`,
    };
  }
  if (prev && wouldShrinkDocDangerously(prev, trimmedNext)) {
    return {
      ok: false,
      message: `El resultado borraría la mayor parte del ${fieldLabel} actual. Revisa la vista previa antes de aplicar.`,
    };
  }
  return { ok: true };
}
