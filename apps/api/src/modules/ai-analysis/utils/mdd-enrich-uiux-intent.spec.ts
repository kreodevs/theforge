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
  it("anexa ## UI/UX Design Intent cuando hay entidades en §3", async () => {
    const out = await enrichMddWithUiUxDesignIntent(MDD_WITH_ENTITIES);
    assert.match(out, /^## UI\/UX Design Intent/im);
    assert.match(out, /Personas y journeys/);
    assert.match(out, /Matriz pantalla/);
    assert.match(out, /pantallas\.md/);
    assert.doesNotMatch(out, /Entity Classification/);
    assert.doesNotMatch(out, /dataSource.*GET \/api\/v1\//);
    assert.match(out, /GET \/api\/v1\/\{tabla\}/);
    assert.ok(out.includes("CREATE TABLE orders"), "no debe borrar §3 previa");
  });

  it("no duplica la sección si ya existe (formato completo)", async () => {
    const withIntent = `${MDD_WITH_ENTITIES.trim()}\n\n## UI/UX Design Intent\n\n### Personas y journeys\n\nPrevio.\n\n### Matriz pantalla→componente\n\n### Reglas de composición\n\n### Componentes transversales\n\n### Fuera de alcance UI v1\n\n`;
    const out = await enrichMddWithUiUxDesignIntent(withIntent);
    assert.equal(out, withIntent);
    assert.equal((out.match(/## UI\/UX Design Intent/g) ?? []).length, 1);
  });

  it("reemplaza sección legacy Entity Classification", async () => {
    const legacy = `${MDD_WITH_ENTITIES.trim()}\n\n## UI/UX Design Intent\n\n### Entity Classification\n\n| Entidad |\n`;
    const out = await enrichMddWithUiUxDesignIntent(legacy);
    assert.doesNotMatch(out, /Entity Classification/);
    assert.match(out, /Personas y journeys/);
  });

  it("devuelve el markdown sin cambios si falta §3", async () => {
    const sinModelo = `## 1. Contexto\n\nSolo texto.\n`;
    const out = await enrichMddWithUiUxDesignIntent(sinModelo);
    assert.equal(out, sinModelo);
  });

  it("devuelve vacío o entrada sin tocar cuando no hay contenido útil", async () => {
    assert.equal(await enrichMddWithUiUxDesignIntent(""), "");
    const soloEspacios = "   \n";
    assert.equal(await enrichMddWithUiUxDesignIntent(soloEspacios), soloEspacios);
  });
});
