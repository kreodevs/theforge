import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MddUpdatePipelineService } from "./mdd-update-pipeline.service.js";
import { SemaphoreService } from "./semaphore.service.js";
import { GraphMemoryService } from "../ai-analysis/graph-memory/graph-memory.service.js";

const MINIMAL_MDD = `# Master Design Document

## 1. Contexto

Contexto de prueba con alcance funcional suficiente para validar persistencia.

## 2. Arquitectura y Stack

NestJS y PostgreSQL.

## 3. Modelo de Datos

TechnicalMetadata: [high_security]

\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL);
\`\`\`

## 4. Contratos de API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /auth/login | Login |

\`\`\`json
{"request": {}, "response": {"token": "string"}}
\`\`\`

## 5. Lógica y Edge Cases

Dado usuario autenticado cuando accede entonces valida sesión.
`;

describe("MddUpdatePipelineService", () => {
  const pipeline = new MddUpdatePipelineService(
    { evaluate: () => ({ status: "green" as const, precisionScore: 90 }) } as unknown as SemaphoreService,
    {} as GraphMemoryService,
  );

  it("trusts qualityGatePassed from graph even when prepared markdown lacks §6/§7", async () => {
    const result = await pipeline.process(
      MINIMAL_MDD,
      { complexity: "LOW" as never },
      undefined,
      { qualityGatePassed: true },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.sanitizedMdd.includes("## 1. Contexto"));
    }
  });

  it("blocks persist when qualityGatePassed is false and §6/§7 missing", async () => {
    const result = await pipeline.process(
      MINIMAL_MDD,
      { complexity: "LOW" as never },
      undefined,
      { qualityGatePassed: false },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "ERR_MDD_DELIVERY_GATE");
    }
  });
});
