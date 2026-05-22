import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChatResponseParserService } from "./chat-response-parser.service.js";

const parser = new ChatResponseParserService();

describe("mergeDbgaOrUseFull", () => {
  const longDbga = `# Domain Benchmark & Gap Analysis

## Referencia de Industria
Contenido largo del benchmark original con muchos módulos y tablas.

## Módulo 07
Feature candidates existentes.`;

  it("conserva el documento si el modelo manda solo un fragmento corto", () => {
    const fragment = `## Dos objetivos centrales del microservicio
Listas de precios con niveles y márgenes.
Endpoint Odoo para costos reales.`;
    const merged = parser.mergeDbgaOrUseFull(longDbga, fragment);
    assert.ok(merged.includes("Referencia de Industria"));
    assert.ok(merged.includes("Dos objetivos centrales"));
    assert.ok(merged.length > longDbga.length * 0.9);
  });

  it("acepta reemplazo cuando el nuevo doc parece DBGA completo", () => {
    const full = `${longDbga}\n\n## Nuevo bloque\nMás texto.`.repeat(2);
    const merged = parser.mergeDbgaOrUseFull(longDbga, full);
    assert.equal(merged, full.trim());
  });
});
