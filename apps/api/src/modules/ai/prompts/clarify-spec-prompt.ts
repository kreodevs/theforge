import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "clarify-spec-prompt.md");

function loadClarifySpecPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return (
      "Revisa el Spec y marca ambigüedades con [NEEDS CLARIFICATION: pregunta]. " +
      "Añade ## Pendientes de clarificación al final si quedan marcadores. Solo markdown."
    );
  }
}

export const CLARIFY_SPEC_PROMPT = loadClarifySpecPrompt();
