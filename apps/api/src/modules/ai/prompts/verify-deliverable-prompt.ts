import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esmDirname } from "../../../esm-helpers.js";

const __dirname = esmDirname(import.meta.url);
const PROMPT_PATH = join(__dirname, "verify-deliverable-prompt.md");

function loadVerifyDeliverablePrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return "Verifica si el documento generado cumple el MDD. Responde en una línea: Cumple o No cumple, y si no cumple lista 1-3 gaps concretos.";
  }
}

export const VERIFY_DELIVERABLE_PROMPT = loadVerifyDeliverablePrompt();
