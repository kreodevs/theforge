import type { GenerationJobType, MddJobSnapshot, ProjectGenerationStatus } from "@theforge/shared-types";
import { GENERATION_JOB_TYPE_LABELS, MDD_JOB_MODE_LABELS } from "@theforge/shared-types";

/** Mapeo panel Workshop → tipo de job de cola. */
export const WORKSHOP_PANEL_TO_GENERATION_JOB: Partial<Record<string, GenerationJobType>> = {
  spec: "spec",
  architecture: "architecture",
  "use-cases": "use-cases",
  "user-stories": "user-stories",
  blueprint: "blueprint",
  "api-contracts": "api-contracts",
  "logic-flows": "logic-flows",
  tasks: "tasks",
  infra: "infra",
  "agent-governance": "agent-governance",
};

export function generationJobAllowed(
  status: ProjectGenerationStatus | null | undefined,
  type: GenerationJobType,
): boolean {
  if (!status) return true;
  return status.gates?.[type]?.allowed !== false;
}

export function generationGateReason(
  status: ProjectGenerationStatus | null | undefined,
  type: GenerationJobType,
): string | null {
  const gate = status?.gates?.[type];
  if (!gate || gate.allowed) return null;
  return gate.reason ?? "Generación bloqueada por dependencias u otro job en curso.";
}

export function activeGenerationLabel(status: ProjectGenerationStatus | null | undefined): string | null {
  if (!status?.busy) return null;
  if (status.mddStreamActive) {
    const mddJob = primaryMddJob(status);
    if (mddJob?.progressActive?.agent) {
      return `${mddJob.progressActive.agent}…`;
    }
    if (mddJob?.progressAgent && mddJob.progressPhase === "active") {
      return `${mddJob.progressAgent}…`;
    }
    if (mddJob) {
      return `${MDD_JOB_MODE_LABELS[mddJob.mode]}…`;
    }
    return "Regenerando MDD…";
  }
  const job = status.activeJob ?? status.queuedJobs[0];
  if (!job) return "Generación en curso…";
  return `Generando ${GENERATION_JOB_TYPE_LABELS[job.type]}…`;
}

export function primaryMddJob(
  status: ProjectGenerationStatus | null | undefined,
): MddJobSnapshot | null {
  if (!status?.mddJobs?.length) return null;
  return status.mddJobs.find((j) => j.status === "active") ?? status.mddJobs[0] ?? null;
}
