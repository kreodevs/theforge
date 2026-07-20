import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkBrdMddUatConformance,
  extractBrdUatScenarios,
  injectMissingUatScenariosIntoMdd,
} from "./brd-mdd-uat-conformance.util.js";

const BRD = `
## Criterios de Aceptación (UAT)

**Escenario 1 — Fraccionamiento de orden**
Dado un usuario con saldo...

**Escenario 2 — Idempotencia de webhook**
Cuando llega el mismo evento...

**Escenario 3 — Límite IA / quota tokens**
Entonces se rechaza la petición...

**Escenario 4 — Stop-loss automático**
Cuando el precio cruza el umbral...
`;

const MDD_PARTIAL = `
## 1. Contexto y Alcance

### Criterios de Aceptación (UAT)

**Escenario 1 — Fraccionamiento de orden**
Dado un usuario...

**Escenario 2 — Idempotencia de webhook**
Cuando llega el mismo evento...
`;

describe("brd-mdd-uat-conformance.util", () => {
  it("extracts four BRD UAT scenarios", () => {
    const scenarios = extractBrdUatScenarios(BRD);
    assert.equal(scenarios.length, 4);
    assert.equal(scenarios[2]?.number, 3);
    assert.ok(scenarios[3]?.keywords.some((k) => k.includes("stop")));
  });

  it("flags missing scenarios 3 and 4 in MDD", () => {
    const report = checkBrdMddUatConformance({
      brdMarkdown: BRD,
      mddMarkdown: MDD_PARTIAL,
    });
    assert.equal(report.brdCount, 4);
    assert.equal(report.mddCount, 2);
    assert.equal(report.missingInMdd.length, 2);
    assert.match(report.gaps[0] ?? "", /3.*4|faltan/i);
  });

  it("injects missing UAT scenarios into §1", () => {
    const report = checkBrdMddUatConformance({
      brdMarkdown: BRD,
      mddMarkdown: MDD_PARTIAL,
    });
    const { markdown, injected } = injectMissingUatScenariosIntoMdd(
      MDD_PARTIAL,
      report.missingInMdd,
    );
    assert.equal(injected.length, 2);
    assert.match(markdown, /Escenario 3/i);
    assert.match(markdown, /Stop-loss/i);
    const after = checkBrdMddUatConformance({
      brdMarkdown: BRD,
      mddMarkdown: markdown,
    });
    assert.equal(after.missingInMdd.length, 0);
  });
});
