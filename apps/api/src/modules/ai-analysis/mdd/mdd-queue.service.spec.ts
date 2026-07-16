import { describe, expect, it, vi } from "vitest";
import { MddQueueService } from "./mdd-queue.service.js";

function createService(
  overrides?: Partial<{
    runMddGenerationJob: ReturnType<typeof vi.fn>;
  }>,
): MddQueueService {
  const aiAnalysis = {
    runMddGenerationJob: overrides?.runMddGenerationJob ?? vi.fn(),
  };
  const legacyCoordinator = { generateMdd: vi.fn() };
  const generationGuard = {
    registerMddStream: vi.fn(),
    unregisterMddStream: vi.fn(),
    isMddStreamActive: vi.fn(() => false),
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

    expect(result.cancelled).toBe(true);
    expect(result.jobIds).toContain(jobId);
    const status = await service.getJobStatus(jobId);
    expect(status.status).toBe("failed");
    expect(status.error).toBe("Cancelado por el usuario");
    expect(service.isProjectBusy(projectId)).toBe(false);
  });

  it("es idempotente si no hay jobs activos", async () => {
    const service = createService();
    const result = await service.cancelProjectJobs("proj-empty");
    expect(result).toEqual({ ok: true, cancelled: false, jobIds: [] });
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

    expect(first.cancelled).toBe(true);
    expect(second).toEqual(first);
    expect(second.jobIds).toContain(jobId);
  });

  it("marca activeJobCooperative para job in-memory activo", async () => {
    let resolveJob!: () => void;
    const hang = new Promise<void>((resolve) => {
      resolveJob = resolve;
    });
    const service = createService({
      runMddGenerationJob: vi.fn(async () => {
        await hang;
        return { ok: true, mode: "pipeline" as const, projectId: "proj-active" };
      }),
    });
    const projectId = "proj-active";
    await service.enqueue({ mode: "pipeline", projectId, userId: "user-1" });
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 20));

    const result = await service.cancelProjectJobs(projectId);

    expect(result.activeJobCooperative).toBe(true);
    expect(result.cancelled).toBe(true);
    expect(service.isProjectCancelled(projectId)).toBe(true);

    resolveJob();
    await new Promise((r) => setTimeout(r, 30));
  });

  it("isProjectBusyAsync devuelve false sin Redis ni jobs in-memory", async () => {
    const service = createService();
    await expect(service.isProjectBusyAsync("proj-empty")).resolves.toBe(false);
  });
});
