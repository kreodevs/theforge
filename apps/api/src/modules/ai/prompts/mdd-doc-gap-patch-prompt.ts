import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esmDirname } from "../../../esm-helpers.js";

const __dirname = esmDirname(import.meta.url);
const PROMPT_PATH = join(__dirname, "mdd-doc-gap-patch-prompt.md");

function loadMddDocGapPatchPrompt(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8").trim();
  } catch {
    return (
      "Parchea el MDD según gap_feedback en la sección referenciada. " +
      "Responde solo JSON: { mddContent: string }."
    );
  }
}

export const MDD_DOC_GAP_PATCH_PROMPT = loadMddDocGapPatchPrompt();
