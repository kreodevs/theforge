import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dbgaReflectsUserEditIntent,
  isDbgaContentNearlyIdentical,
  looksLikeDbgaEditRequest,
} from "./dbga-edit.util.js";

describe("looksLikeDbgaEditRequest", () => {
  it("detecta petición de cambio multi-tenant", () => {
    assert.ok(
      looksLikeDbgaEditRequest(
        "Hay que hacer modificaciones. El catálogo debe ser multi tenant con tenant_id en OBP y OBP4MO",
      ),
    );
  });
});

describe("dbgaReflectsUserEditIntent", () => {
  it("falla si piden tenant_id y el doc no lo tiene", () => {
    const doc = "# Research Report\n\n## Módulo 01\nSin tenant.";
    const user =
      "todo el microservicio sea multi tenant lógico a través de un tenant_id";
    assert.equal(dbgaReflectsUserEditIntent(doc, user), false);
  });

  it("pasa si el doc incluye tenant_id", () => {
    const doc = "## Multi-tenancy\n`tenant_id` en catálogo y tablas espejo.";
    const user = "multi tenant con tenant_id";
    assert.equal(dbgaReflectsUserEditIntent(doc, user), true);
  });
});

describe("isDbgaContentNearlyIdentical", () => {
  it("detecta copias casi iguales", () => {
    const a = "x".repeat(10_000);
    const b = a + " ";
    assert.equal(isDbgaContentNearlyIdentical(b, a), true);
  });
});
