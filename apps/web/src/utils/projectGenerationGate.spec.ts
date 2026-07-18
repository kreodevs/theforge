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
        {
          jobId: "a1",
          mode: "section",
          status: "active",
          progressActive: { agent: "Auditor (calidad MDD)", message: "Evaluando calidad del MDD…" },
        },
      ],
      activeJob: null,
      queuedJobs: [],
      gates: {},
    };
    assert.equal(primaryMddJob(status)?.jobId, "a1");
    assert.match(activeGenerationLabel(status) ?? "", /Auditor \(calidad MDD\)/);
  });

  it("muestra etiqueta upstream-sync", () => {
    const status: ProjectGenerationStatus = {
      busy: true,
      mddStreamActive: true,
      mddJobs: [{ jobId: "u1", mode: "upstream-sync", status: "active" }],
      activeJob: null,
      queuedJobs: [],
      gates: {},
    };
    assert.match(activeGenerationLabel(status) ?? "", /Sincronización MDD desde upstream/);
  });
});
