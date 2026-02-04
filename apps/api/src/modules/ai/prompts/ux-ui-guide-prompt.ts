/**
 * Carga el prompt de Guía UX/UI desde ux-ui-guide-prompt.md.
 * El documento se genera por entrevista (preguntas) y se guarda con delimitador ---FIN_UX_UI---.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "..", "modules", "ai", "prompts", "ux-ui-guide-prompt.md");

function loadUxUiGuidePrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return "Eres Lead UX/UI. Construye una Guía UX/UI mediante preguntas (marca, colores, prioridades). Cuando tengas suficiente info, genera el documento en markdown y termina con ---FIN_UX_UI---.";
  }
}

export const UX_UI_GUIDE_PROMPT = loadUxUiGuidePrompt();
