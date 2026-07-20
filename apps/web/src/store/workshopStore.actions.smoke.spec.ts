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

const STORE_PATH = join(dirname(fileURLToPath(import.meta.url)), "workshopStore.ts");

describe("smoke workshopStore contract (Fase 0)", () => {
  it("workshopStore.ts define todas las acciones del contrato", () => {
    const source = readFileSync(STORE_PATH, "utf8");
    for (const action of WORKSHOP_STORE_CONTRACT_ACTIONS) {
      const pattern = new RegExp(`\\b${action}\\s*:\\s*(async\\s*)?\\(`);
      assert.match(
        source,
        pattern,
        `workshopStore.ts must define action ${action}`,
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
