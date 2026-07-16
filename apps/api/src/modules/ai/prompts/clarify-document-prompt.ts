import { readFileSync } from "node:fs";
import { join } from "node:path";

const CLARIFY_PATH = join(__dirname, "clarify-document-prompt.md");
const RESOLVE_PATH = join(__dirname, "resolve-clarifications-prompt.md");

function loadPrompt(path: string, fallback: string): string {
  try {
    return readFileSync(path, "utf-8").trim();
  } catch {
    return fallback;
  }
}

export const CLARIFY_DOCUMENT_PROMPT = loadPrompt(
  CLARIFY_PATH,
  "Marca ambigüedades con [NEEDS CLARIFICATION: pregunta]. Añade ## Pendientes de clarificación. Solo markdown.",
);

export const RESOLVE_CLARIFICATIONS_PROMPT = loadPrompt(
  RESOLVE_PATH,
  "Integra las respuestas, elimina [NEEDS CLARIFICATION] y regenera el documento completo. Solo markdown.",
);
