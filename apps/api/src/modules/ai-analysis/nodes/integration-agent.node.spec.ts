import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IntegrationHandoffItem } from "@theforge/shared-types";
import {
  buildItemQuestion,
  extractCandidateSymbols,
  extractDomainKeywords,
} from "./integration-agent.node.js";

describe("extractCandidateSymbols", () => {
  it("captures quoted, PascalCase and suffixed identifiers", () => {
    const out = extractCandidateSymbols("Modificar `MedioService` y el MedioController para Endpoint");
    assert.ok(out.includes("MedioService"));
  });

  it("returns empty for plain prose without identifiers", () => {
    assert.deepEqual(extractCandidateSymbols("mostrar costos asociados por medio"), []);
  });
});

describe("extractDomainKeywords", () => {
  it("captures snake_case table-like tokens missed by symbol extraction", () => {
    const out = extractDomainKeywords("Verificar si existe la tabla medio_costo o catalogo_costos");
    assert.ok(out.includes("medio_costo"));
    assert.ok(out.includes("catalogo_costos"));
  });

  it("captures API path segments and drops api/version noise", () => {
    const out = extractDomainKeywords("Exponer GET /api/v1/medios/{id}/costos");
    assert.ok(out.includes("medios"));
    assert.ok(out.includes("costos"));
    assert.ok(!out.includes("api"));
    assert.ok(!out.includes("v1"));
  });

  it("drops short words and common stopwords", () => {
    const out = extractDomainKeywords("debe mostrar para cada medio");
    assert.ok(!out.includes("para"));
    assert.ok(!out.includes("debe"));
    assert.ok(out.includes("medio"));
  });
});

describe("buildItemQuestion", () => {
  it("frames a model + API grounded question for the legacy project", () => {
    const item: IntegrationHandoffItem = {
      id: "NEW-LEG-03",
      title: "Costos por medio",
      description: "Relacionar medio con costos.",
      status: "sent",
    };
    const q = buildItemQuestion(item, "OBP");
    assert.ok(q.includes("OBP"));
    assert.ok(q.includes("Costos por medio"));
    assert.ok(q.includes("tablas, columnas o relaciones"));
    assert.ok(q.includes("endpoints"));
  });
});
