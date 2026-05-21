import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichMddWithUiUxDesignIntent } from "./mdd-enrich-uiux-intent.js";

const MDD_WITH_ENTITIES = `# Master Design Document

## 1. Contexto

Contexto mínimo.

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE orders (id UUID PRIMARY KEY, status TEXT NOT NULL);
CREATE TABLE customers (id UUID PRIMARY KEY, email TEXT NOT NULL);
\`\`\`

## 4. Contratos de API

| Método | Ruta |
|--------|------|
| GET | /orders |
`;

describe("enrichMddWithUiUxDesignIntent", () => {
  it("anexa ## UI/UX Design Intent cuando hay entidades en §3", () => {
    const out = enrichMddWithUiUxDesignIntent(MDD_WITH_ENTITIES);
    assert.match(out, /^## UI\/UX Design Intent/im);
    assert.match(out, /Entity Classification/);
    assert.match(out, /`orders`/);
    assert.match(out, /KanbanBoard/);
    assert.match(out, /`customers`/);
    assert.ok(out.includes("CREATE TABLE orders"), "no debe borrar §3 previa");
  });

  it("no duplica la sección si ya existe", () => {
    const withIntent = `${MDD_WITH_ENTITIES.trim()}\n\n## UI/UX Design Intent\n\nPrevio.\n`;
    const out = enrichMddWithUiUxDesignIntent(withIntent);
    assert.equal(out, withIntent);
    assert.equal((out.match(/## UI\/UX Design Intent/g) ?? []).length, 1);
  });

  it("devuelve el markdown sin cambios si falta §3", () => {
    const sinModelo = `## 1. Contexto\n\nSolo texto.\n`;
    const out = enrichMddWithUiUxDesignIntent(sinModelo);
    assert.equal(out, sinModelo);
  });

  it("devuelve vacío o entrada sin tocar cuando no hay contenido útil", () => {
    assert.equal(enrichMddWithUiUxDesignIntent(""), "");
    const soloEspacios = "   \n";
    assert.equal(enrichMddWithUiUxDesignIntent(soloEspacios), soloEspacios);
  });
});
