import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDomainInventory } from "../../../engine/domain-inventory.util.js";
import {
  extractPaso0DecisionCatalog,
  isExternalPastedPaso0ForMddSeed,
  isPastedDefinitivePaso0,
  MIN_PASTED_DEFINITIVE_PASO0_CHARS,
} from "../paso0-pasted-definitive.util.js";
import { serializePaso0PasteSidecar, PASO0_PASTE_SIDECAR_KIND } from "@theforge/shared-types";
import { resolveClarifierDbgaBriefMaxChars } from "../../utils/mdd-clarifier-dbga-brief.util.js";
import {
  catalogToSuggestedEntitySlugs,
  isPaso0ForbiddenEntityTable,
  listPaso0MandatoryEntities,
  PASO0_FORBIDDEN_ENTITY_TABLES,
  WORKSPACE_CHAT_CANONICAL_ENTITIES,
} from "@theforge/shared-types";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../../../");
const step0Path = join(repoRoot, "STEP_0-review.md");
const step0Full = readFileSync(step0Path, "utf8");

const SNIPPET_32 = step0Full.slice(step0Full.indexOf("### 3.2 Decisiones confirmadas"), step0Full.indexOf("### 3.4 Inferencias"));
const SNIPPET_33 = step0Full.slice(step0Full.indexOf("### 3.3 Límites confirmados"), step0Full.indexOf("### 3.4 Inferencias"));
const SNIPPET_51 = step0Full.slice(step0Full.indexOf("### 5.1 Lenguaje genérico"), step0Full.indexOf("### 5.2 Términos"));
const SNIPPET_83 = step0Full.slice(step0Full.indexOf("### 8.3 Eventos y confiabilidad"), step0Full.indexOf("### 8.4 Reglas"));
const SNIPPET_181 = step0Full.slice(step0Full.indexOf("### 18.1 MVP"), step0Full.indexOf("### 18.2 Preparación"));
const SNIPPET_191 = step0Full.slice(step0Full.indexOf("### 19.1 Registro de riesgos"), step0Full.indexOf("### 19.2 Dependencias"));

const GOVERNANCE_HEAD = `# Workspace Chat — Domain Benchmark & Gap Analysis

**Estado:** artefacto consolidado **definitivo** del Paso 0.

## 1. Reglas de lectura y gobierno

### 1.2 Tipos de afirmación

| Tipo                    | Significado                                                                             |
| **Decisión confirmada** | Regla aprobada y vigente. Vinculante.                                                   |

## 2. Síntesis ejecutiva
## 3. Visión, problema y límites del producto
## 4. Estado actual de OBP
## 5. Dominio y lenguaje ubicuo
## 6. Contextos, temas y subconversaciones
## 7. Identidad, membresía y permisos
## 8. Mensajería, media y eventos
## 9. Clientes: embebido, central, web y móvil
## 10. Realtime, búsqueda y notificaciones
## 11. Seguridad, E2EE y aislamiento
## 12. Retención, auditoría y legal hold
## 13. IA, agente de campañas y MCP
## 14. Administración, operación y analítica
## 15. Benchmark de dominio
## 16. Gap analysis consolidado
## 17. Migración específica de OBP desde Teams
## 18. Matriz consolidada de alcance
## 19. Riesgos, dependencias y supuestos
## 20. Métricas de éxito
## 21. Preguntas abiertas y diferidos legítimos
## 22. Anexo A — Restricciones técnicas propuestas
## 23. Trazabilidad de decisiones y condición de salida

`;

function buildSyntheticDefinitiveDoc(extra = ""): string {
  let doc = GOVERNANCE_HEAD + SNIPPET_32 + SNIPPET_33 + SNIPPET_51 + SNIPPET_83 + SNIPPET_181 + SNIPPET_191 + extra;
  while (doc.length < MIN_PASTED_DEFINITIVE_PASO0_CHARS) {
    doc += `\nReferencia D-${String(200 + (doc.length % 50)).padStart(3, "0")} Decisión confirmada.\n`;
  }
  return doc;
}

describe("paso0-pasted-definitive.util", () => {
  it("isPastedDefinitivePaso0 true para STEP_0-review.md completo", () => {
    assert.equal(isPastedDefinitivePaso0(step0Full), true);
  });

  it("isPastedDefinitivePaso0 true para documento sintético con snippets STEP_0", () => {
    assert.equal(isPastedDefinitivePaso0(buildSyntheticDefinitiveDoc()), true);
  });

  it("isPastedDefinitivePaso0 false para texto corto o deep research", () => {
    assert.equal(isPastedDefinitivePaso0("x".repeat(100)), false);
    assert.equal(
      isPastedDefinitivePaso0(
        `# Especificador de Base para MDD\n\n${"D-001 ".repeat(30)}\nDecisión confirmada\n${"## 1. a\n".repeat(12)}${"x".repeat(5000)}`,
      ),
      false,
    );
  });

  it("extractPaso0DecisionCatalog parsea §3.2, §3.3, §5.1, §8.3, §18.1 y §19.1", () => {
    const catalog = extractPaso0DecisionCatalog(buildSyntheticDefinitiveDoc());
    assert.equal(catalog.kind, "paso0_decision_catalog");
    assert.equal(catalog.version, 1);
    assert.ok(catalog.sourceHash.length >= 64);
    assert.ok(catalog.decisions.length >= 15);
    assert.ok(catalog.mvpCapabilities.length >= 5);
    assert.ok(catalog.outOfScope.length >= 5);
    assert.ok(catalog.entities.length >= 5);
    assert.ok(catalog.invariants.length >= 1);
    assert.ok(catalog.risks.length >= 3);

    assert.ok(catalog.decisions.some((d) => d.id === "D-002"));
    assert.ok(catalog.mvpCapabilities.some((c) => c.title.includes("Núcleo contextual")));
    assert.ok(catalog.outOfScope.some((o) => o.rule.includes("Chat corporativo")));
    assert.ok(catalog.entities.some((e) => e.term === "Workspace Chat"));
    assert.ok(catalog.invariants.some((i) => i.includes("Invariante genérico")));
    assert.ok(catalog.risks.some((r) => r.id === "R-001"));
  });

  it("solo propaga filas Decisión confirmada con columna Tipo", () => {
    const md =
      buildSyntheticDefinitiveDoc() +
      `\n| Regla extra | MVP | Inferencia aceptada | Genérica | D-999 |\n`;
    const catalog = extractPaso0DecisionCatalog(md);
    assert.equal(catalog.decisions.some((d) => d.id === "D-999"), false);
  });

  it("STEP_0 completo produce catálogo sustancial", () => {
    const catalog = extractPaso0DecisionCatalog(step0Full);
    assert.ok(catalog.decisions.length >= 80);
    assert.ok(catalog.mvpCapabilities.length >= 40);
    assert.ok(catalog.entities.length >= 20);
    assert.ok(catalog.canonicalEntities.length >= 30);
    assert.ok(catalog.mandatoryApiRouteFamilies.length >= 5);
    assert.ok(catalog.businessRules.length >= 20);
  });

  it("listPaso0MandatoryEntities incluye 38 tablas canónicas Workspace Chat", () => {
    const catalog = extractPaso0DecisionCatalog(step0Full);
    const mandatory = listPaso0MandatoryEntities(catalog);
    assert.ok(mandatory.length >= 30);
    for (const table of ["applications", "contexts", "messages", "business_events", "attachments"]) {
      assert.ok(mandatory.includes(table), `missing mandatory ${table}`);
    }
    assert.equal(mandatory.includes("channels"), false);
    assert.ok(WORKSPACE_CHAT_CANONICAL_ENTITIES.length >= 38);
  });
});

describe("domain-inventory + paso0 catalog", () => {
  it("usa capacidades del catálogo cuando no hay BRD", () => {
    const catalog = extractPaso0DecisionCatalog(buildSyntheticDefinitiveDoc());
    const inv = buildDomainInventory({ paso0Catalog: catalog });
    assert.ok(inv.capabilities.length >= 5);
    assert.ok(inv.capabilities.every((c) => c.id.startsWith("cap-p0-")));
  });

  it("fusiona catálogo Paso 0 con BRD (BRD aporta capacidades exclusivas)", () => {
    const catalog = extractPaso0DecisionCatalog(buildSyntheticDefinitiveDoc());
    const brd = `## 3. Capacidades\n\n### 1. Capacidad exclusiva del BRD\n\nDesde BRD: regla explícita con detalle suficiente para el inventario de dominio.\n`;
    const inv = buildDomainInventory({ brdMarkdown: brd, paso0Catalog: catalog });
    assert.ok(inv.capabilities.some((c) => c.body.includes("Desde BRD")));
    assert.ok(inv.capabilities.length > catalog.mvpCapabilities.length);
  });

  it("no sugiere tenants/channels/conversations con catálogo Paso 0", () => {
    const catalog = extractPaso0DecisionCatalog(buildSyntheticDefinitiveDoc());
    const dbga =
      buildSyntheticDefinitiveDoc() +
      "\n\nEl tenant corporativo usa canales y conversaciones generales fuera de alcance D-073.\n";
    const inv = buildDomainInventory({ dbgaMarkdown: dbga, paso0Catalog: catalog });
    for (const forbidden of PASO0_FORBIDDEN_ENTITY_TABLES) {
      assert.equal(
        inv.suggestedEntities.includes(forbidden),
        false,
        `unexpected forbidden entity: ${forbidden}`,
      );
    }
    assert.ok(inv.suggestedEntities.length >= 10);
    assert.ok(inv.suggestedEntities.some((e) => e === "applications" || e === "contexts" || e === "topics"));
    assert.ok(inv.suggestedEntities.includes("business_events") || inv.suggestedEntities.includes("attachments"));
  });

  it("catalogToSuggestedEntitySlugs mapea términos ubicuo §5.1", () => {
    const catalog = extractPaso0DecisionCatalog(buildSyntheticDefinitiveDoc());
    const slugs = catalogToSuggestedEntitySlugs(catalog);
    assert.ok(slugs.length >= 3);
    assert.equal(isPaso0ForbiddenEntityTable("tenants", catalog), true);
    assert.equal(isPaso0ForbiddenEntityTable("applications", catalog), false);
  });

  it("isExternalPastedPaso0ForMddSeed true con sidecar paste o DBGA definitivo", () => {
    const catalog = extractPaso0DecisionCatalog(buildSyntheticDefinitiveDoc());
    const sidecar = serializePaso0PasteSidecar({
      envelopeKind: PASO0_PASTE_SIDECAR_KIND,
      version: 1,
      catalog,
      borrador: {},
    });
    assert.equal(isExternalPastedPaso0ForMddSeed(sidecar, null), true);
    assert.equal(isExternalPastedPaso0ForMddSeed(null, step0Full), true);
    assert.equal(isExternalPastedPaso0ForMddSeed('{"phase0":"interview"}', "texto corto"), false);
  });
});

describe("resolveClarifierDbgaBriefMaxChars", () => {
  it("usa 120k por defecto con catálogo", () => {
    const catalog = extractPaso0DecisionCatalog(buildSyntheticDefinitiveDoc());
    assert.equal(resolveClarifierDbgaBriefMaxChars(catalog), 120_000);
    assert.equal(resolveClarifierDbgaBriefMaxChars(null), 8_000);
  });
});
