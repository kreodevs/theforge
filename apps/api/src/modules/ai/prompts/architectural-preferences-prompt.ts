import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esmDirname } from "../../../esm-helpers.js";

const __dirname = esmDirname(import.meta.url);
const PROMPT_PATH = join(__dirname, "architectural-preferences-prompt.md");

function load(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return "Extrae del MDD un resumen breve (2–4 frases) de preferencias arquitectónicas: stack, seguridad, infra, nivel de rigor. Solo lo que el MDD explicita. Máximo ~200 palabras. Responde solo en texto plano.";
  }
}

export const ARCHITECTURAL_PREFERENCES_PROMPT = load();
