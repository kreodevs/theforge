import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applySecurityArchitectureSeverityUpgrades,
  applyServerAuditTimestamp,
  computeMissingCatalogIds,
  countAccountedCatalogVerifications,
  dedupeSecurityArchitectureHallazgos,
  evaluateAnalyticalDepthGate,
  fillMissingCatalogCoverage,
  filterHypotheticalE06Hallazgos,
  filterGlobalNoEvaluadoEntries,
  finalizeSecurityArchitectureStructured,
  isFragmentScopedNoEvaluadoEntry,
  isSecurityArchitectureCoberturaCoherent,
  mergeSecurityArchitectureAuditResponses,
  mergeSecurityArchitectureAuditStructured,
  mergeSecurityArchitectureChunkExtractions,
  mergeSecurityArchitectureFamilyExtractions,
  parseSecurityArchitectureAuditResponse,
  recalcSecurityArchitectureCobertura,
  recalcSecurityArchitectureResumen,
  resolveSecurityAuditPassMode,
  SERVER_FILLED_NO_EVALUADO_JUSTIFICATION,
  shouldUseChunkedSecurityAudit,
  splitMddForSecurityAudit,
  validateSecurityArchitectureCoverageGate,
} from "../mdd-security-architecture-audit-parse.util.js";
import {
  MDD_SECURITY_AUDIT_SINGLE_SHOT_MAX_CHARS,
  SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS,
  SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE,
} from "../mdd-security-architecture-audit-catalog.js";
import {
  isSecurityAuditLowAnalyticalCoverage,
  SECURITY_AUDIT_LOW_COVERAGE_WARNING,
} from "@theforge/shared-types/mdd-security-audit-display";

describe("parseSecurityArchitectureAuditResponse", () => {
  it("extrae JSON §8.3 y veredicto", () => {
    const raw = [
      "### 8.1 Veredicto",
      "Veredicto de puerta: `NO APTO PARA IMPLEMENTACIÓN`",
      "",
      "```json",
      JSON.stringify({
        veredicto: "NO_APTO",
        resumen: { bloqueante: 1, alto: 0, medio: 0, bajo: 0 },
        hallazgos: [{ id: "GAP-001", severidad: "BLOQUEANTE", titulo: "Test" }],
      }),
      "```",
    ].join("\n");

    const parsed = parseSecurityArchitectureAuditResponse(raw);
    assert.equal(parsed.structured?.veredicto, "NO_APTO");
    assert.equal(parsed.veredicto, "NO_APTO");
    assert.equal(parsed.structured?.hallazgos?.length, 1);
    assert.ok(parsed.markdownReport.includes("8.1 Veredicto"));
  });

  it("tolera respuesta sin JSON", () => {
    const raw = "### 8.1 Veredicto\n\nVeredicto de puerta: APTO CON CONDICIONES";
    const parsed = parseSecurityArchitectureAuditResponse(raw);
    assert.equal(parsed.structured, null);
    assert.equal(parsed.veredicto, "APTO CON CONDICIONES");
  });

  it("extrae §8.4 orden de resolución", () => {
    const raw = [
      "### 8.4 Orden de resolución recomendado",
      "",
      "1. **GAP-001** — Arreglar primero",
      "",
      "```json",
      "{}",
      "```",
    ].join("\n");
    const parsed = parseSecurityArchitectureAuditResponse(raw);
    assert.ok(parsed.ordenResolucion?.includes("GAP-001"));
  });
});

describe("shouldUseChunkedSecurityAudit", () => {
  it("KMS ~79k va 1-shot (umbral 100k)", () => {
    const kmsSized = "x".repeat(79_000);
    assert.equal(shouldUseChunkedSecurityAudit(kmsSized), false);
    assert.ok(kmsSized.length < MDD_SECURITY_AUDIT_SINGLE_SHOT_MAX_CHARS);
  });

  it("documento >100k activa chunk", () => {
    assert.equal(shouldUseChunkedSecurityAudit("x".repeat(100_001)), true);
  });
});

describe("resolveSecurityAuditPassMode", () => {
  it("default ≤100k → single-shot (barato)", () => {
    const mdd = "x".repeat(79_000);
    assert.equal(resolveSecurityAuditPassMode(mdd), "single-shot");
    assert.equal(resolveSecurityAuditPassMode(mdd, false), "single-shot");
  });

  it("deepAudit ≤100k → family-multi-pass", () => {
    const mdd = "x".repeat(79_000);
    assert.equal(resolveSecurityAuditPassMode(mdd, true), "family-multi-pass");
  });

  it(">100k siempre chunked aunque deepAudit", () => {
    const huge = "x".repeat(100_001);
    assert.equal(resolveSecurityAuditPassMode(huge), "chunked");
    assert.equal(resolveSecurityAuditPassMode(huge, true), "chunked");
  });
});

describe("splitMddForSecurityAudit", () => {
  it("parte por encabezados ##", () => {
    const mdd = ["# Título", "intro", "", "## 1. Contexto", "cuerpo 1", "", "## 2. Stack", "cuerpo 2"].join(
      "\n",
    );
    const chunks = splitMddForSecurityAudit(mdd);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.some((c) => c.sectionTitle.includes("Contexto")));
    assert.ok(chunks.some((c) => c.content.includes("cuerpo 2")));
  });
});

describe("fragment no_evaluado filters", () => {
  it("detecta excusas de fragmento", () => {
    assert.equal(isFragmentScopedNoEvaluadoEntry("A01 — No hay contenido en este fragmento"), true);
    assert.equal(isFragmentScopedNoEvaluadoEntry("B02 — No se menciona B02 en este fragmento"), true);
    assert.equal(isFragmentScopedNoEvaluadoEntry("C03 — sin mecanismo de motor en §5"), false);
  });

  it("filtra basura de fragmento en merge", () => {
    const filtered = filterGlobalNoEvaluadoEntries([
      "A01 — No hay contenido en este fragmento",
      "B01 — no aplica: sistema sin MFA",
    ]);
    assert.equal(filtered.length, 1);
    assert.ok(filtered[0]?.includes("B01"));
  });
});

describe("applySecurityArchitectureSeverityUpgrades", () => {
  it("C03 inmutabilidad ALTO → BLOQUEANTE", () => {
    const out = applySecurityArchitectureSeverityUpgrades([
      {
        verificacion: "C03",
        severidad: "ALTO",
        titulo: "Auditoría inmutable sin REVOKE ni trigger",
        evidencia: "§5 declara inmutabilidad solo en prosa",
      },
    ]);
    assert.equal(out[0]?.severidad, "BLOQUEANTE");
  });
});

describe("dedupeSecurityArchitectureHallazgos", () => {
  it("dedupe por id conservando mayor severidad", () => {
    const out = dedupeSecurityArchitectureHallazgos([
      { id: "GAP-001", severidad: "ALTO", titulo: "a" },
      { id: "GAP-001", severidad: "BLOQUEANTE", titulo: "b" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.severidad, "BLOQUEANTE");
  });

  it("dedupe por verificacion si no hay id", () => {
    const out = dedupeSecurityArchitectureHallazgos([
      { verificacion: "C03", severidad: "MEDIO" },
      { verificacion: "C03", severidad: "BLOQUEANTE" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.severidad, "BLOQUEANTE");
  });

  it("dedupe por verificacion de catálogo aunque ids GAP distintos", () => {
    const out = dedupeSecurityArchitectureHallazgos([
      {
        id: "GAP-001",
        verificacion: "A02",
        severidad: "ALTO",
        evidencia: "timeout corto",
      },
      {
        id: "GAP-005",
        verificacion: "A02",
        severidad: "BLOQUEANTE",
        evidencia: "timeout DB 5s incompatible con latencia HSM 10s en §7",
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.severidad, "BLOQUEANTE");
    assert.equal(out[0]?.id, "GAP-005");
  });

  it("finalize recalcula resumen tras dedupe por verificacion", () => {
    const finalized = finalizeSecurityArchitectureStructured({
      veredicto: "NO_APTO",
      resumen: { bloqueante: 2, alto: 0, medio: 0, bajo: 0 },
      hallazgos: [
        { id: "GAP-001", verificacion: "A02", severidad: "BLOQUEANTE", titulo: "Timeout A" },
        { id: "GAP-005", verificacion: "A02", severidad: "ALTO", titulo: "Timeout B" },
      ],
    });
    assert.equal(finalized.hallazgos?.length, 1);
    assert.equal(finalized.resumen?.bloqueante, 1);
    assert.equal(finalized.resumen?.alto, 0);
  });
});

describe("filterHypotheticalE06Hallazgos", () => {
  it("elimina E06 hipotético cuando el doc declara RS256", () => {
    const out = filterHypotheticalE06Hallazgos([
      {
        verificacion: "E06",
        severidad: "BLOQUEANTE",
        titulo: "Riesgo HS256 hipotético",
        evidencia:
          "El MDD declara RS256 en §4; podrían usar HS256 en múltiples réplicas verificadoras",
      },
    ]);
    assert.equal(out.length, 0);
  });

  it("conserva E06 con evidencia positiva de HS256", () => {
    const out = filterHypotheticalE06Hallazgos([
      {
        verificacion: "E06",
        severidad: "BLOQUEANTE",
        titulo: "JWT firmado con HS256",
        evidencia: "§5 especifica algoritmo HS256 compartido entre 3 réplicas",
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.severidad, "BLOQUEANTE");
  });

  it("degrada E06 ambiguo con hedging y mención HS256 a ALTO", () => {
    const out = filterHypotheticalE06Hallazgos([
      {
        verificacion: "E06",
        severidad: "BLOQUEANTE",
        titulo: "Posible HS256",
        evidencia: "Si se usa HS256 con HS256 en réplicas podría haber forja",
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.severidad, "ALTO");
  });
});

describe("recalcSecurityArchitectureCobertura", () => {
  it("invariante ejecutadas = pasa + falla + no_aplica", () => {
    const cobertura = recalcSecurityArchitectureCobertura({
      hallazgos: [
        { verificacion: "C03", severidad: "BLOQUEANTE" },
        { verificacion: "E06", severidad: "ALTO" },
        { verificacion: "A02", severidad: "BLOQUEANTE" },
      ],
      no_evaluado: ["B01 — no aplica: sin cifrado de campo"],
    });
    assert.ok(isSecurityArchitectureCoberturaCoherent(cobertura));
    assert.equal(cobertura.falla, 3);
    assert.equal(cobertura.no_aplica, 1);
    assert.equal(cobertura.pasa, 0);
    assert.equal(cobertura.ejecutadas, 4);
  });

  it("no infiere PASS por omisión del catálogo incompleto", () => {
    const cobertura = recalcSecurityArchitectureCobertura({
      hallazgos: [{ verificacion: "A01", severidad: "MEDIO" }],
      no_evaluado: [],
    });
    assert.equal(cobertura.falla, 1);
    assert.equal(cobertura.pasa, 0);
    assert.equal(cobertura.no_aplica, 0);
    assert.equal(cobertura.ejecutadas, 1);
  });
});

describe("fillMissingCatalogCoverage", () => {
  it("rellena IDs omitidos con justificación server-side", () => {
    const hallazgos = [
      { verificacion: "C03", severidad: "BLOQUEANTE" },
      { verificacion: "E06", severidad: "ALTO" },
    ];
    const filled = fillMissingCatalogCoverage({ hallazgos, no_evaluado: [] });
    assert.equal(filled.length, SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE - 2);
    assert.ok(filled.every((e) => e.includes(SERVER_FILLED_NO_EVALUADO_JUSTIFICATION)));
    assert.ok(filled.some((e) => e.startsWith("A01")));
    assert.ok(!filled.some((e) => e.startsWith("C03")));
  });

  it("finalize completa catálogo y gate pasa tras respuesta parcial (~8/88)", () => {
    const partial = {
      veredicto: "NO_APTO",
      resumen: { bloqueante: 2, alto: 0, medio: 0, bajo: 0 },
      cobertura: { ejecutadas: 8, pasa: 0, falla: 8, no_aplica: 0 },
      hallazgos: [
        { id: "GAP-001", severidad: "BLOQUEANTE", verificacion: "C03" },
        { id: "GAP-002", severidad: "BLOQUEANTE", verificacion: "E06" },
        { id: "GAP-003", severidad: "BLOQUEANTE", verificacion: "A02" },
        { id: "GAP-004", severidad: "BLOQUEANTE", verificacion: "B04" },
        { id: "GAP-005", severidad: "BLOQUEANTE", verificacion: "D01" },
        { id: "GAP-006", severidad: "BLOQUEANTE", verificacion: "F02" },
        { id: "GAP-007", severidad: "BLOQUEANTE", verificacion: "G01" },
        { id: "GAP-008", severidad: "BLOQUEANTE", verificacion: "A01" },
      ],
    };
    assert.equal(computeMissingCatalogIds(partial).length, 80);

    const finalized = finalizeSecurityArchitectureStructured(partial);
    assert.equal(countAccountedCatalogVerifications(finalized), SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE);
    assert.equal(finalized.cobertura?.ejecutadas, SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE);
    assert.equal(finalized.cobertura?.falla, 8);
    assert.equal(finalized.cobertura?.no_aplica, 80);
    assert.equal(finalized.cobertura?.pasa, 0);
    assert.ok(isSecurityArchitectureCoberturaCoherent(finalized.cobertura ?? {}));

    const gate = validateSecurityArchitectureCoverageGate(finalized);
    assert.equal(gate.ok, true);
  });
});

describe("mergeSecurityArchitectureFamilyExtractions", () => {
  it("fusiona familias A/B/C con dedupe por verificacion", () => {
    const merged = mergeSecurityArchitectureFamilyExtractions([
      {
        hallazgos: [
          { id: "GAP-001", severidad: "ALTO", verificacion: "A02", titulo: "Timeout A" },
          { id: "GAP-002", severidad: "BLOQUEANTE", verificacion: "A02", titulo: "Timeout B" },
        ],
        no_evaluado: ["A01 — no aplica: sin diagramas"],
      },
      {
        hallazgos: [{ id: "GAP-003", severidad: "BLOQUEANTE", verificacion: "C03", titulo: "Inmutabilidad" }],
        no_evaluado: ["B01 — no aplica: sin cifrado de campo"],
      },
      {
        hallazgos: [{ id: "GAP-004", severidad: "ALTO", verificacion: "E06", titulo: "JWT" }],
        no_evaluado: ["E01 — pasa: sin auto-concesión detectada"],
      },
    ]);
    assert.equal(merged.hallazgos?.length, 3);
    assert.equal(
      merged.hallazgos?.find((h) => h.verificacion === "A02")?.severidad,
      "BLOQUEANTE",
    );
    assert.equal(countAccountedCatalogVerifications(merged), SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE);
    assert.ok(merged.no_evaluado?.some((e) => e.startsWith("A01")));
    assert.ok(merged.no_evaluado?.some((e) => e.includes(SERVER_FILLED_NO_EVALUADO_JUSTIFICATION)));
  });
});

describe("evaluateAnalyticalDepthGate", () => {
  it("MDD grande con <5 hallazgos dispara reintento", () => {
    const gate = evaluateAnalyticalDepthGate({
      mddContentLength: 79_000,
      hallazgosCount: 2,
      afterRetry: false,
    });
    assert.equal(gate.needsRetry, true);
    assert.equal(gate.lowCoverageWarning, false);
    assert.ok(gate.reason?.includes("79"));
  });

  it("tras reintento persiste shallow → warning sin forzar PASS", () => {
    const gate = evaluateAnalyticalDepthGate({
      mddContentLength: 79_000,
      hallazgosCount: 2,
      afterRetry: true,
    });
    assert.equal(gate.needsRetry, false);
    assert.equal(gate.lowCoverageWarning, true);
  });

  it("MDD pequeño o suficientes hallazgos → sin gate", () => {
    assert.deepEqual(
      evaluateAnalyticalDepthGate({
        mddContentLength: 10_000,
        hallazgosCount: 2,
        afterRetry: false,
      }),
      { needsRetry: false, lowCoverageWarning: false },
    );
    assert.deepEqual(
      evaluateAnalyticalDepthGate({
        mddContentLength: 79_000,
        hallazgosCount: 12,
        afterRetry: false,
      }),
      { needsRetry: false, lowCoverageWarning: false },
    );
  });
});

describe("isSecurityAuditLowAnalyticalCoverage", () => {
  it("detecta warning API o ratio no_revisado >70%", () => {
    assert.equal(
      isSecurityAuditLowAnalyticalCoverage({
        warnings: [SECURITY_AUDIT_LOW_COVERAGE_WARNING],
        coberturaUi: { ejecutadas: 88, pasa: 0, falla: 2, noRevisado: 10, noAplica: 76 },
      }),
      true,
    );
    assert.equal(
      isSecurityAuditLowAnalyticalCoverage({
        warnings: [],
        coberturaUi: { ejecutadas: 88, pasa: 0, falla: 2, noRevisado: 86, noAplica: 0 },
      }),
      true,
    );
    assert.equal(
      isSecurityAuditLowAnalyticalCoverage({
        warnings: [],
        coberturaUi: { ejecutadas: 88, pasa: 10, falla: 12, noRevisado: 20, noAplica: 46 },
      }),
      false,
    );
  });
});

describe("mergeSecurityArchitectureChunkExtractions", () => {
  it("fusiona hallazgos e ids_vistos sin no_evaluado de fragmento", () => {
    const merged = mergeSecurityArchitectureChunkExtractions([
      {
        hallazgos: [{ id: "GAP-001", severidad: "ALTO", verificacion: "C03", titulo: "Inmutabilidad" }],
        ids_vistos: ["C03", "A01"],
        no_evaluado: ["B01 — No hay contenido en este fragmento"],
      },
      {
        hallazgos: [{ id: "GAP-002", severidad: "ALTO", verificacion: "E06", titulo: "HS256" }],
        ids_vistos: ["E06", "E11"],
      },
    ]);
    assert.equal(merged.hallazgos.length, 2);
    assert.equal(merged.hallazgos[0]?.severidad, "BLOQUEANTE");
    assert.ok(merged.idsVistos.includes("A01"));
    assert.ok(merged.idsVistos.includes("E11"));
  });
});

describe("mergeSecurityArchitectureAuditStructured", () => {
  it("fusiona chunks y recalcula resumen", () => {
    const merged = mergeSecurityArchitectureAuditStructured([
      {
        hallazgos: [{ id: "GAP-001", severidad: "BLOQUEANTE", verificacion: "C03" }],
        no_evaluado: ["A01 — fuera de fragmento"],
      },
      {
        hallazgos: [{ id: "GAP-002", severidad: "ALTO", verificacion: "E06" }],
        no_evaluado: ["B01 — no aplica KMS"],
      },
    ]);
    assert.equal(merged.hallazgos?.length, 2);
    assert.equal(merged.resumen?.bloqueante, 1);
    assert.equal(merged.resumen?.alto, 1);
    assert.equal(merged.veredicto, "NO_APTO");
    assert.ok(isSecurityArchitectureCoberturaCoherent(merged.cobertura ?? {}));
    assert.ok(!merged.no_evaluado?.some(isFragmentScopedNoEvaluadoEntry));
  });

  it("orden_resolucion no concatena chunks — usa lista única", () => {
    const merged = mergeSecurityArchitectureAuditStructured([
      {
        hallazgos: [{ id: "GAP-001", severidad: "ALTO", verificacion: "A02", titulo: "Timeout" }],
        orden_resolucion: "1. Chunk A orden\n2. Otro del chunk A",
      },
      {
        hallazgos: [{ id: "GAP-002", severidad: "MEDIO", verificacion: "C09", titulo: "TOTP" }],
        orden_resolucion: "1. Chunk B primero\n2. Chunk B segundo",
      },
    ]);
    assert.ok(merged.orden_resolucion);
    assert.equal((merged.orden_resolucion?.match(/Chunk/g) ?? []).length, 0);
    assert.ok(merged.orden_resolucion?.includes("GAP-001"));
    assert.ok(merged.orden_resolucion?.includes("GAP-002"));
  });
});

describe("mergeSecurityArchitectureAuditResponses", () => {
  it("genera markdown único §8", () => {
    const merged = mergeSecurityArchitectureAuditResponses([
      {
        markdownReport: "chunk1",
        structured: {
          hallazgos: [{ id: "GAP-001", severidad: "ALTO", verificacion: "A02", titulo: "Timeout" }],
        },
      },
      {
        markdownReport: "chunk2",
        structured: {
          hallazgos: [{ id: "GAP-002", severidad: "MEDIO", verificacion: "C09", titulo: "TOTP" }],
        },
      },
    ]);
    assert.ok(merged.markdownReport.includes("### 8.1 Veredicto"));
    assert.ok(merged.markdownReport.includes("### 8.4 Orden de resolución"));
    assert.equal(merged.structured?.hallazgos?.length, 2);
  });
});

describe("validateSecurityArchitectureCoverageGate", () => {
  it("rechaza cobertura parcial sin finalize (sin relleno server-side)", () => {
    const gate = validateSecurityArchitectureCoverageGate({
      veredicto: "APTO",
      resumen: { bloqueante: 0, alto: 0, medio: 1, bajo: 0 },
      cobertura: { ejecutadas: 14, pasa: 0, falla: 14, no_aplica: 0 },
      hallazgos: [{ id: "GAP-001", severidad: "MEDIO", verificacion: "A01" }],
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.reason?.includes("Cobertura insuficiente"));
  });

  it("acepta cuando no_evaluado completa catálogo", () => {
    const evaluated = new Set(["C03", "E06"]);
    const noEvaluado = SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.filter((id) => !evaluated.has(id)).map(
      (id) => `${id} — no cubierto en documento`,
    );
    const structured = finalizeSecurityArchitectureStructured({
      veredicto: "NO_APTO",
      resumen: { bloqueante: 2, alto: 0, medio: 0, bajo: 0 },
      hallazgos: [
        { id: "GAP-001", severidad: "BLOQUEANTE", verificacion: "C03" },
        { id: "GAP-002", severidad: "BLOQUEANTE", verificacion: "E06" },
      ],
      no_evaluado: noEvaluado,
    });
    const gate = validateSecurityArchitectureCoverageGate(structured);
    assert.equal(gate.ok, true);
    assert.ok(isSecurityArchitectureCoberturaCoherent(structured.cobertura ?? {}));
  });

  it("rechaza no_evaluado con excusas de fragmento", () => {
    const gate = validateSecurityArchitectureCoverageGate({
      resumen: { bloqueante: 1, alto: 0, medio: 0, bajo: 0 },
      hallazgos: [{ id: "GAP-001", severidad: "BLOQUEANTE", verificacion: "C03" }],
      no_evaluado: [
        "A01 — No hay contenido en este fragmento",
        ...SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.filter((id) => id !== "C03" && id !== "A01").map(
          (id) => `${id} — no visible en fragmento`,
        ),
      ],
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.reason?.includes("fragmento"));
  });

  it("rechaza resumen inconsistente con hallazgos", () => {
    const gate = validateSecurityArchitectureCoverageGate({
      resumen: { bloqueante: 0, alto: 0, medio: 0, bajo: 0 },
      hallazgos: [
        { id: "GAP-001", severidad: "BLOQUEANTE", verificacion: "C03" },
        { id: "GAP-002", severidad: "ALTO", verificacion: "E06" },
      ],
      no_evaluado: SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.filter(
        (id) => id !== "C03" && id !== "E06",
      ).map((id) => `${id} — cubierto en documento`),
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.reason?.includes("resumen"));
  });
});

describe("applyServerAuditTimestamp", () => {
  it("sobrescribe fecha_auditoria y añade auditedAt", () => {
    const ts = "2026-07-27T18:00:00.000Z";
    const out = applyServerAuditTimestamp(
      { fecha_auditoria: "2020-01-01", veredicto: "APTO" },
      ts,
    );
    assert.equal(out.fecha_auditoria, ts);
    assert.equal(out.auditedAt, ts);
  });
});

describe("recalcSecurityArchitectureResumen", () => {
  it("cuenta severidades", () => {
    const resumen = recalcSecurityArchitectureResumen([
      { severidad: "BLOQUEANTE" },
      { severidad: "ALTO" },
      { severidad: "ALTO" },
      { severidad: "BAJO" },
    ]);
    assert.deepEqual(resumen, { bloqueante: 1, alto: 2, medio: 0, bajo: 1 });
  });
});
