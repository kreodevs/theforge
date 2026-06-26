import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withDocumentChangelogInstructions } from "./with-document-changelog-instructions.js";

const PROMPT_PATH = join(__dirname, "aem-investment-advisor-prompt.md");

function loadAemInvestmentAdvisorPrompt(): string {
  try {
    return withDocumentChangelogInstructions(readFileSync(PROMPT_PATH, "utf-8").trim());
  } catch {
    return withDocumentChangelogInstructions(
      "Eres experto en inversiones digitales. Analiza el AEM y emite dictamen SEGUIR / NO SEGUIR / SEGUIR CON CONDICIONES en markdown.",
    );
  }
}

export const AEM_INVESTMENT_ADVISOR_PROMPT = loadAemInvestmentAdvisorPrompt();
