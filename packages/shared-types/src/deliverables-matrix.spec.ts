import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DELIVERABLES_BY_COMPLEXITY,
  planLegacyDeliverablesToGenerate,
} from "./deliverables-matrix.js";

describe("planLegacyDeliverablesToGenerate", () => {
  it("omite solo mdd_canonical cuando ya hay MDD; regenera el resto", () => {
    const planned = planLegacyDeliverablesToGenerate({
      complexity: "HIGH",
      hasMddContent: true,
    });
    assert.doesNotMatch(planned.join(","), /mdd_canonical/);
    assert.match(planned.join(","), /blueprint/);
    assert.match(planned.join(","), /spec/);
  });
});

describe("DELIVERABLES_BY_COMPLEXITY agent_governance ordering", () => {
  it("LOW ejecuta agent_governance después de tasks", () => {
    const kinds = DELIVERABLES_BY_COMPLEXITY.LOW;
    assert.ok(kinds.indexOf("tasks") < kinds.indexOf("agent_governance"));
  });

  it("MEDIUM y HIGH ejecutan agent_governance después de tasks", () => {
    for (const complexity of ["MEDIUM", "HIGH"] as const) {
      const kinds = DELIVERABLES_BY_COMPLEXITY[complexity];
      assert.ok(
        kinds.indexOf("tasks") < kinds.indexOf("agent_governance"),
        `${complexity}: tasks debe preceder agent_governance`,
      );
    }
  });

  it("HIGH ejecuta agent_governance después de blueprint y architecture", () => {
    const kinds = DELIVERABLES_BY_COMPLEXITY.HIGH;
    assert.ok(kinds.indexOf("blueprint") < kinds.indexOf("agent_governance"));
    assert.ok(kinds.indexOf("architecture") < kinds.indexOf("agent_governance"));
  });
});
