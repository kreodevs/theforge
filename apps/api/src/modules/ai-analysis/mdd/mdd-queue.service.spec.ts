import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MddQueueService } from "./mdd-queue.service.js";

type RunMddGenerationJob = (
  ...args: unknown[]
) => Promise<{ ok: boolean; mode: "pipeline"; projectId: string }>;

function createService(
  overrides?: Partial<{
    runMddGenerationJob: RunMddGenerationJob;
  }>,
): MddQueueService {
  const aiAnalysis = {
    runMddGenerationJob:
      overrides?.runMddGenerationJob ??
      (async () => ({ ok: true, mode: "pipeline" as const, projectId: "" })),
  };
  const legacyCoordinator = { generateMdd: async () => ({}) };
  const generationGuard = {
    registerMddStream: () => {},
    unregisterMddStream: () => {},
    isMddStreamActive: () => false,
  };
  return new MddQueueService(
    aiAnalysis as never,
    legacyCoordinator as never,
    generationGuard as never,
  );
}

describe("MddQueueService.cancelProjectJobs", () => {
  it("cancela jobs in-memory en cola y libera el stream", async () => {
    const service = createService();
    const projectId = "proj-1";
    const jobId = await service.enqueue({
      mode: "pipeline",
      projectId,
      userId: "user-1",
    });

    const result = await service.cancelProjectJobs(projectId);

    assert.equal(result.cancelled, true);
    assert.ok(result.jobIds.includes(jobId));
    const status = await service.getJobStatus(jobId);
    assert.equal(status.status, "failed");
    assert.equal(status.error, "Cancelado por el usuario");
    assert.equal(service.isProjectBusy(projectId), false);
  });

  it("es idempotente si no hay jobs activos", async () => {
    const service = createService();
    const result = await service.cancelProjectJobs("proj-empty");
    assert.deepEqual(result, { ok: true, cancelled: false, jobIds: [] });
  });

  it("deduplica cancelaciones repetidas en 2s", async () => {
    const service = createService();
    const projectId = "proj-dedupe";
    const jobId = await service.enqueue({
      mode: "pipeline",
      projectId,
      userId: "user-1",
    });

    const first = await service.cancelProjectJobs(projectId);
    const second = await service.cancelProjectJobs(projectId);

    assert.equal(first.cancelled, true);
    assert.deepEqual(second, first);
    assert.ok(second.jobIds.includes(jobId));
  });

  it("marca activeJobCooperative para job in-memory activo", async () => {
    let resolveJob!: () => void;
    const hang = new Promise<void>((resolve) => {
      resolveJob = resolve;
    });
    const service = createService({
      runMddGenerationJob: async () => {
        await hang;
        return { ok: true, mode: "pipeline" as const, projectId: "proj-active" };
      },
    });
    const projectId = "proj-active";
    await service.enqueue({ mode: "pipeline", projectId, userId: "user-1" });
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 20));

    const result = await service.cancelProjectJobs(projectId);

    assert.equal(result.activeJobCooperative, true);
    assert.equal(result.cancelled, true);
    assert.equal(service.isProjectCancelled(projectId), true);

    resolveJob();
    await new Promise((r) => setTimeout(r, 30));
  });

  it("isProjectBusyAsync devuelve false sin Redis ni jobs in-memory", async () => {
    const service = createService();
    assert.equal(await service.isProjectBusyAsync("proj-empty"), false);
  });
});
