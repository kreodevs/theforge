import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withDocumentChangelogInstructions } from "./with-document-changelog-instructions.js";

const PROMPT_PATH = join(__dirname, "integration-spec-prompt.md");

function loadIntegrationSpecPrompt(): string {
  try {
    return withDocumentChangelogInstructions(readFileSync(PROMPT_PATH, "utf-8").trim());
  } catch {
    return withDocumentChangelogInstructions(
      `Genera el Integration Spec (ISD) en markdown (# Integration Spec — {proyecto}): secciones 0–9 (Metadata, Mapa de sistemas, Ownership de datos, Contratos por frontera, Secuencias Mermaid cruzando frontera, Mapeo interacción↔sistema, Resiliencia, Orden de habilitación, Cumplimiento MDD, Discrepancias). Sin integraciones externas: ISD mínimo con clasificación "Sin integraciones externas" y cumplimiento "No aplica ☑". Basado en el MDD; solo lógica que cruza frontera (no duplicar logic-flows ni Infra). Solo markdown, primer carácter #. Termina con ---FIN_INTEGRATION_SPEC---`,
    );
  }
}

export const INTEGRATION_SPEC_PROMPT = loadIntegrationSpecPrompt();
