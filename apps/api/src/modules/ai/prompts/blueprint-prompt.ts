import { readFileSync } from "node:fs";
import { join } from "node:path";

// Nest copia *.md a dist; misma convención que master-prompt
const PROMPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "..", "modules", "ai", "prompts", "blueprint-prompt.md");

function loadBlueprintPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return `Eres un arquitecto técnico. Genera el contenido de blueprint.md a partir del MDD: estructura Turborepo, esquema Prisma (PostgreSQL con UUID/JSONB), arquitectura modular NestJS. Responde solo con el markdown, sin preamble.`;
  }
}

export const BLUEPRINT_PROMPT = loadBlueprintPrompt();
