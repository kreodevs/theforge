import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "..", "modules", "ai", "prompts", "architecture-prompt.md");

function loadArchitecturePrompt(): string {
    try {
        return readFileSync(PROMPT_PATH, "utf-8").trim();
    } catch {
        return "Eres arquitecto de software del producto descrito en el MDD. Genera arquitectura técnica (módulos, datos, APIs) en markdown; no inventes agentes LLM ni titules el sistema como TheForge. Primer carácter #.";
    }
}

export const ARCHITECTURE_PROMPT = loadArchitecturePrompt();
