import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeCostEstimation, HOURS_PER_ENTITY } from "./index.js";

describe("smoke @theforge/business-rules", () => {
  it("computeCostEstimation exporta y calcula horas base", () => {
    const result = computeCostEstimation({
      entityCount: 2,
      screenCount: 1,
      extraEndpointCount: 0,
      metadataTags: [],
      infraFixedHours: 0,
      status: "VERDE",
    });
    assert.ok(result.totalHours >= 2 * HOURS_PER_ENTITY);
    assert.ok(result.totalMxn > 0);
  });
});
