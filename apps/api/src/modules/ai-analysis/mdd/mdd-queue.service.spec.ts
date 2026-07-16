import { describe, expect, it, vi } from "vitest";
import { MddQueueService } from "./mdd-queue.service.js";

function createService(): MddQueueService {
  const aiAnalysis = { runMddGenerationJob: vi.fn() };
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

  it("isProjectBusyAsync devuelve false sin Redis ni jobs in-memory", async () => {
    const service = createService();
    await expect(service.isProjectBusyAsync("proj-empty")).resolves.toBe(false);
  });
});
