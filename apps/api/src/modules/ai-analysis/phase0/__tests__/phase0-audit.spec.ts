import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeGaps, isAskableGap } from "../phase0-gap-analyzer.js";
import type { Phase0Document } from "../phase0.types.js";

const completeBorrador = (): Phase0Document => ({
  proposito: {
    problema: "Gestión de costos publicitarios OOH con márgenes dinámicos",
    usuarios: ["Operaciones", "Admin de precios"],
    outOfScope: ["Facturación fiscal"],
  },
  entidades: [
    { nombre: "Lista de precios", descripcion: "Catálogo", atributosClave: ["moneda"] },
    { nombre: "Costo real", descripcion: "Desde ERP", atributosClave: ["monto"] },
  ],
  reglasNegocio: ["Margen mínimo por lista"],
  flujos: [{ nombre: "Sincronización ERP", pasos: ["Importar", "Validar"] }],
  roles: [{ rol: "Operaciones", permisos: ["Ver costos"] }],
  integraciones: ["Odoo"],
  edgeCases: ["Tipo de cambio no disponible"],
  preguntasPendientes: [],
  riesgos: [
    {
      id: "R-01",
      nombre: "Tipo de cambio",
      impacto: "Medio",
      probabilidad: "Media",
      mitigacion: "Cache diario + fallback manual",
    },
  ],
  criteriosUAT: [
    { id: "UAT-01", descripcion: "Crear lista con margen válido" },
  ],
});

describe("phase0 audit gaps", () => {
  it("borrador completo no tiene gaps askables", () => {
    const gaps = analyzeGaps(completeBorrador());
    assert.equal(gaps.filter(isAskableGap).length, 0);
  });

  it("borrador sin roles genera gaps askables", () => {
    const b = completeBorrador();
    b.roles = [];
    const gaps = analyzeGaps(b);
    assert.ok(gaps.some((g) => g.seccion === "roles" && isAskableGap(g)));
  });
});
