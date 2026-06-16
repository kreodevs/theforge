import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergePhase0Borrador, normalizePhase0Document } from "../phase0-normalize.util.js";
import type { Phase0Document } from "../phase0.types.js";

describe("normalizePhase0Document", () => {
  it("rellena estructura mínima cuando el LLM omite proposito", () => {
    const normalized = normalizePhase0Document({
      entidades: [{ nombre: "Pedido", descripcion: "Orden", atributosClave: ["total"] }],
    });

    assert.equal(normalized.proposito.problema, "");
    assert.deepEqual(normalized.proposito.usuarios, []);
    assert.equal(normalized.entidades.length, 1);
  });

  it("normaliza roles sin permisos para evitar join undefined", () => {
    const normalized = normalizePhase0Document({
      proposito: { problema: "Sistema de reservas", usuarios: ["Admin"], outOfScope: [] },
      roles: [{ rol: "Admin" }],
    });

    assert.deepEqual(normalized.roles, [{ rol: "Admin", permisos: [] }]);
  });

  it("merge conserva secciones previas si el patch viene vacío", () => {
    const base: Phase0Document = {
      proposito: {
        problema: "Problema base",
        usuarios: ["Ops"],
        outOfScope: ["Legacy"],
      },
      entidades: [{ nombre: "Cliente", descripcion: "x", atributosClave: [] }],
      reglasNegocio: ["Regla 1"],
      flujos: [],
      roles: [],
      integraciones: [],
      edgeCases: [],
      preguntasPendientes: [],
    };

    const merged = mergePhase0Borrador(
      base,
      normalizePhase0Document({
        roles: [{ rol: "Admin", permisos: ["ver"] }],
      }),
    );

    assert.equal(merged.proposito.problema, "Problema base");
    assert.equal(merged.entidades.length, 1);
    assert.deepEqual(merged.roles, [{ rol: "Admin", permisos: ["ver"] }]);
  });
});
