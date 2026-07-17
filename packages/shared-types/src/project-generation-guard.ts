import type { ComplexityLevel } from "./project.js";
import {
  DELIVERABLE_PROJECT_CONTENT_FIELD,
  DELIVERABLE_WAVES_BY_COMPLEXITY,
  type DeliverableKind,
  type DeliverableWaveStep,
} from "./deliverables-matrix.js";

/** Longitud mínima para considerar un entregable persistido como terminado (alineado con semáforo). */
export const MIN_GENERATION_CONTENT_LEN = 48;

/** Tipos de job de generación soportados por la cola BullMQ / in-memory. */
export type GenerationJobType =
  | "cascade"
  | "spec"
  | "blueprint"
  | "api-contracts"
  | "logic-flows"
  | "tasks"
  | "agent-governance"
  | "infra"
  | "architecture"
  | "use-cases"
  | "user-stories"
  | "doc-reconcile-partial"
  | "plugin-artifact";

export const GENERATION_JOB_TYPE_LABELS: Record<GenerationJobType, string> = {
  cascade: "Cascada de entregables",
  spec: "Spec",
  blueprint: "Blueprint",
  "api-contracts": "Contratos API",
  "logic-flows": "Flujos de lógica",
  tasks: "Tasks",
  "agent-governance": "Gobernanza de agentes",
  infra: "Infraestructura",
  architecture: "Arquitectura",
  "use-cases": "Casos de uso",
  "user-stories": "Historias de usuario",
  "doc-reconcile-partial": "Reconciliación parcial",
  "plugin-artifact": "Artifact de plugin",
};

/** Mapeo job → entregable (null = especial / no aplica campo único). */
export function generationJobToDeliverableKind(
  type: GenerationJobType,
): DeliverableKind | "cascade" | "doc_reconcile" | null {
  switch (type) {
    case "spec":
      return "spec";
    case "architecture":
      return "architecture";
    case "use-cases":
      return "use_cases";
    case "user-stories":
      return "user_stories";
    case "blueprint":
      return "blueprint";
    case "api-contracts":
      return "api_contracts";
    case "logic-flows":
      return "logic_flows";
    case "tasks":
      return "tasks";
    case "infra":
      return "infra";
    case "agent-governance":
      return "agent_governance";
    case "cascade":
      return "cascade";
    case "doc-reconcile-partial":
      return "doc_reconcile";
    default:
      return null;
  }
}

export type GenerationJobSnapshot = {
  jobId: string;
  type: GenerationJobType;
  status: "queued" | "active" | "retrying";
};

export type GenerationGateBlockReason =
  | "project_busy"
  | "mdd_stream"
  | "missing_upstream"
  | "upstream_job";

export type GenerationGateEntry = {
  allowed: boolean;
  reason?: string;
  blockReason?: GenerationGateBlockReason;
};

export type ProjectGenerationStatus = {
  busy: boolean;
  mddStreamActive: boolean;
  activeJob: GenerationJobSnapshot | null;
  queuedJobs: GenerationJobSnapshot[];
  gates: Partial<Record<GenerationJobType, GenerationGateEntry>>;
};

function substantial(content: string | null | undefined): boolean {
  return (content ?? "").trim().length >= MIN_GENERATION_CONTENT_LEN;
}

function isDeliverableKind(step: DeliverableWaveStep): step is DeliverableKind {
  return step !== "ui_screens_sync";
}

/** Entregables de oleadas anteriores que deben estar persistidos antes de generar `target`. */
export function deliverableKindsRequiredBefore(
  target: DeliverableKind,
  complexity: ComplexityLevel,
): DeliverableKind[] {
  const waves = DELIVERABLE_WAVES_BY_COMPLEXITY[complexity];
  const required: DeliverableKind[] = [];
  for (const wave of waves) {
    const waveKinds = wave.filter(isDeliverableKind);
    if (waveKinds.includes(target)) break;
    for (const kind of waveKinds) {
      if (!required.includes(kind)) required.push(kind);
    }
  }
  return required;
}

/** Snapshot de entregables listos según campos persistidos del proyecto. */
export function buildDeliverableReadiness(
  project: Record<string, unknown>,
): Record<DeliverableKind, boolean> {
  const out = {} as Record<DeliverableKind, boolean>;
  for (const [kind, field] of Object.entries(DELIVERABLE_PROJECT_CONTENT_FIELD) as Array<
    [DeliverableKind, string | null]
  >) {
    if (!field) {
      out[kind] = false;
      continue;
    }
    const value = project[field];
    out[kind] = substantial(typeof value === "string" ? value : null);
  }
  return out;
}

function upstreamJobBlocks(
  requiredKinds: DeliverableKind[],
  activeJobs: GenerationJobSnapshot[],
): GenerationGateEntry | null {
  for (const job of activeJobs) {
    const jobKind = generationJobToDeliverableKind(job.type);
    if (jobKind === "cascade" || jobKind === "doc_reconcile") {
      return {
        allowed: false,
        blockReason: "upstream_job",
        reason: `Hay un job en curso (${GENERATION_JOB_TYPE_LABELS[job.type]}). Espera a que termine al 100 %.`,
      };
    }
    if (jobKind && requiredKinds.includes(jobKind)) {
      return {
        allowed: false,
        blockReason: "upstream_job",
        reason: `${GENERATION_JOB_TYPE_LABELS[job.type]} está en cola o ejecutándose; no puedes generar downstream hasta que termine.`,
      };
    }
    if (jobKind === "mdd_canonical" as never) {
      continue;
    }
  }
  return null;
}

function missingUpstreamMessage(kind: DeliverableKind): string {
  return `Falta el entregable upstream «${kind}» persistido y completo.`;
}

/** Evalúa si se puede encolar `requestedType` respetando orden de oleadas y jobs activos. */
export function evaluateGenerationGate(params: {
  complexity: ComplexityLevel;
  contentReady: Record<DeliverableKind, boolean>;
  mddStreamActive: boolean;
  activeJobs: GenerationJobSnapshot[];
  requestedType: GenerationJobType;
}): GenerationGateEntry {
  const { complexity, contentReady, mddStreamActive, activeJobs, requestedType } = params;

  if (mddStreamActive) {
    return {
      allowed: false,
      blockReason: "mdd_stream",
      reason: "Hay una generación o regeneración de MDD en curso. Espera a que termine.",
    };
  }

  if (activeJobs.some((j) => j.type === "cascade")) {
    return {
      allowed: false,
      blockReason: "project_busy",
      reason: "La cascada de entregables está en curso. No encoles otra generación.",
    };
  }

  const otherJobs = activeJobs.filter((j) => j.type !== requestedType);
  if (otherJobs.length > 0) {
    const labels = otherJobs.map((j) => GENERATION_JOB_TYPE_LABELS[j.type]).join(", ");
    return {
      allowed: false,
      blockReason: "project_busy",
      reason: `Ya hay generación en curso (${labels}). Solo un job por proyecto a la vez.`,
    };
  }

  const targetKind = generationJobToDeliverableKind(requestedType);
  if (targetKind === "cascade") {
    if (complexity === "HIGH" && !contentReady.mdd_canonical) {
      return {
        allowed: false,
        blockReason: "missing_upstream",
        reason: "La cascada HIGH requiere MDD persistido y completo antes de continuar.",
      };
    }
    const jobBlock = upstreamJobBlocks([], activeJobs);
    if (jobBlock) return jobBlock;
    return { allowed: true };
  }

  if (targetKind === "doc_reconcile") {
    return { allowed: otherJobs.length === 0 };
  }

  if (!targetKind) {
    return { allowed: true };
  }

  const required = deliverableKindsRequiredBefore(targetKind, complexity);
  const jobBlock = upstreamJobBlocks(required, activeJobs);
  if (jobBlock) return jobBlock;

  for (const kind of required) {
    if (!contentReady[kind]) {
      return {
        allowed: false,
        blockReason: "missing_upstream",
        reason: missingUpstreamMessage(kind),
      };
    }
  }

  return { allowed: true };
}

/** Gates para todos los tipos encolables (UI Workshop). */
export function buildGenerationGates(params: {
  complexity: ComplexityLevel;
  contentReady: Record<DeliverableKind, boolean>;
  mddStreamActive: boolean;
  activeJobs: GenerationJobSnapshot[];
}): Partial<Record<GenerationJobType, GenerationGateEntry>> {
  const types: GenerationJobType[] = [
    "cascade",
    "spec",
    "architecture",
    "use-cases",
    "user-stories",
    "blueprint",
    "api-contracts",
    "logic-flows",
    "tasks",
    "infra",
    "agent-governance",
    "plugin-artifact",
  ];
  const gates: Partial<Record<GenerationJobType, GenerationGateEntry>> = {};
  for (const type of types) {
    gates[type] = evaluateGenerationGate({ ...params, requestedType: type });
  }
  return gates;
}
