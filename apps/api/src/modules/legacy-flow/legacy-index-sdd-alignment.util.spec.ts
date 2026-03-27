import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateLegacyIndexSddGate } from "./legacy-index-sdd-alignment.util.js";

const blob = (s: string) => s.toLowerCase();

test("evaluateLegacyIndexSddGate: ok sin SDD rico", () => {
  const r = evaluateLegacyIndexSddGate(
    { semanticChunks: ["x".repeat(100)], chosenPaths: [], indexBlobLower: blob("x".repeat(100)) },
    { entityNames: ["a"], endpoints: [] },
    true,
  );
  assert.equal(r.blocking, false);
});

test("evaluateLegacyIndexSddGate: índice vacío y SDD rico → bloqueo", () => {
  const r = evaluateLegacyIndexSddGate(
    { semanticChunks: [""], chosenPaths: [], indexBlobLower: "" },
    { entityNames: ["users", "orders", "items"], endpoints: [{ method: "GET", path: "/api/v1/x" }] },
    false,
  );
  assert.equal(r.blocking, true);
  assert.equal(r.reason, "empty_index_vs_rich_sdd");
});

test("evaluateLegacyIndexSddGate: bajo solapamiento de entidades → bloqueo", () => {
  const sdd = {
    entityNames: ["Invoice", "Customer", "LineItem", "TaxRate"],
    endpoints: [{ method: "GET", path: "/health" }],
  };
  const indexText = "solo habla de foo y bar sin nombres de tablas";
  const r = evaluateLegacyIndexSddGate(
    {
      semanticChunks: [indexText],
      chosenPaths: ["src/misc.ts"],
      indexBlobLower: blob(indexText + " src/misc.ts"),
    },
    sdd,
    true,
  );
  assert.equal(r.blocking, true);
  assert.equal(r.reason, "low_entity_overlap");
});

test("evaluateLegacyIndexSddGate: rutas SDD presentes en índice → ok", () => {
  const sdd = {
    entityNames: ["Invoice"],
    endpoints: [
      { method: "POST", path: "/api/v1/invoices" },
      { method: "GET", path: "/api/v1/invoices" },
    ],
  };
  const indexText =
    "El controlador expone POST /api/v1/invoices y GET /api/v1/invoices; tabla Invoice en prisma.";
  const r = evaluateLegacyIndexSddGate(
    {
      semanticChunks: [indexText],
      chosenPaths: ["apps/api/src/invoices/invoices.controller.ts"],
      indexBlobLower: blob(indexText + " apps/api/src/invoices/invoices.controller.ts"),
    },
    sdd,
    true,
  );
  assert.equal(r.blocking, false);
});
