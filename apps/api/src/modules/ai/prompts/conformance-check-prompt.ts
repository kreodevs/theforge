import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esmDirname } from "../../../esm-helpers.js";

const __dirname = esmDirname(import.meta.url);
const PROMPT_PATH = join(__dirname, "conformance-check-prompt.md");

function loadConformanceCheckPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return "Responde ÚNICAMENTE con JSON: { \"ok\": boolean, \"gaps\": string[] }. Si el documento cumple el MDD, ok: true y gaps: []. Si no, ok: false y gaps con 1-5 ítems concretos.";
  }
}

export const CONFORMANCE_CHECK_PROMPT = loadConformanceCheckPrompt();
