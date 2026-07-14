import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  documentPersistFieldLabel,
  validateDocumentForPersist,
  wouldShrinkDocDangerously,
} from "./document-persist-validation.js";

describe("document-persist-validation", () => {
  it("wouldShrinkDocDangerously rechaza reemplazo de 15k por 2.5k con H1 (floor abs eliminado)", () => {
    const current = "# Domain Benchmark\n\n" + "x".repeat(15_000);
    const next = "# Domain Benchmark\n\n" + "y".repeat(2500);
    assert.equal(wouldShrinkDocDangerously(current, next), true);
  });

  it("wouldShrinkDocDangerously permite doc ≥70% con H1", () => {
    const current = "# Spec\n\n" + "a".repeat(5000);
    const next = "# Spec\n\n" + "b".repeat(3600);
    assert.equal(wouldShrinkDocDangerously(current, next), false);
  });

  it("validateDocumentForPersist rechaza changelog-only", () => {
    const shell =
      "## Registro de cambios del documento\n\n| Versión | Fecha | Descripción del cambio |\n| --- | --- | --- |\n| 1.0 | Junio 2026 | Creación inicial del documento |";
    const result = validateDocumentForPersist(null, shell, { fieldLabel: "Spec" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /no se guardó/);
    }
  });

  it("validateDocumentForPersist permite spec sustancial", () => {
    const current = "# Spec\n\n".padEnd(500, "a");
    const next = "# Spec\n\nContenido aclarado con alcance y criterios de éxito detallados.\n\n".padEnd(
      400,
      "b",
    );
    const result = validateDocumentForPersist(current, next, { fieldLabel: "Spec" });
    assert.equal(result.ok, true);
  });

  it("validateDocumentForPersist rechaza vaciar spec con contenido previo", () => {
    const current = "# Spec\n\n".padEnd(200, "x");
    const result = validateDocumentForPersist(current, "", { fieldLabel: "Spec" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /No se puede vaciar Spec/);
    }
  });

  it("documentPersistFieldLabel resuelve specContent", () => {
    assert.equal(documentPersistFieldLabel("specContent"), "Spec");
  });
});
