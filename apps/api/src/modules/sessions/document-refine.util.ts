import { documentLabelForTab } from "../ai/intent-router.util.js";
import { WORKSHOP_TAB_FIN_TAG } from "./workshop-document-turn.util.js";

export function finTagForWorkshopTab(tab: string): string | undefined {
  return WORKSHOP_TAB_FIN_TAG[tab.trim()];
}

export function buildDocumentRefinePrompt(tab: string, userMessage: string): string | null {
  const finTag = finTagForWorkshopTab(tab);
  if (!finTag || tab === "benchmark") return null;

  const label = documentLabelForTab(tab);
  const msg = userMessage.trim();
  if (!msg) return null;

  return (
    `Aplica OBLIGATORIAMENTE al documento completo los cambios que pide el usuario. ` +
    `No respondas solo en chat: devuelve el **${label}** COMPLETO en markdown y termina con la línea exacta ---FIN_${finTag}---.\n\n` +
    `**Anti-borrado (crítico):** Conserva TODAS las secciones existentes del documento actual. ` +
    `Si el usuario aporta un fragmento corto, fusiónalo en la sección adecuada — NUNCA reemplaces el documento entero por solo ese fragmento.\n\n` +
    `Petición del usuario:\n---\n${msg}\n---`
  );
}

/** Campo `current*Content` de GenerateResponseOptions por pestaña. */
export function currentDocFieldForTab(tab: string): keyof {
  currentMddContent: string;
  currentSpecContent: string;
  currentBrdContent: string;
  currentBlueprintContent: string;
  currentArchitectureContent: string;
  currentUseCasesContent: string;
  currentUserStoriesContent: string;
  currentApiContractsContent: string;
  currentLogicFlowsContent: string;
  currentTasksContent: string;
  currentInfraContent: string;
  currentUxUiGuideContent: string;
  currentPhase0SummaryContent: string;
} | null {
  switch (tab.trim()) {
    case "mdd":
      return "currentMddContent";
    case "spec":
      return "currentSpecContent";
    case "brd":
      return "currentBrdContent";
    case "blueprint":
      return "currentBlueprintContent";
    case "architecture":
      return "currentArchitectureContent";
    case "use-cases":
      return "currentUseCasesContent";
    case "user-stories":
      return "currentUserStoriesContent";
    case "api-contracts":
      return "currentApiContractsContent";
    case "logic-flows":
      return "currentLogicFlowsContent";
    case "tasks":
      return "currentTasksContent";
    case "infra":
      return "currentInfraContent";
    case "ux-ui-guide":
      return "currentUxUiGuideContent";
    case "phase0":
      return "currentPhase0SummaryContent";
    default:
      return null;
  }
}

export function buildLlmCurrentDocOptions(
  tab: string,
  currentDoc: string,
): Record<string, string> {
  const field = currentDocFieldForTab(tab);
  if (!field) return {};
  return { [field]: currentDoc };
}
