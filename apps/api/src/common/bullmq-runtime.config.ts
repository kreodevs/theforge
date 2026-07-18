/**
 * Configuración de runtime BullMQ: rol HTTP/worker, Redis obligatorio en prod y concurrencia.
 *
 * - `THEFORGE_RUNTIME_ROLE=all|http|worker` — `http`: solo encola; `worker`: solo consume; `all`: dev monolito.
 * - `REDIS_URL` obligatorio si `NODE_ENV=production`.
 * - Concurrencia por cola vía env (defaults conservadores).
 */
export type TheForgeRuntimeRole = "all" | "http" | "worker";

const MDD_CONCURRENCY_MIN = 1;
const MDD_CONCURRENCY_MAX = 8;
const DELIVERABLES_CONCURRENCY_MIN = 1;
const DELIVERABLES_CONCURRENCY_MAX = 6;
const LEGACY_CONCURRENCY_MIN = 1;
const LEGACY_CONCURRENCY_MAX = 4;

export function resolveTheForgeRuntimeRole(
  env: NodeJS.ProcessEnv = process.env,
): TheForgeRuntimeRole {
  const raw = env.THEFORGE_RUNTIME_ROLE?.trim().toLowerCase();
  if (raw === "http" || raw === "worker" || raw === "all") return raw;
  return "all";
}

export function shouldStartBullmqWorkers(env: NodeJS.ProcessEnv = process.env): boolean {
  const role = resolveTheForgeRuntimeRole(env);
  return role === "all" || role === "worker";
}

export function shouldStartHttpServer(env: NodeJS.ProcessEnv = process.env): boolean {
  const role = resolveTheForgeRuntimeRole(env);
  return role === "all" || role === "http";
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

/** URL Redis o null en dev sin cola. En production lanza si falta. */
export function resolveRedisUrlOrThrow(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = env.REDIS_URL?.trim();
  if (url) return url;
  if (isProductionRuntime(env)) {
    throw new Error(
      "REDIS_URL is required in production (BullMQ). Example: redis://theforge-redis-queue:6379",
    );
  }
  return null;
}

export function assertRedisConfiguredForProduction(env: NodeJS.ProcessEnv = process.env): void {
  resolveRedisUrlOrThrow(env);
}

function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

/** Jobs MDD concurrentes por worker (cada job = pipeline LangGraph pesado). Default 2. */
export function resolveMddWorkerConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  return parseBoundedInt(
    env.MDD_BULLMQ_CONCURRENCY,
    2,
    MDD_CONCURRENCY_MIN,
    MDD_CONCURRENCY_MAX,
  );
}

export function resolveDeliverablesWorkerConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  return parseBoundedInt(
    env.DELIVERABLES_BULLMQ_CONCURRENCY,
    2,
    DELIVERABLES_CONCURRENCY_MIN,
    DELIVERABLES_CONCURRENCY_MAX,
  );
}

export function resolveLegacyDeliverablesWorkerConcurrency(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parseBoundedInt(
    env.LEGACY_DELIVERABLES_BULLMQ_CONCURRENCY,
    1,
    LEGACY_CONCURRENCY_MIN,
    LEGACY_CONCURRENCY_MAX,
  );
}
