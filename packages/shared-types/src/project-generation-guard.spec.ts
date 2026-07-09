import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeliverableReadiness,
  deliverableKindsRequiredBefore,
  evaluateGenerationGate,
  MIN_GENERATION_CONTENT_LEN,
} from "./project-generation-guard.js";

const READY = "x".repeat(MIN_GENERATION_CONTENT_LEN);

describe("deliverableKindsRequiredBefore", () => {
  it("HIGH spec requires mdd only (wave 0)", () => {
    const required = deliverableKindsRequiredBefore("spec", "HIGH");
    assert.deepEqual(required, ["mdd_canonical"]);
  });

  it("HIGH blueprint requires W0 and W1", () => {
    const required = deliverableKindsRequiredBefore("blueprint", "HIGH");
    assert.ok(required.includes("mdd_canonical"));
    assert.ok(required.includes("spec"));
    assert.ok(required.includes("architecture"));
  });

  it("HIGH tasks requires prior waves", () => {
    const required = deliverableKindsRequiredBefore("tasks", "HIGH");
    assert.ok(required.includes("blueprint"));
    assert.ok(!required.includes("tasks"));
  });
});

describe("evaluateGenerationGate", () => {
  const baseReady = buildDeliverableReadiness({
    mddContent: READY,
    specContent: READY,
    architectureContent: READY,
    blueprintContent: READY,
    apiContractsContent: READY,
    logicFlowsContent: READY,
    userStoriesContent: READY,
    useCasesContent: READY,
    uxUiGuideContent: READY,
    tasksContent: READY,
    infraContent: READY,
    agentGovernanceContent: READY,
  });

  it("blocks spec when mdd job is queued", () => {
    const gate = evaluateGenerationGate({
      complexity: "HIGH",
      contentReady: { ...baseReady, mdd_canonical: false },
      mddStreamActive: false,
      activeJobs: [{ jobId: "1", type: "cascade", status: "queued" }],
      requestedType: "spec",
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.blockReason, "project_busy");
  });

  it("blocks spec when mdd stream active", () => {
    const gate = evaluateGenerationGate({
      complexity: "HIGH",
      contentReady: baseReady,
      mddStreamActive: true,
      activeJobs: [],
      requestedType: "spec",
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.blockReason, "mdd_stream");
  });

  it("blocks tasks when spec job active even if spec content exists", () => {
    const gate = evaluateGenerationGate({
      complexity: "HIGH",
      contentReady: baseReady,
      mddStreamActive: false,
      activeJobs: [{ jobId: "2", type: "spec", status: "active" }],
      requestedType: "tasks",
    });
    assert.equal(gate.allowed, false);
    assert.ok(gate.reason?.includes("Spec"));
  });

  it("allows architecture when spec job active is same-type only", () => {
    const gate = evaluateGenerationGate({
      complexity: "HIGH",
      contentReady: baseReady,
      mddStreamActive: false,
      activeJobs: [{ jobId: "3", type: "architecture", status: "active" }],
      requestedType: "architecture",
    });
    assert.equal(gate.allowed, true);
  });
});
