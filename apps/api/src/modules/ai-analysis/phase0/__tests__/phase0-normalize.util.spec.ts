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

  it("merge añade reglasNegocio nuevas sin perder las previas", () => {
    const base: Phase0Document = {
      proposito: { problema: "P", usuarios: [], outOfScope: [] },
      entidades: [],
      reglasNegocio: ["Regla base"],
      flujos: [],
      roles: [],
      integraciones: [],
      edgeCases: [],
      preguntasPendientes: [],
    };

    const merged = mergePhase0Borrador(
      base,
      normalizePhase0Document({
        reglasNegocio: ["RN-001: aislamiento por tenant", "RN-002: relación 1:1"],
      }),
    );

    assert.deepEqual(merged.reglasNegocio, [
      "Regla base",
      "RN-001: aislamiento por tenant",
      "RN-002: relación 1:1",
    ]);
  });

  it("merge actualiza entidades por nombre sin borrar las demás", () => {
    const base: Phase0Document = {
      proposito: { problema: "P", usuarios: [], outOfScope: [] },
      entidades: [
        { nombre: "Tenant", descripcion: "Antigua", atributosClave: [] },
        { nombre: "Inversor", descripcion: "Sin cambios", atributosClave: [] },
      ],
      reglasNegocio: [],
      flujos: [],
      roles: [],
      integraciones: [],
      edgeCases: [],
      preguntasPendientes: [],
    };

    const merged = mergePhase0Borrador(
      base,
      normalizePhase0Document({
        entidades: [{ nombre: "Tenant", descripcion: "Relación 1:1 con Inversor", atributosClave: [] }],
      }),
    );

    assert.equal(merged.entidades.length, 2);
    assert.equal(merged.entidades.find((e) => e.nombre === "Tenant")?.descripcion, "Relación 1:1 con Inversor");
    assert.equal(merged.entidades.find((e) => e.nombre === "Inversor")?.descripcion, "Sin cambios");
  });
});
