import { describe, expect, it } from "vitest";
import {
  estimateHighMddTopModelCostMxn,
  highMddTopModelCostHintEs,
} from "./mdd-ia-cost-reference.js";

describe("mdd-ia-cost-reference", () => {
  it("estima coste MXN de referencia para proyecto HIGH con modelo top", () => {
    const mxn = estimateHighMddTopModelCostMxn();
    expect(mxn).toBeGreaterThan(100);
    expect(highMddTopModelCostHintEs()).toContain("Referencia:");
    expect(highMddTopModelCostHintEs()).toContain("MXN");
  });
});
