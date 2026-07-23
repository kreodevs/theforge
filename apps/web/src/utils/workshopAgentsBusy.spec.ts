import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isServerSideQueuedWork, isWorkshopAgentsBusy } from "./workshopAgentsBusy.js";
import type { ProjectGenerationStatus } from "@theforge/shared-types";

const idle = {
  loading: false,
  loadingReason: null,
  generationStatus: null,
  streamingUserMessage: null,
  streamingContent: null,
  agentProgress: [] as const,
  mddReviewing: false,
  pendingPlanApproval: null,
};

describe("isServerSideQueuedWork", () => {
  it("detecta MDD en cola por loadingReason", () => {
    assert.equal(
      isServerSideQueuedWork({
        ...idle,
        loading: true,
        loadingReason: "mdd",
      }),
      true,
    );
  });

  it("detecta job activo en generationStatus", () => {
    const generationStatus: ProjectGenerationStatus = {
      busy: true,
      mddStreamActive: true,
      mddJobs: [{ jobId: "108", mode: "pipeline", status: "active" }],
      activeJob: null,
      queuedJobs: [],
      gates: {},
    };
    assert.equal(
      isServerSideQueuedWork({
        ...idle,
        generationStatus,
      }),
      true,
    );
  });
});

describe("isWorkshopAgentsBusy", () => {
  it("no bloquea navegación con MDD encolado en servidor", () => {
    assert.equal(
      isWorkshopAgentsBusy({
        ...idle,
        loading: true,
        loadingReason: "mdd",
        agentProgress: [{ agent: "Auditor", message: "Revisando…" }],
        generationStatus: {
          busy: true,
          mddStreamActive: true,
          mddJobs: [{ jobId: "108", mode: "pipeline", status: "active" }],
          activeJob: null,
          queuedJobs: [],
          gates: {},
        },
      }),
      false,
    );
  });

  it("sigue bloqueando benchmark en streaming", () => {
    assert.equal(
      isWorkshopAgentsBusy({
        ...idle,
        loading: true,
        loadingReason: "benchmark",
        agentProgress: [{ agent: "Analista", message: "Investigando…" }],
      }),
      true,
    );
  });

  it("sigue bloqueando chat en streaming", () => {
    assert.equal(
      isWorkshopAgentsBusy({
        ...idle,
        streamingContent: "Pensando…",
      }),
      true,
    );
  });
});
