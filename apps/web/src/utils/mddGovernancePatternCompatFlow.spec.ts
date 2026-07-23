import { describe, expect, it } from "node:test";
import assert from "node:assert/strict";
import { offerGovernancePatternCompat } from "./mddGovernancePatternCompatFlow.js";

describe("offerGovernancePatternCompat", () => {
  it("procede sin diálogo cuando no hay incompatibilidades", () => {
    const offer = offerGovernancePatternCompat(new Set(["repository"]));
    assert.equal(offer.proceed, true);
    if (offer.proceed) {
      assert.ok(offer.correctedIds.has("repository"));
    }
  });

  it("bloquea y corrige microservicios + monolito-modular", () => {
    const offer = offerGovernancePatternCompat(
      new Set(["microservicios", "monolito-modular", "repository"]),
    );
    assert.equal(offer.proceed, false);
    if (!offer.proceed) {
      assert.ok(offer.correctedIds.has("monolito-modular"));
      assert.ok(!offer.correctedIds.has("microservicios"));
      assert.ok(offer.correctedIds.has("repository"));
      assert.ok(offer.corrections.length > 0);
    }
  });
});
