/**
 * Carga el prompt de refinado del Benchmark (Paso 0) desde phase0-benchmark-refine-prompt.md.
 * La IA devuelve el documento actualizado y termina con ---FIN_DBGA---.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "phase0-benchmark-refine-prompt.md");

function loadBenchmarkRefinePrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return "Eres consultor de dominio. El usuario tiene un Benchmark & Gap Analysis y pide cambios. Devuelve el documento completo actualizado en markdown y termina con ---FIN_DBGA---, luego un mensaje breve para el chat.";
  }
}

export const BENCHMARK_REFINE_PROMPT = loadBenchmarkRefinePrompt();
