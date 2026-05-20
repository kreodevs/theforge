/**
 * Carga el prompt para proyectos legacy (documentación de cambios con TheForge).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "legacy-documentation-prompt.md");

function loadLegacyPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch (err) {
    console.error("[legacy-prompt] No se pudo cargar legacy-documentation-prompt.md:", err);
    return "Eres un asistente de documentación de cambios en proyectos legacy. Basa tus respuestas en el contexto proporcionado (TheForge). Responde en español.";
  }
}

export const LEGACY_DOCUMENTATION_PROMPT = loadLegacyPrompt();
