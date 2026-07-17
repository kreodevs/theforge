import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMddFormatSecIntNode } from "./mdd-format-sec-int.node.js";
import {
  detectUnclosedSqlFences,
  finalizeMddDeliverable,
  normalizeMddFormat,
  repairMddFencesOnly,
} from "../utils/mdd-sanitize.js";

/** MDD ya mergeado/formateado con fence ```sql sin cerrar (caso job-16). */
function buildMergedDraftWithBrokenFence(padRepeats = 80): string {
  const pad = "- Regla de negocio de ejemplo para volumen realista del documento.\n".repeat(padRepeats);
  return `# Master Design Document

---

## 1. Contexto

Alcance del producto interno con APIs REST y CLI.

${pad}

---

## 2. Arquitectura y Stack

| Capa | Tecnología | Versión |
| Backend | Node.js | 22 |
| Base de datos | PostgreSQL | 16 |

---

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  actor_id UUID,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

### Diagrama entidad-relación

\`\`\`TechnicalMetadata
[high_security]
\`\`\`

---

## 4. Contratos de API

| POST | /api/v1/auth/login | Login | JWT |
| GET | /api/v1/health | Health | — |

---

## 5. Lógica y Edge Cases

${pad}

---

## 6. Seguridad

- JWT RS256 con par de claves PEM.
- MFA TOTP para administradores.

---

## 7. Infraestructura

\`\`\`json
{
  "stack": {
    "backend": { "container": { "base_image": "node:22-alpine" } },
    "security": { "jwt_algorithm": "RS256", "jwks_enabled": true }
  }
}
\`\`\`
`;
}

describe("createMddFormatSecIntNode correction path", () => {
  const node = createMddFormatSecIntNode();

  it("repara fences sin inflar draft >10% en retry de corrección (job-16)", () => {
    const merged = buildMergedDraftWithBrokenFence();
    assert.ok(detectUnclosedSqlFences(merged), "fixture debe tener sql sin cerrar");
    const beforeLen = merged.length;

    const out = node({
      mddDraft: merged,
      securitySectionMd: undefined,
      integrationSectionMd: undefined,
      executorControlled: true,
      sectionsToRun: ["formatter"],
    } as Parameters<typeof node>[0]);

    const afterLen = (out.mddDraft ?? "").length;
    const growth = (afterLen - beforeLen) / beforeLen;
    assert.ok(growth <= 0.1, `draft creció ${(growth * 100).toFixed(1)}% (${beforeLen}→${afterLen})`);
    assert.equal(detectUnclosedSqlFences(out.mddDraft ?? ""), null);
  });

  it("regresión: repairMddFencesOnly crece menos que normalize+finalize en draft mergeado", () => {
    const merged = buildMergedDraftWithBrokenFence();
    const beforeLen = merged.length;
    const fenceOnly = repairMddFencesOnly(merged);
    const fullPath = finalizeMddDeliverable(normalizeMddFormat(merged));
    const fenceGrowth = (fenceOnly.length - beforeLen) / beforeLen;
    const fullGrowth = (fullPath.length - beforeLen) / beforeLen;
    assert.ok(fenceGrowth <= 0.1, `fence-only creció ${(fenceGrowth * 100).toFixed(1)}%`);
    assert.ok(
      fullGrowth >= fenceGrowth,
      `full path (${(fullGrowth * 100).toFixed(1)}%) debe ser >= fence-only (${(fenceGrowth * 100).toFixed(1)}%)`,
    );
  });

  it("aplica §7 en merge normal sin pasada de corrección", () => {
    const base = buildMergedDraftWithBrokenFence(20).replace(
      /## 7\. Infraestructura[\s\S]*$/,
      "## 7. Infraestructura\n\n(Pendiente: Ingeniero de Integración)\n",
    );
    const sec7 = `## 7. Infraestructura

\`\`\`json
{ "stack": { "security": { "jwt_algorithm": "RS256" } } }
\`\`\``;

    const out = node({
      mddDraft: base,
      integrationSectionMd: sec7,
      executorControlled: false,
    } as Parameters<typeof node>[0]);

    assert.match(out.mddDraft ?? "", /"jwt_algorithm": "RS256"/);
    assert.equal(out.integrationSectionMd, undefined);
  });
});

describe("repairMddFencesOnly", () => {
  it("cierra sql sin cerrar y no duplica secciones", () => {
    const merged = buildMergedDraftWithBrokenFence(40);
    const beforeLen = merged.length;
    const fixed = repairMddFencesOnly(merged);
    assert.equal(detectUnclosedSqlFences(fixed), null);
    assert.ok(fixed.length <= beforeLen * 1.1);
    assert.strictEqual((fixed.match(/^##\s+6\./gm) ?? []).length, 1);
    assert.strictEqual((fixed.match(/^##\s+7\./gm) ?? []).length, 1);
  });
});
