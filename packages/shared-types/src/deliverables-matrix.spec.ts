import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planLegacyDeliverablesToGenerate } from "./deliverables-matrix.js";

describe("planLegacyDeliverablesToGenerate", () => {
  it("omite mdd_canonical cuando ya hay MDD y docs con contenido", () => {
    const planned = planLegacyDeliverablesToGenerate({
      complexity: "HIGH",
      hasMddContent: true,
      contentLengthByField: {
        mddContent: 50_000,
        blueprintContent: 12_000,
        specContent: 0,
      },
    });
    assert.doesNotMatch(planned.join(","), /mdd_canonical/);
    assert.doesNotMatch(planned.join(","), /blueprint/);
    assert.match(planned.join(","), /spec/);
  });
});
