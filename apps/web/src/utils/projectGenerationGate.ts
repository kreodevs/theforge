import type { GenerationJobType, ProjectGenerationStatus } from "@theforge/shared-types";
import { GENERATION_JOB_TYPE_LABELS } from "@theforge/shared-types";

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
  if (status.mddStreamActive) return "Regenerando MDD…";
  const job = status.activeJob ?? status.queuedJobs[0];
  if (!job) return "Generación en curso…";
  return `Generando ${GENERATION_JOB_TYPE_LABELS[job.type]}…`;
}
