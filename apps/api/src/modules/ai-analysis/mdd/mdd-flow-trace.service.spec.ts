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

  it("emits architect_llm_pass and section5_pass_skipped events", () => {
    const svc = new MddFlowTraceService();
    const logs: string[] = [];
    (svc as unknown as { logger: { log: (msg: string) => void } }).logger = {
      log: (msg: string) => logs.push(msg),
    };

    svc.jobStart("corr-e");
    svc.architectLlmPass("corr-e", {
      passNumber: 1,
      passKind: "architect_sections_2_to_5",
      promptChars: 12000,
      promptTokensEst: 3000,
      outputTextChars: 8000,
      llmInvokeDurationMs: 45000,
      maxOutputTokens: 32768,
      toolLoopCount: 1,
      mddNeedsSection5PassAfterPass: false,
      logicaEdgeCasesBodyChars: 420,
    });
    svc.section5PassSkipped("corr-e", { reason: "section5_substantial_after_pass1" });

    assert.match(logs[1], /event=architect_llm_pass/);
    assert.match(logs[1], /"passNumber":1/);
    assert.match(logs[1], /"maxOutputTokens":32768/);
    assert.match(logs[1], /"mddNeedsSection5PassAfterPass":false/);
    assert.match(logs[2], /event=section5_pass_skipped/);
  });

  it("emits correction_sections_skipped_architect and job_duration_estimate", () => {
    const svc = new MddFlowTraceService();
    const logs: string[] = [];
    (svc as unknown as { logger: { log: (msg: string) => void } }).logger = {
      log: (msg: string) => logs.push(msg),
    };

    svc.jobStart("corr-f");
    svc.correctionSectionsSkippedArchitect("corr-f", {
      reason: "gaps_only_sec_int",
      correctionAgents: ["security", "integration"],
    });
    svc.jobDurationEstimate("corr-f", { phase: "correction_start", estimatedArchitectPassesSkipped: 1 });

    assert.match(logs[1], /event=correction_sections_skipped_architect/);
    assert.match(logs[2], /event=job_duration_estimate/);
    assert.match(logs[2], /"estimatedArchitectPassesSkipped":1/);
  });

  it("emits clarifier_json_parse with repair metadata", () => {
    const svc = new MddFlowTraceService();
    const logs: string[] = [];
    (svc as unknown as { logger: { log: (msg: string) => void } }).logger = {
      log: (msg: string) => logs.push(msg),
    };

    svc.jobStart("corr-g");
    svc.clarifierJsonParse("corr-g", {
      source: "local_repair",
      escapeRepaired: true,
      llmRetry: false,
    });

    assert.match(logs[1], /event=clarifier_json_parse/);
    assert.match(logs[1], /"source":"local_repair"/);
    assert.match(logs[1], /"escapeRepaired":true/);
  });
});
