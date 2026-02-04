import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "..", "modules", "ai", "prompts", "infra-prompt.md");

function loadInfraPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return `Genera el documento de Infraestructura y Despliegue en markdown: Dockerfile multietapa, docker-compose, .env.example, volúmenes. Basado en el MDD y Blueprint. Solo markdown, primer carácter #.`;
  }
}

export const INFRA_PROMPT = loadInfraPrompt();
