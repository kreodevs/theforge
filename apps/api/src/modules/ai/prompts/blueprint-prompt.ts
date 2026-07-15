import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withDocumentChangelogInstructions } from "./with-document-changelog-instructions.js";
import { appendSddUiUxActionableRules } from "./sdd-ui-ux-actionable-rules.js";
import { esmDirname } from "../../../esm-helpers.js";

// Nest copia *.md a dist; misma convención que master-prompt
const __dirname = esmDirname(import.meta.url);
const PROMPT_PATH = join(__dirname, "blueprint-prompt.md");

function loadBlueprintPrompt(): string {
  try {
    return appendSddUiUxActionableRules(withDocumentChangelogInstructions(readFileSync(PROMPT_PATH, "utf-8").trim()));
  } catch {
    return withDocumentChangelogInstructions(
      `Eres arquitecto técnico. Genera blueprint.md desde el MDD: stack explícito, mapa de rutas §4 a módulos backend, componentes transversales (IA, pipeline, grafo) si aplican, trazabilidad con §5, sin duplicar el modelo SQL si §3 ya es canónico. Markdown, primer carácter #.`,
    );
  }
}

export const BLUEPRINT_PROMPT = loadBlueprintPrompt();
