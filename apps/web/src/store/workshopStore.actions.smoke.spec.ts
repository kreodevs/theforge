/**
 * Smoke — contrato de acciones de useWorkshopStore (Fase 0, GOD-REFACTOR).
 * Analiza el source sin cargar el módulo (evita import.meta.env de Vite en Node).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  WORKSHOP_STORE_CONTRACT_ACTIONS,
  type WorkshopStoreContractAction,
} from "./workshop-store.contract.ts";

const STORE_DIR = join(dirname(fileURLToPath(import.meta.url)), "workshop");
const STORE_PATH = join(dirname(fileURLToPath(import.meta.url)), "workshopStore.ts");
const SLICE_PATHS = [
  join(STORE_DIR, "slice-ui.ts"),
  join(STORE_DIR, "slice-project.ts"),
  join(STORE_DIR, "slice-session-chat.ts"),
  join(STORE_DIR, "slice-mdd.ts"),
];

function workshopStoreSource(): string {
  const parts = [readFileSync(STORE_PATH, "utf8")];
  for (const slicePath of SLICE_PATHS) {
    parts.push(readFileSync(slicePath, "utf8"));
  }
  return parts.join("\n");
}

describe("smoke workshopStore contract (Fase 0)", () => {
  it("workshopStore compone todas las acciones del contrato", () => {
    const source = workshopStoreSource();
    for (const action of WORKSHOP_STORE_CONTRACT_ACTIONS) {
      const pattern = new RegExp(`\\b${action}\\s*:\\s*(async\\s*)?\\(`);
      assert.match(
        source,
        pattern,
        `workshop store must define action ${action}`,
      );
    }
  });

  it("contrato incluye acciones críticas de chat y entregables", () => {
    const required: WorkshopStoreContractAction[] = [
      "sendMessage",
      "persistMddContent",
      "generateDeliverablesCascade",
    ];
    for (const action of required) {
      assert.ok(
        (WORKSHOP_STORE_CONTRACT_ACTIONS as readonly string[]).includes(action),
        `contract must list ${action}`,
      );
    }
  });
});
