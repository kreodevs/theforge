/**
 * Carga el prompt del IntegrationAgent (redactor de handoff-spec.md).
 * Edita el .md; este loader lo lee en runtime (igual que legacy-documentation-prompt).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
const PROMPT_PATH = join(__dirname, "integration-agent-prompt.md");

const FALLBACK_PROMPT =
  "Eres el IntegrationAgent de The Forge. Redactas handoff-spec.md: traduces los items NEW-LEG propuestos por el equipo NEW en requerimientos técnicos para el equipo legacy, alineados con §3 (Modelo) y §4 (API) del MDD. Regla de Oro: no inventas items; solo organizas y profundizas los registrados, anclado en la evidencia de AriadneSpecs. Responde solo con el markdown del documento, en español.";

function loadIntegrationAgentPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch (err) {
    console.error("[integration-agent-prompt] No se pudo cargar integration-agent-prompt.md:", err);
    return FALLBACK_PROMPT;
  }
}

export const INTEGRATION_AGENT_PROMPT = loadIntegrationAgentPrompt();
