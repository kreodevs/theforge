import { apiFetch, API_BASE } from "./apiClient";
import { isMddJobTerminalFailure } from "./mddJobTerminalFailure";

const POLL_MAX_ATTEMPTS = 10_800;
const POLL_INTERVAL_MS = 2_000;

let activeMddPollAbort: AbortController | null = null;
let mddPollCancelRequested = false;

/** Señal compartida para abortar el poll MDD activo desde la UI (Detener). */
export function beginMddPollScope(): AbortSignal {
  activeMddPollAbort?.abort();
  activeMddPollAbort = new AbortController();
  mddPollCancelRequested = false;
  return activeMddPollAbort.signal;
}

export function abortActiveMddPoll(): void {
  mddPollCancelRequested = true;
  activeMddPollAbort?.abort();
}

export function wasMddPollCancelled(): boolean {
  return mddPollCancelRequested;
}

export function clearMddPollScope(): void {
  mddPollCancelRequested = false;
  activeMddPollAbort = null;
}

export function resolveMddPollSignal(signal?: AbortSignal): AbortSignal {
  return signal ?? beginMddPollScope();
}

export type MddJobStatusResponse = {
  status: string;
  progress?: {
    agent?: string;
    message?: string;
    phase?: string;
    mddLength?: number;
    section?: number;
  };
  result?: {
    ok?: boolean;
    outcome?: "done" | "interrupt";
    threadId?: string;
    mddLength?: number;
    interrupt?: {
      reply?: string;
      questions?: string[];
      planMessage?: string;
    };
  };
  error?: string;
};

export type PollMddJobOptions = {
  onProgress?: (progress: MddJobStatusResponse["progress"]) => void;
  signal?: AbortSignal;
};

export { isMddJobTerminalFailure } from "./mddJobTerminalFailure";

/**
 * Polls an MDD background job until completed or failed.
 */
export async function pollMddJob(
  jobId: string,
  projectId: string,
  options?: PollMddJobOptions,
): Promise<MddJobStatusResponse> {
  const signal = resolveMddPollSignal(options?.signal);
  const pollUrl = `${API_BASE}/projects/${projectId}/mdd-jobs/${jobId}`;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) throw new Error("Cancelado por el usuario");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const pr = await apiFetch(pollUrl);
    if (!pr.ok) {
      if (pr.status === 404) throw new Error("Job MDD no encontrado");
      continue;
    }
    const status = (await pr.json()) as MddJobStatusResponse;
    if (status.progress && options?.onProgress) {
      options.onProgress(status.progress);
    }
    if (status.status === "completed") return status;
    if (status.status === "failed") {
      if (isMddJobTerminalFailure(status.error)) {
        return status;
      }
      throw new Error(status.error ?? "Error al generar MDD en background");
    }
  }
  throw new Error(
    "Tiempo de espera agotado (6 h). Recarga el proyecto; el job puede haber terminado en el servidor.",
  );
}

/**
 * POST ai-analysis/mdd/jobs and poll until done.
 */
export async function enqueueAndPollMddJob(
  body: Record<string, unknown>,
  projectId: string,
  options?: PollMddJobOptions,
): Promise<MddJobStatusResponse> {
  const signal = resolveMddPollSignal(options?.signal);
  const r = await apiFetch(`${API_BASE}/ai-analysis/mdd/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al encolar MDD");
  }
  const data = (await r.json()) as { queued?: boolean; jobId?: string };
  if (!data.queued || !data.jobId) {
    throw new Error("Respuesta inesperada al encolar MDD");
  }
  return pollMddJob(data.jobId, projectId, { ...options, signal });
}

/**
 * POST legacy/generate-mdd (queued by default) and poll.
 */
export async function enqueueAndPollLegacyMdd(
  projectId: string,
  stageId: string | undefined,
  options?: PollMddJobOptions,
): Promise<MddJobStatusResponse> {
  const signal = resolveMddPollSignal(options?.signal);
  const body: Record<string, unknown> = {};
  if (stageId?.trim()) body.stageId = stageId.trim();
  const r = await apiFetch(`${API_BASE}/projects/${projectId}/legacy/generate-mdd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al encolar MDD legacy");
  }
  const data = (await r.json()) as { queued?: boolean; jobId?: string; ok?: boolean };
  if (data.queued && data.jobId) {
    return pollMddJob(data.jobId, projectId, { ...options, signal });
  }
  return { status: "completed", result: { ok: data.ok ?? true, outcome: "done" } };
}
