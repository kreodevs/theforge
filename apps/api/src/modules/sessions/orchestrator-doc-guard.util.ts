import {
  isHypotheticalDocumentEditOffer,
  looksLikeDbgaEditRequest,
  workshopPanelPersistFailedChatNote,
} from "@theforge/shared-types";

/** Tabs del orquestador que persisten documento vía ---FIN_TAG---. */
export const ORCHESTRATOR_DOC_TABS = new Set([
  "spec",
  "architecture",
  "use-cases",
  "user-stories",
  "blueprint",
  "api-contracts",
  "logic-flows",
  "tasks",
  "infra",
  "brd",
  "benchmark",
  "ux-ui-guide",
  "phase0",
  "mdd",
]);

const DOC_CLAIMS_EDIT_RE =
  /\b(ajust(?:e|é|amos|ado)|ajust(?:e|é)|elimin(?:e|é|amos|ado)|actualic(?:e|é|amos|ado)|modifiqu(?:e|é|amos|ado)|reescrib(?:i|í|imos|ido)|integr(?:e|é|amos|ado|ando)|incorpor(?:e|é|amos|ado|ando)|ya\s+no\s+(contiene|menciona|incluye)|sin\s+referencias|sin\s+menciones|qued[oó]\s+(ajustad|actualizad)|hemos\s+(ajustad|actualizad|eliminad|modificad|integrad|incorporad)|no\s+(contiene|menciona|incluye)\s+(ya|más)|se\s+(ajust|actualiz|modific|elimin|integr)[oa]|documento\s+(est[aá]|qued[oó])|he\s+(actualizado|modificado|eliminado|ajustado|integrado|incorporado)|actualizaci[oó]n\s+(complet|realiz)|cambios?\s+(aplicad|realizad|incorporad)|el\s+cambio\s+ya\s+est[aá]\s+reflejado|reflejado\s+en\s+el\s+panel)\b/i;

const CHANGE_INTENT_RE =
  /\b(no\s+veo\s+(los\s+)?cambios|sigue\s+(haciendo\s+)?menci|a[uú]n\s+(dice|menciona|tiene|aparece|contiene)|no\s+se\s+(reflej|aplic|guard)|documento\s+sigue|persiste|sigue\s+igual|no\s+se\s+usar[aá]?|cambiar|cambio|reemplaz|sustitu|modific|actualiz|eliminar|quita(?:r|n|do)?|en\s+vez\s+de|en\s+lugar\s+de|ajust|agrega|añade|corrige|integra|incorpor|aplica(?:r)?\s+(los\s+)?cambios|al\s+documento|haz\s+las\s+modific|kill\s*switch|tablero|aprobaci[oó]n)\b/i;

export function chatClaimsDocumentWasModified(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 20) return false;
  if (isHypotheticalDocumentEditOffer(t)) return false;
  return DOC_CLAIMS_EDIT_RE.test(t);
}

export function looksLikeOrchestratorDocModificationRequest(msg: string): boolean {
  const t = (msg ?? "").trim();
  if (t.length < 8) return false;
  if (/^\s*¿/.test(t) && !CHANGE_INTENT_RE.test(t)) return false;
  return CHANGE_INTENT_RE.test(t);
}

export type DocPersistFlags = {
  hasMdd?: boolean;
  hasSpec?: boolean;
  hasArch?: boolean;
  hasUseCases?: boolean;
  hasStories?: boolean;
  hasBlue?: boolean;
  hasApi?: boolean;
  hasFlows?: boolean;
  hasTasks?: boolean;
  hasInfra?: boolean;
  hasBrd?: boolean;
  hasDbga?: boolean;
  hasUx?: boolean;
  hasPhase0?: boolean;
};

export function docWasPersistedForTab(tab: string, flags: DocPersistFlags): boolean {
  switch (tab) {
    case "mdd":
      return Boolean(flags.hasMdd);
    case "spec":
      return Boolean(flags.hasSpec);
    case "architecture":
      return Boolean(flags.hasArch);
    case "use-cases":
      return Boolean(flags.hasUseCases);
    case "user-stories":
      return Boolean(flags.hasStories);
    case "blueprint":
      return Boolean(flags.hasBlue);
    case "api-contracts":
      return Boolean(flags.hasApi);
    case "logic-flows":
      return Boolean(flags.hasFlows);
    case "tasks":
      return Boolean(flags.hasTasks);
    case "infra":
      return Boolean(flags.hasInfra);
    case "brd":
      return Boolean(flags.hasBrd);
    case "benchmark":
      return Boolean(flags.hasDbga);
    case "ux-ui-guide":
      return Boolean(flags.hasUx);
    case "phase0":
      return Boolean(flags.hasPhase0);
    default:
      return false;
  }
}

export function currentDocLengthForTab(
  tab: string,
  options?: {
    currentMddContent?: string;
    currentSpecContent?: string;
    currentArchitectureContent?: string;
    currentUseCasesContent?: string;
    currentUserStoriesContent?: string;
    currentBlueprintContent?: string;
    currentApiContractsContent?: string;
    currentLogicFlowsContent?: string;
    currentTasksContent?: string;
    currentInfraContent?: string;
    currentBrdContent?: string;
    currentDbgaContent?: string;
    currentUxUiGuideContent?: string;
    currentPhase0SummaryContent?: string;
  },
): number {
  const pick = (v?: string) => (v ?? "").trim().length;
  switch (tab) {
    case "mdd":
      return pick(options?.currentMddContent);
    case "spec":
      return pick(options?.currentSpecContent);
    case "architecture":
      return pick(options?.currentArchitectureContent);
    case "use-cases":
      return pick(options?.currentUseCasesContent);
    case "user-stories":
      return pick(options?.currentUserStoriesContent);
    case "blueprint":
      return pick(options?.currentBlueprintContent);
    case "api-contracts":
      return pick(options?.currentApiContractsContent);
    case "logic-flows":
      return pick(options?.currentLogicFlowsContent);
    case "tasks":
      return pick(options?.currentTasksContent);
    case "infra":
      return pick(options?.currentInfraContent);
    case "brd":
      return pick(options?.currentBrdContent);
    case "benchmark":
      return pick(options?.currentDbgaContent);
    case "ux-ui-guide":
      return pick(options?.currentUxUiGuideContent);
    case "phase0":
      return pick(options?.currentPhase0SummaryContent);
    default:
      return 0;
  }
}

export function appendOrchestratorDocNotPersistedWarning(
  assistantContent: string,
  tab: string,
  opts?: { hadDelimiter?: boolean },
): string {
  const detail = workshopPanelPersistFailedChatNote(tab, opts?.hadDelimiter);
  const warning = `\n\n⚠️ **El documento del panel no se actualizó.** ${detail}`;
  if (assistantContent.includes("El documento del panel no se actualizó")) return assistantContent;
  return `${assistantContent.trim()}${warning}`;
}

export function shouldWarnOrchestratorDocNotPersisted(params: {
  tab: string;
  userMessage: string;
  assistantContent: string;
  flags: DocPersistFlags;
  currentDocLen: number;
  /** Si se conoce el resultado real de persistencia (p. ej. benchmark tras resolveDbgaContentForReturn). */
  docPersisted?: boolean;
  /** El modelo emitió bloque ---FIN_*--- o fallback de documento. */
  hadDelimiter?: boolean;
}): boolean {
  const { tab, userMessage, assistantContent, flags, currentDocLen, docPersisted, hadDelimiter } =
    params;
  if (!ORCHESTRATOR_DOC_TABS.has(tab)) return false;
  if (currentDocLen < 80) return false;
  const persisted = docPersisted ?? docWasPersistedForTab(tab, flags);
  if (persisted) return false;
  if (hadDelimiter) return true;
  const userWantsEdit =
    tab === "benchmark"
      ? looksLikeDbgaEditRequest(userMessage)
      : looksLikeOrchestratorDocModificationRequest(userMessage);
  return userWantsEdit || chatClaimsDocumentWasModified(assistantContent);
}
