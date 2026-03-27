import { test } from "node:test";
import assert from "node:assert/strict";
import { ComplexityLevel, Status } from "@theforge/database";
import { SemaphoreService, type SemaphoreEvaluationInput } from "./semaphore.service.js";

const emptyDeliverables: SemaphoreEvaluationInput["deliverables"] = {
  specContent: null,
  useCasesContent: null,
  userStoriesContent: null,
  tasksContent: null,
  apiContractsContent: null,
  uxUiGuideContent: null,
  logicFlowsContent: null,
  infraContent: null,
};

function highBase(over: Partial<SemaphoreEvaluationInput> = {}): SemaphoreEvaluationInput {
  return {
    complexity: ComplexityLevel.HIGH,
    hasUxTeam: false,
    mddJsonString: null,
    deliverables: emptyDeliverables,
    ...over,
  };
}

test("HIGH: gaps edge_cases/field_types → AMARILLO sin alivio de grafo", () => {
  const s = new SemaphoreService();
  const mdd = JSON.stringify({
    db_entities: [{ name: "users" }],
    business_core: "core flows",
    edge_cases: "",
    field_types: "short",
  });
  const r = s.evaluate(
    highBase({
      mddJsonString: mdd,
      sddDomainGraphOk: false,
    }),
  );
  assert.equal(r.status, Status.AMARILLO);
});

test("HIGH: mismos gaps → VERDE con sddDomainGraphOk y precision 92", () => {
  const s = new SemaphoreService();
  const mdd = JSON.stringify({
    db_entities: [{ name: "users" }],
    business_core: "core flows",
    edge_cases: "",
    field_types: "short",
  });
  const r = s.evaluate(
    highBase({
      mddJsonString: mdd,
      sddDomainGraphOk: true,
    }),
  );
  assert.equal(r.status, Status.VERDE);
  assert.equal(r.precisionScore, 92);
});

test("HIGH: checklist completo → VERDE precision 95 sin grafo", () => {
  const s = new SemaphoreService();
  const mdd = JSON.stringify({
    db_entities: [{ name: "users" }],
    business_core: "core flows",
    edge_cases: "e1: lockout after N attempts",
    field_types:
      "Detailed field_types markdown with inferred types and enough length to pass the semaphore heuristic threshold.",
  });
  const r = s.evaluate(highBase({ mddJsonString: mdd }));
  assert.equal(r.status, Status.VERDE);
  assert.equal(r.precisionScore, 95);
});
