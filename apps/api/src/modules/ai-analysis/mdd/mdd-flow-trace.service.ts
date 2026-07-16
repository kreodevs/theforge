import { Injectable, Logger } from "@nestjs/common";

export const MDD_FLOW_HEARTBEAT_MS = 15_000;

export type MddFlowTraceOpts = {
  service: MddFlowTraceService;
  correlationId: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class MddFlowTraceService {
  private readonly logger = new Logger(MddFlowTraceService.name);
  private readonly jobStarts = new Map<string, number>();

  private elapsedMs(correlationId: string): number {
    const start = this.jobStarts.get(correlationId);
    return start != null ? Date.now() - start : 0;
  }

  private emit(correlationId: string, event: string, payload: Record<string, unknown> = {}): void {
    const elapsedMs = this.elapsedMs(correlationId);
    this.logger.log(
      `[MDD:Flow] correlationId=${correlationId} event=${event} elapsedMs=${elapsedMs} ${JSON.stringify(payload)}`,
    );
  }

  jobStart(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.jobStarts.set(correlationId, Date.now());
    this.emit(correlationId, "job_start", payload);
  }

  jobEnd(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "job_end", payload);
    this.jobStarts.delete(correlationId);
  }

  stepStart(correlationId: string, step: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "step_start", { step, ...payload });
  }

  stepEnd(correlationId: string, step: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "step_end", { step, ...payload });
  }

  heartbeat(correlationId: string, step: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "heartbeat", { step, ...payload });
  }

  cacheHit(correlationId: string, step: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "cache_hit", { step, ...payload });
  }

  prepareStart(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "prepare_start", payload);
  }

  prepareEnd(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "prepare_end", payload);
  }

  persistDraft(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "persist_draft", payload);
  }

  persistFinal(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "persist_final", payload);
  }

  toolStart(correlationId: string, tool: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "tool_start", { tool, ...payload });
  }

  toolEnd(correlationId: string, tool: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "tool_end", { tool, ...payload });
  }

  routeDecision(
    correlationId: string,
    router: string,
    destination: string,
    payload: Record<string, unknown> = {},
  ): void {
    this.emit(correlationId, "route_decision", { router, destination, ...payload });
  }

  correctionStart(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "correction_start", payload);
  }

  graphRouteCrash(
    correlationId: string,
    router: string,
    destination: string,
    payload: Record<string, unknown> = {},
  ): void {
    this.emit(correlationId, "graph_route_crash", { router, destination, ...payload });
  }

  section5PassSkipped(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "section5_pass_skipped", payload);
  }

  section5PassTriggered(correlationId: string, payload: Record<string, unknown> = {}): void {
    this.emit(correlationId, "section5_pass_triggered", payload);
  }

  /** Runs work while emitting heartbeats every {@link MDD_FLOW_HEARTBEAT_MS} until settled. */
  async runWithStepHeartbeats<T>(
    correlationId: string,
    step: string,
    work: () => Promise<T>,
  ): Promise<T> {
    let settled = false;
    let result!: T;
    let error: unknown;
    const tracked = work().then(
      (value) => {
        settled = true;
        result = value;
      },
      (err) => {
        settled = true;
        error = err;
      },
    );

    while (!settled) {
      const winner = await Promise.race([
        tracked.then(() => "done" as const),
        sleep(MDD_FLOW_HEARTBEAT_MS).then(() => "tick" as const),
      ]);
      if (winner === "tick" && !settled) {
        this.heartbeat(correlationId, step);
      }
    }

    await tracked;
    if (error !== undefined) throw error;
    return result;
  }
}
