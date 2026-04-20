import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROMPT_FILE = "staged-discovery-mdd-prompt.md";

/**
 * Carga el system prompt del descubrimiento escalonado MDD (Plan-and-Execute).
 * Runtime: `dist/.../legacy-flow/prompts/` vía assets de nest-cli.
 */
export function loadStagedDiscoveryMddPrompt(): string {
  const p = join(__dirname, "prompts", PROMPT_FILE);
  if (!existsSync(p)) {
    return "";
  }
  try {
    return readFileSync(p, "utf-8").trim();
  } catch {
    return "";
  }
}

const PLACEHOLDER = "{{theforgeProjectId}}";

/**
 * Sustituye `{{theforgeProjectId}}` en el prompt cargado para que el modelo repita el UUID en cada tool call (requerido por Ariadne MCP).
 */
export function hydrateStagedDiscoveryMddPrompt(template: string, theforgeProjectId: string): string {
  if (!template) return "";
  return template.split(PLACEHOLDER).join(theforgeProjectId.trim());
}
