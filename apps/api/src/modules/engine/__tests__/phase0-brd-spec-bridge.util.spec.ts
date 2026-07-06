import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkPhase0BrdSpecBridge } from "../phase0-brd-spec-bridge.util.js";

describe("phase0-brd-spec-bridge", () => {
  it("detecta entidad Phase0 ausente en Spec", () => {
    const phase0Json = JSON.stringify({
      proposito: { problema: "X", usuarios: ["Admin"], outOfScope: [] },
      entidades: [{ nombre: "Lista de precios", descripcion: "Cat", atributosClave: [] }],
      reglasNegocio: [],
      flujos: [],
      roles: [],
      integraciones: [],
      edgeCases: [],
      preguntasPendientes: [],
    });
    const r = checkPhase0BrdSpecBridge({
      phase0SummaryContent: phase0Json,
      specContent:
        "## Objetivo\nSistema genérico de gestión operativa para usuarios internos sin módulo comercial.",
    });
    assert.equal(r.phase0Present, true);
    assert.equal(r.ok, false);
    assert.ok(r.gaps.some((g) => /Lista de precios|Phase0/i.test(g.item + g.hint)));
  });
});
