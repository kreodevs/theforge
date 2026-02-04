import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "..", "modules", "ai", "prompts", "discovery-benchmark-prompt.md");

function loadDiscoveryBenchmarkPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return `Eres un consultor de dominio. Genera un Domain Benchmark & Gap Analysis en markdown: 3 líderes de mercado, checklist de funciones estándar del dominio, y brechas de la idea del usuario respecto a ese estándar. Responde solo con markdown, primer carácter #.`;
  }
}

export const DISCOVERY_BENCHMARK_PROMPT = loadDiscoveryBenchmarkPrompt();
