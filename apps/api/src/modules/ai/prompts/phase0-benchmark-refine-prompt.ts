/**
 * Carga el prompt de refinado del Benchmark (Paso 0) desde phase0-benchmark-refine-prompt.md.
 * La IA devuelve el documento actualizado y termina con ---FIN_DBGA---.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withDocumentChangelogInstructions } from "./with-document-changelog-instructions.js";
import { PHASE0_MARKDOWN_FORMAT_RULES } from "../../ai-analysis/prompts/load-prompts.js";
const PROMPT_PATH = join(__dirname, "phase0-benchmark-refine-prompt.md");

function loadBenchmarkRefinePrompt(): string {
  try {
    return withDocumentChangelogInstructions(
      `${readFileSync(PROMPT_PATH, "utf-8").trim()}\n\n${PHASE0_MARKDOWN_FORMAT_RULES}`,
    );
  } catch {
    return withDocumentChangelogInstructions(
      "Eres consultor de dominio. El usuario tiene un Benchmark & Gap Analysis y pide cambios. Devuelve el documento completo actualizado en markdown y termina con ---FIN_DBGA---, luego un mensaje breve para el chat.\n\n" +
        PHASE0_MARKDOWN_FORMAT_RULES,
    );
  }
}

export const BENCHMARK_REFINE_PROMPT = loadBenchmarkRefinePrompt();
