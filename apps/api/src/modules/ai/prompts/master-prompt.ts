/**
 * Carga el prompt maestro desde master-prompt.md en esta misma carpeta.
 * Edita master-prompt.md para cambiar el comportamiento de la IA en la entrevista.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Nest copia los .md a dist/modules/ai/prompts/; __dirname en runtime es dist/apps/api/src/modules/ai/prompts/
const PROMPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "..", "modules", "ai", "prompts", "master-prompt.md");

function loadMasterPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch (err) {
    console.error("[master-prompt] No se pudo cargar master-prompt.md:", err);
    return "Eres el Asistente de Arquitectura de The Forge. Conduces una entrevista técnica para construir un Master Design Doc (MDD). Responde en el mismo idioma que el usuario.";
  }
}

export const MASTER_PROMPT = loadMasterPrompt();
