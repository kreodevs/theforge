import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isStreamPrevalidatedDeliveryGate,
  validateMddForDelivery,
} from "../ai-analysis/utils/mdd-delivery-gate.util.js";
import {
  prepareMddMarkdownForPersist,
  touchPrevalidatedMddBeforePersist,
} from "../ai-analysis/utils/mdd-sanitize/persist-pipeline.js";
import { deduplicateMddAppendixSections, deduplicateCanonicalMddSections, mddHasDuplicateSectionHeadings } from "../ai-analysis/utils/mdd-sanitize/section-merge.js";
import { preserveValidatedSectionsIfSubstantial } from "../ai-analysis/utils/mdd-section-preserve.util.js";
import { extractPaso0DecisionCatalog } from "../ai-analysis/phase0/paso0-pasted-definitive.util.js";
import {
  enforcePaso0CatalogOnMdd,
  repairAndInjectPaso0Section3ForGate,
  sanitizePaso0SsoContradictionsInMdd,
} from "./mdd-paso0-enforcement.util.js";
import { applyPersistDeliveryGateAutofixes } from "../ai-analysis/utils/mdd-delivery-gate-autofix.util.js";
import { extractSection4Body } from "../ai-analysis/utils/mdd-sanitize/section-merge.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");

function buildSubstantialWorkspaceChatDraft(): string {
  const s1 =
    "Workspace Chat corporativo para colaboración en contextos y topics con ingesta idempotente de eventos de negocio, mensajería en tiempo real y políticas de retención alineadas al catálogo Paso 0. ".repeat(
      4,
    );
  const s2 =
    "Stack NestJS 20, PostgreSQL 16, Redis 7, React 18, SSO corporativo vía OIDC/JWKS sin contraseña local ni registro de usuarios en la aplicación. ".repeat(8);
  const s5 =
    "Reglas de negocio, edge cases EC-01 a EC-04, Given/When/Then para ingesta y mensajería. ".repeat(12);
  const s6 =
    "Autenticación vía SSO corporativo (OIDC). Validación JWT con JWKS remoto. Autorización por roles de aplicación. Auditoría de acciones sensibles. Sin MFA propio ni hashing de contraseñas locales en la aplicación. ".repeat(
      3,
    );
  const s7 =
    "Kubernetes con réplicas HA, PostgreSQL gestionado, Redis para pub/sub, observabilidad OpenTelemetry, backups automatizados y manifest de despliegue con health checks y límites de recursos. ".repeat(
      2,
    );
  return `
# Master Design Document

## 1. Contexto
${s1}

## 2. Arquitectura y Stack
${s2}

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE contexts (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE topics (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE identities (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE attachments (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE migration_jobs (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
\`\`\`
\`\`\`TechnicalMetadata
[high_security]
\`\`\`

## 4. Contratos de API
| Método | Ruta | Descripción | Auth | Notas |
|--------|------|-------------|------|-------|
| POST | \`/ingest/events\` | Ingesta idempotente | app cred | D-080 |
| POST | \`/attachments\` | Upload cuarentena | user | D-125 |
| GET | \`/ws\` | Realtime | user | D-124 |
| POST | \`/break-glass-requests\` | Break glass | user | D-083 |
| POST | \`/applications/{appId}/migration/jobs\` | Migración OBP | app cred | D-119 |
| GET | \`/api/v1/contexts\` | Listar contextos | user | MVP |
| POST | \`/api/v1/contexts\` | Crear contexto | user | MVP |
| GET | \`/api/v1/topics\` | Listar topics | user | MVP |
| POST | \`/api/v1/messages\` | Enviar mensaje | user | MVP |

### POST /ingest/events
\`\`\`json
{ "request": { "eventId": "e1", "payload": {} }, "response": { "status": "accepted" } }
\`\`\`

## 5. Lógica y Edge Cases
${s5}

## 6. Seguridad
${s6}

## 7. Infraestructura
${s7}
`.trim();
}

/** Réplica del path prevalidated en MddUpdatePipelineService.process. */
function prepareMddMarkdownForPersistGate(
  raw: string,
  baseline: string,
  paso0Catalog: NonNullable<ReturnType<typeof extractPaso0DecisionCatalog>>,
): string {
  let preparedBody = touchPrevalidatedMddBeforePersist(raw, baseline);
  preparedBody = prepareMddMarkdownForPersist(preparedBody);
  preparedBody = preserveValidatedSectionsIfSubstantial(baseline, preparedBody);
  preparedBody = deduplicateCanonicalMddSections(preparedBody);
  preparedBody = repairAndInjectPaso0Section3ForGate(preparedBody, paso0Catalog).markdown;
  preparedBody = enforcePaso0CatalogOnMdd(preparedBody, paso0Catalog).markdown;
  preparedBody = sanitizePaso0SsoContradictionsInMdd(preparedBody, paso0Catalog).markdown;
  return deduplicateCanonicalMddSections(preparedBody);
}

describe("MddUpdatePipelineService persist gate", () => {
  it("isStreamPrevalidatedDeliveryGate acepta score=92 con 1 blocker recuperable", () => {
    const gate = {
      ok: false,
      score: 92,
      blockers: [
        "[Paso 0 §3] Entidad canónica obligatoria ausente: CREATE TABLE `business_events` — requerida por catálogo Paso 0.",
      ],
      warnings: [],
    };
    assert.equal(isStreamPrevalidatedDeliveryGate(gate), true);
  });

  it("substantial draft → prepareMddMarkdownForPersist path no produce score=0", () => {
    const catalog = extractPaso0DecisionCatalog(readFileSync(join(repoRoot, "STEP_0-review.md"), "utf8"));
    assert.ok(catalog);
    const baseline = buildSubstantialWorkspaceChatDraft();
    const prepared = prepareMddMarkdownForPersistGate(baseline, baseline, catalog);
    assert.ok(prepared.length > 8_000, `prepared too short: ${prepared.length}`);
    assert.ok((extractSection4Body(prepared)?.length ?? 0) > 500, "§4 regressed");
    const gate = validateMddForDelivery(prepared, {
      paso0Catalog: catalog,
      skipDeterministicRepair: true,
    });
    assert.ok(
      gate.score > 0,
      `expected score>0 got score=${gate.score} blockers=${gate.blockers.length}: ${gate.blockers.slice(0, 3).join("; ")}`,
    );
    assert.ok(
      !gate.blockers.some((b) => b.includes("Secciones obligatorias faltantes")),
      gate.blockers.join("; "),
    );
    assert.ok(
      !gate.blockers.some((b) => b.includes("business_events")),
      `business_events blocker after persist gate prep: ${gate.blockers.join("; ")}`,
    );
    assert.match(prepared, /CREATE TABLE business_events/i);
  });

  it("persist gate path repara §4 JSON corrupto tras prepareMddMarkdownForPersist", () => {
    const catalog = extractPaso0DecisionCatalog(readFileSync(join(repoRoot, "STEP_0-review.md"), "utf8"));
    assert.ok(catalog);
    const baseline = buildSubstantialWorkspaceChatDraft();
    const corrupt = baseline.replace(
      /```json\n\{ "request":[\s\S]*?```/,
      '```json\n{ "request": { "x": 1 }, "response": { "data": [], { "errors": [," } }\n```',
    );
    const prepared = prepareMddMarkdownForPersistGate(corrupt, baseline, catalog);
    const gate = validateMddForDelivery(prepared, {
      paso0Catalog: catalog,
      skipDeterministicRepair: true,
    });
    assert.ok(
      !gate.blockers.some((b) => b.includes("```json inválido")),
      gate.blockers.join("; "),
    );
  });

  it("stream parity: near-pass persist re-gate peor usa isStreamPrevalidatedDeliveryGate", () => {
    const streamGate = {
      ok: false,
      score: 92,
      blockers: ["[Paso 0 §6] Patrones de auth local incompatibles con D-003 (SSO Integral)."],
      warnings: [],
    };
    const persistGate = validateMddForDelivery("## 1. Contexto\n\nroto", {
      skipDeterministicRepair: true,
    });
    assert.ok(persistGate.score < streamGate.score, `persist=${persistGate.score} stream=${streamGate.score}`);
    assert.equal(isStreamPrevalidatedDeliveryGate(streamGate), true);
    const effective = isStreamPrevalidatedDeliveryGate(streamGate) ? streamGate : persistGate;
    assert.equal(effective.score, 92);
  });

  it("persist autofix: §7 duplicada + §3 SQL embebido → gate sin blockers duros", () => {
    const catalog = extractPaso0DecisionCatalog(readFileSync(join(repoRoot, "STEP_0-review.md"), "utf8"));
    assert.ok(catalog);
    const baseline = buildSubstantialWorkspaceChatDraft();
    const duplicateTail = `

## 7. Infraestructura
Cola duplicada del pipeline.

## 4. Contratos de API
| GET | \`/api/v1/duplicate\` | dup |
`;
    const corruptSql = baseline.replace(
      /CREATE TABLE messages \(id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)\);/,
      `CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default BOOLEAN NOT NULL DEFAULT false,
  content text TEXT NOT NULL
);
CREATE TABLE notification_intents (
  id UUID PRIMARY KEY,
CREATE UNIQUE INDEX idx_notif_topic ON notification_intents (topic_id);
  recipient_id UUID NOT NULL
);`,
    );
    const raw = corruptSql + duplicateTail;
    assert.ok(mddHasDuplicateSectionHeadings(raw));

    const autofix = applyPersistDeliveryGateAutofixes(raw, { paso0Catalog: catalog, baseline });
    assert.strictEqual(mddHasDuplicateSectionHeadings(autofix.markdown), false);
    assert.ok(autofix.applied.some((a) => a.includes("canonical-dedupe")));

    const gate = validateMddForDelivery(autofix.markdown, {
      paso0Catalog: catalog,
      skipDeterministicRepair: true,
    });
    assert.ok(
      !gate.blockers.some((b) => b.includes("secciones duplicadas")),
      gate.blockers.join("; "),
    );
    assert.ok(
      !gate.blockers.some((b) => b.includes("SQL con error de sintaxis")),
      gate.blockers.join("; "),
    );
  });

  it("deduplicateMddAppendixSections elimina UI/UX y Registro de cambios duplicados", () => {
    const draft = `
## 7. Infraestructura
Manifest ok.

## UI/UX Design Intent
Primera.

## Registro de cambios del documento
| 1.0 | Junio 2026 | Inicial |

## UI/UX Design Intent
Duplicada.

## Registro de cambios del documento
| 1.0 | Junio 2026 | Inicial |
| 1.1 | Julio 2026 | Fix |
`;
    const out = deduplicateMddAppendixSections(draft);
    assert.equal((out.match(/## UI\/UX Design Intent/gi) ?? []).length, 1);
    assert.equal((out.match(/## Registro de cambios del documento/gi) ?? []).length, 1);
    assert.match(out, /1\.1 \| Julio 2026/);
  });
});
