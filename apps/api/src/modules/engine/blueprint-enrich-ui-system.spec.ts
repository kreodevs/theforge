import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichBlueprintWithUiDesignSystem } from "./blueprint-enrich-ui-system.js";

const MDD_WITH_SECTION3 = `# MDD

## 1. Contexto

Producto de ejemplo.

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE orders (id UUID PRIMARY KEY, status TEXT NOT NULL);
CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL);
CREATE TABLE settings (id UUID PRIMARY KEY, key TEXT NOT NULL);
\`\`\`

## 4. Contratos de API

| Método | Ruta |
|--------|------|
| GET | /health |
`;

const BASE_BLUEPRINT = `## 1. Visión

Blueprint base sin sección UI.
`;

describe("enrichBlueprintWithUiDesignSystem", () => {
  it("importa extractSection3Body desde ai-analysis (smoke de rutas entre módulos)", () => {
    const out = enrichBlueprintWithUiDesignSystem(MDD_WITH_SECTION3, BASE_BLUEPRINT);
    assert.match(out, /## 8\. UI Design System & Component Mapping/);
  });

  it("anexa §8 con mapeo KanbanBoard para orders y DataTable para users", () => {
    const out = enrichBlueprintWithUiDesignSystem(MDD_WITH_SECTION3, BASE_BLUEPRINT);
    assert.match(out, /`orders`.*KanbanBoard/s);
    assert.match(out, /`users`.*DataTable/s);
    assert.match(out, /`settings`.*PropertyGrid/s);
    assert.ok(out.startsWith(BASE_BLUEPRINT.trim()));
  });

  it("no duplica §8 si el blueprint ya la incluye", () => {
    const withSection = `${BASE_BLUEPRINT}\n\n## 8. UI Design System & Component Mapping\n\nExistente.\n`;
    const out = enrichBlueprintWithUiDesignSystem(MDD_WITH_SECTION3, withSection);
    assert.equal(out, withSection);
    assert.equal((out.match(/## 8\. UI Design System/g) ?? []).length, 1);
  });

  it("devuelve el blueprint sin cambios si el MDD no tiene §3", () => {
    const mddSinModelo = `## 1. Contexto\n\nSolo contexto.\n\n## 2. Stack\n\nNestJS.\n`;
    const out = enrichBlueprintWithUiDesignSystem(mddSinModelo, BASE_BLUEPRINT);
    assert.equal(out, BASE_BLUEPRINT);
  });

  it("devuelve el blueprint sin cambios si §3 no tiene CREATE TABLE", () => {
    const mddVacio = `## 3. Modelo de Datos\n\n(Pendiente de definir.)\n`;
    const out = enrichBlueprintWithUiDesignSystem(mddVacio, BASE_BLUEPRINT);
    assert.equal(out, BASE_BLUEPRINT);
  });
});
