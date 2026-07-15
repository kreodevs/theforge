import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esmDirname } from "../../../esm-helpers.js";

const __dirname = esmDirname(import.meta.url);
const RULES_PATH = join(__dirname, "sdd-ui-ux-actionable-rules.md");

/** Reglas compartidas UI/UX accionables (append a prompts de entregables). */
export function loadSddUiUxActionableRules(): string {
  try {
    return readFileSync(RULES_PATH, "utf-8").trim();
  } catch {
    return (
      "UI accionable: una sola verdad visual en design-system.md; pantallas por journey en pantallas.md; " +
      "endpoints solo de api-contracts; componentes del MCP activo o shadcn/ui; estados loading/empty/error por pantalla crítica."
    );
  }
}

export function appendSddUiUxActionableRules(prompt: string): string {
  const base = prompt.trim();
  const rules = loadSddUiUxActionableRules();
  if (base.includes("Reglas SDD — UI/UX accionable")) return base;
  return `${base}\n\n---\n\n${rules}`;
}
