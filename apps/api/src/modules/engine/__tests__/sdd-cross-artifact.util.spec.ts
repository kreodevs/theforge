import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkSpecVsMdd,
  checkTasksCoverage,
  checkUserStoriesVsUseCases,
} from "../sdd-cross-artifact.util.js";

describe("sdd-cross-artifact", () => {
  it("checkUserStoriesVsUseCases detecta UC ausente", () => {
    const hu =
      "## HU-01 Login\nComo usuario quiero autenticarme para acceder al panel de control del sistema.";
    const r = checkUserStoriesVsUseCases(hu, null);
    assert.equal(r.ok, false);
    assert.ok(r.gaps.some((g) => /Casos de uso ausentes/i.test(g)));
  });

  it("checkSpecVsMdd reporta concepto Spec sin MDD", () => {
    const spec =
      "### Facturación electrónica\nRequisito fiscal obligatorio para timbrado CFDI en México con validación SAT.";
    const mdd =
      "## 1. Contexto\nSolo inventario de productos y catálogo interno.\n" +
      "## 3. Modelo de Datos\nCREATE TABLE items (id uuid primary key, sku varchar(64));\n" +
      "TechnicalMetadata [external_api]\n## 4. Contratos de API\nGET /items\n```json\n{}\n```";
    const r = checkSpecVsMdd(spec, mdd);
    assert.equal(r.ok, false);
    assert.ok(r.gaps.length > 0);
  });

  it("checkTasksCoverage detecta endpoints API sin tarea", () => {
    const api =
      "### POST /payments\n### GET /reports\n### DELETE /sessions\nEndpoints REST del módulo de cobros.";
    const tasks = "- [ ] T001 Configurar documentación inicial del repositorio y README del proyecto.";
    const r = checkTasksCoverage(tasks, null, api);
    assert.equal(r.ok, false);
  });
});
