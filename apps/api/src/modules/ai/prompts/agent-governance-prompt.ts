import { readFileSync } from "node:fs";
import { join } from "node:path";
const PROMPT_PATH = join(__dirname, "agent-governance-prompt.md");

function loadAgentGovernancePrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return (
      "Genera un objeto JSON con clave `files` (ruta relativa → contenido) para el scaffold agent-governance/ " +
      "derivado del MDD §1–§7. Salida: solo JSON, primer carácter `{`."
    );
  }
}

export const AGENT_GOVERNANCE_PROMPT = loadAgentGovernancePrompt();
