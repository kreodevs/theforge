import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "evd-prompt.md");

function loadEvdPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return `Eres un director creativo de presentaciones ejecutivas. Genera un Executive Vision Deck (EVD) en formato JSON con slides, charts, wireframes y narrativa ejecutiva. Salida solo JSON válido.`;
  }
}

export const EVD_PROMPT = loadEvdPrompt();
