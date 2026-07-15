import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withDocumentChangelogInstructions } from "./with-document-changelog-instructions.js";
import { esmDirname } from "../../../esm-helpers.js";

const __dirname = esmDirname(import.meta.url);
const PROMPT_PATH = join(__dirname, "aem-prompt.md");

function loadAemPrompt(): string {
  try {
    return withDocumentChangelogInstructions(readFileSync(PROMPT_PATH, "utf-8").trim());
  } catch {
    return withDocumentChangelogInstructions(
      "Eres consultor de mercado. Genera un Análisis y Estudio de Mercado (AEM) en markdown con glosario y planes de monetización. Salida solo markdown, primer carácter #.",
    );
  }
}

export const AEM_PROMPT = loadAemPrompt();
