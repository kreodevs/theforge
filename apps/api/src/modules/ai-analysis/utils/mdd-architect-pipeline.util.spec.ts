import { describe, it } from "node:test";
import assert from "node:assert";
import type { MDDStateType } from "../state/index.js";
import {
  agentsForArchitectSection,
  expandArchitectAgentNames,
  getArchitectNodeSequence,
  isHighSplitArchitectPipeline,
  shouldDecoupleSection5FromArchitect,
} from "./mdd-architect-pipeline.util.js";

describe("mdd-architect-pipeline.util", () => {
  const baseState = { mddComplexity: "HIGH" } as MDDStateType;

  it("isHighSplitArchitectPipeline solo en HIGH pasada completa", () => {
    assert.equal(isHighSplitArchitectPipeline({ ...baseState, mddComplexity: "MEDIUM" }), false);
    assert.equal(isHighSplitArchitectPipeline(baseState), true);
    assert.equal(
      isHighSplitArchitectPipeline({ ...baseState, delegateTarget: "sections", sectionsToRun: ["data_model"] }),
      false,
    );
  });

  it("getArchitectNodeSequence divide §2–§4 en HIGH", () => {
    assert.deepEqual(getArchitectNodeSequence("HIGH"), [
      "stack_architect",
      "data_model",
      "architect_critic",
      "api_contracts",
    ]);
    assert.deepEqual(getArchitectNodeSequence("MEDIUM"), ["software_architect", "architect_critic"]);
  });

  it("expandArchitectAgentNames sustituye software_architect en HIGH", () => {
    const expanded = expandArchitectAgentNames(["software_architect", "security"], "HIGH");
    assert.ok(expanded.includes("stack_architect"));
    assert.ok(expanded.includes("data_model"));
    assert.ok(expanded.includes("api_contracts"));
    assert.equal(expanded.includes("software_architect"), false);
  });

  it("agentsForArchitectSection mapea sección a agente scoped", () => {
    assert.deepEqual(agentsForArchitectSection(2, "HIGH"), ["stack_architect"]);
    assert.deepEqual(agentsForArchitectSection(3, "HIGH"), ["data_model"]);
    assert.deepEqual(agentsForArchitectSection(4, "HIGH"), ["api_contracts"]);
    assert.deepEqual(agentsForArchitectSection(3, "MEDIUM"), ["software_architect"]);
  });

  it("shouldDecoupleSection5FromArchitect en pasada completa", () => {
    assert.equal(shouldDecoupleSection5FromArchitect(baseState, "full"), true);
    assert.equal(shouldDecoupleSection5FromArchitect(baseState, "stack"), true);
    assert.equal(
      shouldDecoupleSection5FromArchitect({ ...baseState, sectionsToRun: ["software_architect"] }, "full"),
      true,
    );
  });
});
