import { describe, expect, it } from "vitest";
import {
  formatMddHighPipelinePhaseHeading,
  resolveMddHighPipelinePhase,
} from "./mdd-high-pipeline-phases.js";

describe("mdd-high-pipeline-phases", () => {
  it("mapea nodos del pipeline HIGH a fases UI", () => {
    const phase = resolveMddHighPipelinePhase("data_model");
    expect(phase).toEqual({ index: 2, total: 4, label: "Modelo de datos" });
    expect(formatMddHighPipelinePhaseHeading(phase!)).toBe("Fase 2/4: Modelo de datos");
  });

  it("devuelve null para nodos fuera del pipeline HIGH", () => {
    expect(resolveMddHighPipelinePhase("clarifier")).toBeNull();
  });
});
