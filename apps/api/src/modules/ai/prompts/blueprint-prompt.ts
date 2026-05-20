import { readFileSync } from "node:fs";
import { join } from "node:path";

// Nest copia *.md a dist; misma convención que master-prompt
const PROMPT_PATH = join(__dirname, "blueprint-prompt.md");

function loadBlueprintPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return `Eres arquitecto técnico. Genera blueprint.md desde el MDD: stack explícito, mapa de rutas §4 a módulos backend, componentes transversales (IA, pipeline, grafo) si aplican, trazabilidad con §5, sin duplicar el modelo SQL si §3 ya es canónico. Markdown, primer carácter #.`;
  }
}

export const BLUEPRINT_PROMPT = loadBlueprintPrompt();
