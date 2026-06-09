import type { ComplexityLevel } from "./project.js";

/** Claves de entregables para despacho dinámico (backend). */
export type DeliverableKind =
  | "mdd_canonical"
  | "spec"
  | "architecture"
  | "use_cases"
  | "blueprint"
  | "api_contracts"
  | "logic_flows"
  | "ux_ui_guide"
  | "user_stories"
  | "agent_governance"
  | "tasks"
  | "infra";

/** Etiquetas legibles para progreso de cascada y UI Workshop. */
export const DELIVERABLE_STEP_LABELS: Record<DeliverableKind, string> = {
  mdd_canonical: "MDD Canonical",
  spec: "Spec",
  architecture: "Arquitectura",
  use_cases: "Casos de Uso",
  blueprint: "Blueprint",
  api_contracts: "Contratos API",
  logic_flows: "Flujos de Lógica",
  ux_ui_guide: "Guía UX/UI",
  user_stories: "Historias de Usuario",
  agent_governance: "Gobernanza de agentes",
  tasks: "Tareas",
  infra: "Infraestructura",
};

/** Labels de pasos de cascada según complejidad (orden de `DELIVERABLES_BY_COMPLEXITY`). */
export function deliverableStepLabelsForComplexity(
  complexity: ComplexityLevel,
): string[] {
  return DELIVERABLES_BY_COMPLEXITY[complexity].map((k) => DELIVERABLE_STEP_LABELS[k]);
}

/**
 * Matriz por complejidad: orden de ejecución. `mdd_canonical` no invoca LLM (el MDD vive en Stage/chat).
 */
export const DELIVERABLES_BY_COMPLEXITY: Record<ComplexityLevel, DeliverableKind[]> = {
  LOW: ["user_stories", "tasks", "agent_governance"],
  MEDIUM: ["spec", "api_contracts", "ux_ui_guide", "agent_governance", "tasks"],
  HIGH: [
    "mdd_canonical",
    "blueprint",
    "spec",
    "architecture",
    "use_cases",
    "user_stories",
    "ux_ui_guide",
    "api_contracts",
    "logic_flows",
    "agent_governance",
    "tasks",
    "infra",
  ],
};
