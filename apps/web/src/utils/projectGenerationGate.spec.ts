import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeGenerationLabel, primaryMddJob } from "./projectGenerationGate.js";
import type { ProjectGenerationStatus } from "@theforge/shared-types";

describe("primaryMddJob", () => {
  it("prefiere job active sobre queued", () => {
    const status: ProjectGenerationStatus = {
      busy: true,
      mddStreamActive: true,
      mddJobs: [
        { jobId: "q1", mode: "pipeline", status: "queued" },
        { jobId: "a1", mode: "section", status: "active", progressMessage: "Diagramas Mermaid añadidos" },
      ],
      activeJob: null,
      queuedJobs: [],
      gates: {},
    };
    assert.equal(primaryMddJob(status)?.jobId, "a1");
    assert.match(activeGenerationLabel(status) ?? "", /Regeneración de sección MDD/);
  });
});
