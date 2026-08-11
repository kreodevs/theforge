import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ProjectGenerationStatus } from "@theforge/shared-types";
import {
  mddJobStillRunning,
  mddLoadingReasonFromJobMode,
  mddPipelineAssistantAck,
  mddPipelineUserLabel,
} from "./mdd-pipeline-chat.util.js";

describe("mddJobStillRunning", () => {
  it("true con job active y mddStreamActive", () => {
    const status: ProjectGenerationStatus = {
      busy: true,
      mddStreamActive: true,
      mddJobs: [{ jobId: "j1", mode: "pipeline", status: "active" }],
      activeJob: null,
      queuedJobs: [],
      gates: {},
    };
    assert.equal(mddJobStillRunning(status), true);
  });

  it("false cuando no hay jobs", () => {
    assert.equal(
      mddJobStillRunning({
        busy: false,
        mddStreamActive: false,
        mddJobs: [],
        activeJob: null,
        queuedJobs: [],
        gates: {},
      }),
      false,
    );
  });
});

describe("mddLoadingReasonFromJobMode", () => {
  it("section modes → mdd-section", () => {
    assert.equal(mddLoadingReasonFromJobMode("section"), "mdd-section");
    assert.equal(mddLoadingReasonFromJobMode("section-pipeline"), "mdd-section");
  });

  it("pipeline → mdd", () => {
    assert.equal(mddLoadingReasonFromJobMode("pipeline"), "mdd");
  });
});

describe("mddPipelineUserLabel", () => {
  it("regenerar si ya hay MDD", () => {
    assert.match(
      mddPipelineUserLabel("pipeline", { hasExistingMdd: true, hasBenchmark: true }),
      /Regenerar MDD completo/,
    );
  });

  it("generar desde benchmark", () => {
    assert.equal(
      mddPipelineUserLabel("pipeline", { hasExistingMdd: false, hasBenchmark: true }),
      "Generar MDD desde benchmark",
    );
  });
});

describe("mddPipelineAssistantAck", () => {
  it("menciona benchmark cuando aplica", () => {
    assert.match(mddPipelineAssistantAck("pipeline", true), /Benchmark & Gap Analysis/);
    assert.doesNotMatch(mddPipelineAssistantAck("pipeline", false), /Benchmark/);
  });
});
