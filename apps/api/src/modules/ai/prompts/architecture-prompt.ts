import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "..", "modules", "ai", "prompts", "architecture-prompt.md");

function loadArchitecturePrompt(): string {
    try {
        return readFileSync(PROMPT_PATH, "utf-8").trim();
    } catch {
        return "Eres un arquitecto de sistemas agenticos. Genera el documento de Arquitectura enfocada en orquestación de agentes y flujos de trabajo avanzada en markdown. Salida solo markdown, primer carácter #.";
    }
}

export const ARCHITECTURE_PROMPT = loadArchitecturePrompt();
