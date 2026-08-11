import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichPaso0DecisionCatalog } from "@theforge/shared-types";
import { extractPaso0DecisionCatalog } from "../ai-analysis/phase0/paso0-pasted-definitive.util.js";
import {
  applyPaso0TailSectionEnrichment,
  buildPaso0Section9Trazabilidad,
  countPaso0DecisionIdCoverage,
  dedupePaso0Section6PlaceholderBlocks,
  deduplicatePaso0TailSections,
  deselectStranglerFigInGovernanceWizard,
  ensurePaso0Section8UiUxInMdd,
  ensurePaso0Section9InMdd,
  hydratePaso0WorkspaceChatUiUxSection,
  hydratePaso0WorkspaceChatSection6,
  injectMissingPaso0BusinessRulesIntoSection5,
  restructurePaso0Section6,
  paso0Section6NeedsHydration,
  sanitizePaso0Section6PlatformScopes,
} from "./mdd-paso0-trazabilidad.util.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";
import {
  ensureMddGovernanceSection,
  updateMddGovernancePatterns,
} from "@theforge/shared-types";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const step0Path = join(repoRoot, "STEP_0-review.md");

function loadCatalog() {
  const raw = extractPaso0DecisionCatalog(readFileSync(step0Path, "utf8"));
  assert.ok(raw, "catálogo STEP_0");
  return enrichPaso0DecisionCatalog(raw);
}

const MINIMAL_MDD = `
## 1. Contexto
Workspace Chat MVP.

## 5. Lógica y Edge Cases
Reglas pendientes.

## 6. Seguridad
Usa identity_platform_scopes para autorización.

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
`;

describe("mdd-paso0-trazabilidad.util", () => {
  it("buildPaso0Section9Trazabilidad incluye grupos y exclusiones", () => {
    const catalog = loadCatalog();
    const body = buildPaso0Section9Trazabilidad(catalog, MINIMAL_MDD);
    assert.match(body, /### 9\.1 Cobertura de decisiones vigentes/);
    assert.match(body, /D-002, D-004/);
    assert.match(body, /### 9\.2 Exclusiones verificables/);
    assert.match(body, /Strangler/);
    assert.match(body, /### 9\.3 Límites declarados/);
  });

  it("ensurePaso0Section9InMdd añade §9 al tail del MDD", () => {
    const catalog = loadCatalog();
    const { markdown, applied } = ensurePaso0Section9InMdd(MINIMAL_MDD, catalog);
    assert.equal(applied, true);
    assert.match(markdown, /^##\s*9\.\s*Trazabilidad/im);
  });

  it("injectMissingPaso0BusinessRulesIntoSection5 inyecta RN con D-ID", () => {
    const catalog = loadCatalog();
    const { markdown, injected } = injectMissingPaso0BusinessRulesIntoSection5(MINIMAL_MDD, catalog);
    assert.ok(injected.includes("RN-01"));
    assert.match(markdown, /RN-01.*D-133/);
  });

  it("sanitizePaso0Section6PlatformScopes reemplaza identity_platform_scopes", () => {
    const { body, warnings } = sanitizePaso0Section6PlatformScopes(
      "Evalúa identity_platform_scopes antes de leer mensajes.",
    );
    assert.match(body, /platform_scopes/);
    assert.ok(!/identity_platform_scopes/i.test(body));
    assert.equal(warnings.length, 1);
  });

  it("restructurePaso0Section6 inyecta headings §6.1–§6.8", () => {
    const catalog = loadCatalog();
    const { markdown, applied } = restructurePaso0Section6(MINIMAL_MDD, catalog);
    assert.ok(
      applied.some(
        (a) =>
          a.startsWith("§6-headings") ||
          a === "§6-platform-scopes" ||
          a === "§6-hydrate-canonical",
      ),
    );
    assert.match(markdown, /### 6\.1 Autenticación/);
    assert.match(markdown, /### 6\.8 Transporte y red/);
    assert.match(markdown, /\| Regla \| D-ID \|/);
  });

  it("hydratePaso0WorkspaceChatSection6 sustituye placeholders por cuerpo canónico", () => {
    const catalog = loadCatalog();
    const placeholderMdd = `
## 1. Contexto
Workspace Chat MVP.

## 5. Lógica y Edge Cases
Reglas pendientes.

## 6. Seguridad
_(Completar desde catálogo Paso 0 / nodo Seguridad.)_
_(Completar desde catálogo Paso 0 / nodo Seguridad.)_

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
`;
    const { markdown, applied } = hydratePaso0WorkspaceChatSection6(placeholderMdd, catalog);
    assert.equal(applied, true);
    const section6 = extractSectionByNumber(markdown, 6)?.replace(/^##[^\n]+\n?/, "") ?? "";
    assert.doesNotMatch(section6, /Completar desde catálogo Paso 0/i);
    assert.match(section6, /### 6\.2 Autorización/);
    assert.match(section6, /D-150/);
  });

  it("hydratePaso0WorkspaceChatUiUxSection reemplaza UI genérico", () => {
    const catalog = loadCatalog();
    const generic = `${MINIMAL_MDD}\n\n## UI/UX Design Intent\n\nid, name, status\nid, name, status\nid, name, status\nid, name, status\n`;
    const { markdown, applied } = hydratePaso0WorkspaceChatUiUxSection(generic, catalog);
    assert.equal(applied, true);
    assert.match(markdown, /### 8\.1 Superficies/);
    assert.match(markdown, /Componente embebido/);
    assert.match(markdown, /D-088/);
  });

  it("paso0Section6NeedsHydration detecta §6.8 duplicado o §6.2 malformado", () => {
    const dup68 = `### 6.1 Autenticación\n| Regla | D-ID |\n|---|---|\n| SSO | D-003 |\n### 6.8 Transporte\n- TLS\n### 6.8 Transporte\n- TLS\n`;
    assert.equal(paso0Section6NeedsHydration(dup68), true);
    const malformed62 = `### 6.2 Autorización\n| Regla | D-ID |\n\`\`\`text\n1. app_id\n\`\`\`\n| foo | D-093 |\n### 6.8 Transporte\n- TLS\n`;
    assert.equal(paso0Section6NeedsHydration(malformed62), true);
  });

  it("dedupePaso0Section6PlaceholderBlocks elimina placeholders §6.x duplicados", () => {
    const body = `### 6.1 Autenticación
_(Completar desde catálogo Paso 0 / nodo Seguridad.)_
Texto LLM sobre SSO.
_(Completar desde catálogo Paso 0 / nodo Seguridad.)_
### 6.1 Autenticación
_(Completar desde catálogo Paso 0 / nodo Seguridad.)_`;
    const { body: out, removed } = dedupePaso0Section6PlaceholderBlocks(body);
    assert.ok(removed >= 1);
    assert.equal((out.match(/Completar desde catálogo Paso 0/gi) ?? []).length, 1);
    assert.match(out, /Texto LLM sobre SSO/);
  });

  it("deduplicatePaso0TailSections conserva una sola §9/§10/UI/UX", () => {
    const duped = `${MINIMAL_MDD}
## 9. Trazabilidad
Breve.

## 9. Trazabilidad
### 9.1 Cobertura de decisiones vigentes
Grupo largo con cobertura sustancial de decisiones D-ID del catálogo Paso 0 para validación.

## 10. Registro de cambios
| 1.0 | — | init |

## 10. Registro de cambios
| **2.0** | **2026** | trazabilidad paso 0 d-id |

## UI/UX Design Intent
id, name, status

## UI/UX Design Intent
### 8.1 Superficies
Contenido sustancial UI workspace chat con reglas vinculantes D-088 y superficies embebidas.`;
    const { markdown, removed } = deduplicatePaso0TailSections(duped);
    assert.ok(removed.length >= 2);
    assert.equal((markdown.match(/^##\s*9\.\s*Trazabilidad/im) ?? []).length, 1);
    assert.equal((markdown.match(/^##\s*10\.\s*Registro de cambios/im) ?? []).length, 1);
    assert.equal((markdown.match(/^##\s*UI\/UX\s+Design\s+Intent/im) ?? []).length, 1);
    assert.match(markdown, /9\.1 Cobertura/);
  });

  it("ensurePaso0Section8UiUxInMdd inyecta §8 si falta antes de §9", () => {
    const catalog = loadCatalog();
    const withoutUi = `${MINIMAL_MDD}\n\n## 9. Trazabilidad\nCobertura.\n`;
    const { markdown, applied } = ensurePaso0Section8UiUxInMdd(withoutUi, catalog);
    assert.equal(applied, true);
    const uiIdx = markdown.search(/^##\s*UI\/UX\s+Design\s+Intent/im);
    const s9Idx = markdown.search(/^##\s*9\.\s*Trazabilidad/im);
    assert.ok(uiIdx >= 0 && s9Idx >= 0 && uiIdx < s9Idx);
    assert.match(markdown, /### 8\.1 Superficies/);
  });

  it("deselectStranglerFigInGovernanceWizard quita Strangler del wizard", () => {
    const catalog = loadCatalog();
    let mdd = ensureMddGovernanceSection("# MDD\n\n## 1. Contexto\n");
    mdd = updateMddGovernancePatterns(mdd, new Set(["strangler-fig-estrangulamiento", "repository"]));
    assert.match(mdd, /\[X\].*Strangler Fig/i);
    const { markdown, warnings } = deselectStranglerFigInGovernanceWizard(mdd, catalog);
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(markdown, /\[X\].*Strangler Fig/i);
    assert.match(markdown, /\[X\].*Repository/i);
  });

  it("applyPaso0TailSectionEnrichment cierra §5/§6/§8/§9 determinísticamente", () => {
    const catalog = loadCatalog();
    const { markdown, applied } = applyPaso0TailSectionEnrichment(MINIMAL_MDD, catalog);
    assert.ok(applied.length >= 3);
    assert.match(markdown, /RN-01/);
    assert.match(markdown, /## 9\. Trazabilidad/);
    assert.match(markdown, /## UI\/UX Design Intent/);
    const cov = countPaso0DecisionIdCoverage(catalog, markdown);
    assert.ok(cov.referenced > cov.total * 0.15, `cobertura D-ID ${cov.referenced}/${cov.total}`);
  });
});
