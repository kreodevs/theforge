import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MddFlowTraceService } from "./mdd-flow-trace.service.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MddFlowTraceService", () => {
  it("emits job_start and job_end with correlationId and elapsedMs", async () => {
    const svc = new MddFlowTraceService();
    const logs: string[] = [];
    (svc as unknown as { logger: { log: (msg: string) => void } }).logger = {
      log: (msg: string) => logs.push(msg),
    };

    svc.jobStart("corr-a", { mode: "pipeline", projectId: "p1" });
    await sleep(12);
    svc.stepStart("corr-a", "clarifier");
    svc.jobEnd("corr-a", { ok: true });

    assert.equal(logs.length, 3);
    assert.match(logs[0], /\[MDD:Flow\] correlationId=corr-a event=job_start elapsedMs=0/);
    assert.match(logs[0], /"mode":"pipeline"/);
    assert.match(logs[1], /event=step_start elapsedMs=\d+/);
    const stepElapsed = Number(logs[1].match(/elapsedMs=(\d+)/)?.[1] ?? 0);
    assert.ok(stepElapsed >= 10);
    assert.match(logs[2], /event=job_end/);
  });

  it("clears job start time after jobEnd", () => {
    const svc = new MddFlowTraceService();
    const logs: string[] = [];
    (svc as unknown as { logger: { log: (msg: string) => void } }).logger = {
      log: (msg: string) => logs.push(msg),
    };

    svc.jobStart("corr-b");
    svc.jobEnd("corr-b");
    svc.stepStart("corr-b", "formatter");

    assert.match(logs[2], /event=step_start elapsedMs=0/);
  });

  it("runWithStepHeartbeats resolves work and propagates errors", async () => {
    const svc = new MddFlowTraceService();
    svc.jobStart("corr-c");
    const result = await svc.runWithStepHeartbeats("corr-c", "security", async () => "ok");
    assert.equal(result, "ok");
    await assert.rejects(
      () => svc.runWithStepHeartbeats("corr-c", "security", async () => {
        throw new Error("fail");
      }),
      /fail/,
    );
  });

  it("emits route_decision and correction_start with routing context", () => {
    const svc = new MddFlowTraceService();
    const logs: string[] = [];
    (svc as unknown as { logger: { log: (msg: string) => void } }).logger = {
      log: (msg: string) => logs.push(msg),
    };

    svc.jobStart("corr-d");
    svc.correctionStart("corr-d", {
      mddIteration: 1,
      gapCount: 1,
      sectionsToRun: ["software_architect", "security", "integration", "formatter"],
      firstNode: "software_architect",
    });
    svc.routeDecision("corr-d", "routeAfterIntegration", "formatter", {
      sectionsToRun: ["software_architect", "security", "integration", "formatter"],
      delegateTarget: "sections",
      qualityGateOk: false,
    });

    assert.match(logs[1], /event=correction_start/);
    assert.match(logs[1], /"firstNode":"software_architect"/);
    assert.match(logs[2], /event=route_decision/);
    assert.match(logs[2], /"router":"routeAfterIntegration"/);
    assert.match(logs[2], /"destination":"formatter"/);
  });
});
