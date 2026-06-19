import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildMddContextForUseCases,
  buildMddContextForUserStories,
  buildMddContextForBlueprint,
  buildMddContextForApiContracts,
  buildMddContextForTasks,
  buildLogicFlowsDiagramHint,
  MDD_DELIVERABLE_BUDGET,
} from "./mdd-deliverable-context.util.js";

const SAMPLE_MDD = (filler: string) => `## 1. Contexto y alcance

### Capacidades funcionales del producto (MVP)

- **Onboarding con IA:** Chat que genera pipeline.

## 3. Modelo de datos

### tenants

## 4. Contratos de API

| Método | Ruta | Descripción |
| GET | \`/api/v1/auth/login\` | Login |

## 99. Ruido de prueba

${filler}`;

describe("buildMddContextForDeliverable", () => {
  it("devuelve el MDD íntegro sin importar tamaño ni kind", () => {
    const short = "## 1. Contexto\n\nCorto.";
    assert.equal(buildMddContextForUserStories(short), short);
    assert.equal(buildMddContextForUseCases(short), short);

    const filler = "x".repeat(MDD_DELIVERABLE_BUDGET + 5000);
    const large = SAMPLE_MDD(filler);
    for (const build of [
      buildMddContextForUserStories,
      buildMddContextForUseCases,
      buildMddContextForBlueprint,
      buildMddContextForApiContracts,
      buildMddContextForTasks,
    ]) {
      assert.equal(build(large), large);
      assert.ok(build(large).includes(filler.slice(0, 200)));
    }
  });

  it("buildLogicFlowsDiagramHint cuando §5 menciona flowchart", () => {
    const mdd = `${SAMPLE_MDD("")}

## 5. Lógica y edge cases

Usar flowchart para onboarding.
`;
    const hint = buildLogicFlowsDiagramHint(mdd);
    assert.ok(hint.includes("flowchart"));
  });
});
