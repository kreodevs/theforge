import type { ProjectGenerationStatus } from "@theforge/shared-types";
import { primaryMddJob } from "@theforge/shared-types";

/** Job MDD activo o en cola según generation-status del servidor. */
export function mddJobStillRunning(
  status: ProjectGenerationStatus | null | undefined,
): boolean {
  const job = primaryMddJob(status ?? null);
  if (!job) return false;
  if (job.status !== "active" && job.status !== "queued" && job.status !== "retrying") {
    return false;
  }
  return Boolean(
    status?.mddStreamActive ||
      (status?.mddJobs ?? []).some(
        (j) => j.status === "active" || j.status === "queued" || j.status === "retrying",
      ),
  );
}

export function mddLoadingReasonFromJobMode(
  mode: string | undefined,
): "mdd" | "mdd-section" {
  return mode === "section" || mode === "section-pipeline" ? "mdd-section" : "mdd";
}

export function mddPipelineUserLabel(
  mode: string | undefined,
  opts?: { hasExistingMdd?: boolean; hasBenchmark?: boolean },
): string {
  if (mode === "upstream-sync") return "Sincronizar MDD desde upstream";
  if (mode === "section" || mode === "section-pipeline") {
    return "Regenerar sección MDD (pipeline)";
  }
  if (opts?.hasExistingMdd) return "Regenerar MDD completo desde benchmark";
  if (opts?.hasBenchmark) return "Generar MDD desde benchmark";
  return "Generar MDD";
}

export function mddPipelineAssistantAck(
  mode: string | undefined,
  hasBenchmark: boolean,
): string {
  const lead =
    mode === "upstream-sync"
      ? "Sincronización MDD desde upstream encolada."
      : mode === "section" || mode === "section-pipeline"
        ? "Regeneración de sección MDD encolada."
        : "Pipeline MDD encolado.";
  const bench = hasBenchmark ? " Se usa el Benchmark & Gap Analysis ya definido." : "";
  return `${lead}${bench} Puedes cerrar el navegador; al volver verás el progreso aquí y el documento en el panel central.`;
}
