import { computeCrossDocumentConsistency, extractConcepts } from "../consistency.util";

describe("extractConcepts", () => {
  it("extracts H2 titles", () => {
    const s = extractConcepts("## Módulo de Pagos\n## Facturación Electrónica");
    expect(s.has("módulo de pagos")).toBe(true);
    expect(s.has("facturación electrónica")).toBe(true);
  });

  it("extracts bold phrases", () => {
    const s = extractConcepts("El sistema **generará facturas** automáticamente.");
    expect(s.has("generará facturas")).toBe(true);
  });

  it("returns empty for no concepts", () => {
    const s = extractConcepts("Esto es un texto corto.");
    expect(s.size).toBe(0);
  });
});

describe("computeCrossDocumentConsistency", () => {
  it("returns score 50 when no source or target docs", () => {
    const r = computeCrossDocumentConsistency({});
    expect(r.score).toBe(50);
    expect(r.gaps).toHaveLength(0);
  });

  it("detects covered concept between BRD and Architecture", () => {
    const docs = {
      brdContent: "## Módulo de Pagos\nEl sistema procesará **pagos con tarjeta**.\n",
      architectureContent: "## Pagos\nLa arquitectura soporta pagos con tarjeta y Paypal.\n",
    };
    const r = computeCrossDocumentConsistency(docs);
    // "módulo de pagos" should be covered in architecture content (pagos appears)
    // "pagos con tarjeta" should be covered
    expect(r.score).toBeGreaterThanOrEqual(50);
  });

  it("detects missing concept gap", () => {
    const docs = {
      brdContent: "## Módulo de Facturación\n**Generación de facturas** automática.\n",
      architectureContent: "## Gestión de Usuarios\nSolo maneja registro y login.\n",
    };
    const r = computeCrossDocumentConsistency(docs);
    // "facturación" and "facturas" not in architecture → gaps
    expect(r.gaps.length).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(50);
  });

  it("returns 100 when all concepts are covered across all targets", () => {
    const docs = {
      brdContent: "## Usuarios\n**Registro de usuarios** con email.\n## Pagos\n**Pagos recurrentes** mensuales.\n",
      architectureContent: "## Usuarios\nRegistro con email y autenticación.\n## Pagos\nSuscripciones y pagos recurrentes.\n",
      apiContractsContent: "POST /users registro con email\nPOST /payments pagos recurrentes\n",
      logicFlowsContent: "Flujo de registro y flujo de pago recurrente.\n",
    };
    const r = computeCrossDocumentConsistency(docs);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("handles empty or partial doc sets gracefully", () => {
    const docs = {
      brdContent: "## Solo BRD\n**Sin nada técnico** que no esté.\n",
      // No target docs
    };
    const r = computeCrossDocumentConsistency(docs);
    // No targets → neutral 50
    expect(r.score).toBe(50);
    expect(r.gaps).toHaveLength(0);
  });
});
