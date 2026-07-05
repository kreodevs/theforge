import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  injectMissingBlueprintEntities,
  injectMissingBlueprintStackKeywords,
  repairBlueprintProgrammaticGaps,
} from "./blueprint-conformance-repair.util.js";

const MDD = `# MDD

## 2. Arquitectura y Stack

Backend **NestJS** con API REST; frontend **React** (Vite); persistencia **PostgreSQL**; cache **Redis**; contenedores **Docker** y despliegue en VPS.

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE orders (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`
`;

describe("blueprint-conformance-repair", () => {
  it("inyecta entidades §3 faltantes como cabeceras ###", () => {
    const bp =
      "## 1. Stack\n\nNestJS + React para el producto. PostgreSQL como base principal.\n\n" +
      "Detalle de módulos y despliegue documentado en secciones siguientes.\n";
    const out = injectMissingBlueprintEntities(MDD, bp);
    assert.match(out, /### orders/);
    assert.match(out, /### users/);
  });

  it("inyecta tecnologías §2 faltantes por nombre", () => {
    const bp =
      "## 1. Stack\n\nNestJS y React en el monorepo. API modular con capas de dominio.\n\n" +
      "Persistencia documentada en la sección de datos.\n";
    const out = injectMissingBlueprintStackKeywords(MDD, bp);
    assert.match(out, /postgresql/i);
    assert.match(out, /redis/i);
    assert.match(out, /docker/i);
  });

  it("repairBlueprintProgrammaticGaps cubre entidades y stack", () => {
    const bp =
      "## 1. Estructura\n\nAPI NestJS con módulos por dominio. Frontend React.\n\n" +
      "Plan de fases y riesgos en secciones dedicadas del documento.\n";
    const out = repairBlueprintProgrammaticGaps(MDD, bp);
    assert.match(out, /### orders/);
    assert.match(out, /Stack MDD §2/);
  });
});
