import type { WorkerOptions } from "bullmq";

/**
 * Opciones BullMQ para workers con jobs LLM largos (MDD, cascadas).
 * Tolerancia extra ante stalls legítimos (sin heartbeat durante inferencia).
 * Los jobs huérfanos tras reinicio del API se recuperan en onModuleInit, no aquí.
 */
export const BULLMQ_LONG_JOB_WORKER_OPTS = {
  stalledInterval: 120_000,
  maxStalledCount: 3,
} as const satisfies Partial<WorkerOptions>;
