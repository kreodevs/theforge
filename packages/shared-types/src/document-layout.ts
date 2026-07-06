/**
 * Document layout mapping: spec-kit primary paths ↔ docs/sdd mirror (agent governance).
 */

import type { ParsedTaskItem } from "./tasks-parse.js";

export type DocumentLayoutKind = "spec-kit-primary";

export interface DocumentPathEntry {
  /** Primary path (spec-kit layout at repo root). */
  primary: string;
  /** Mirror path under docs/sdd/ (agent governance scaffold). */
  mirror: string;
  label: string;
  /** When true, the row is annotated as optional in governance tables. */
  optional?: boolean;
}

/** Workshop-only artefacts (not always exported to spec-kit). */
export interface WorkshopSupplementEntry {
  label: string;
  location: string;
  note: string;
}

/**
 * Canonical spec-kit ↔ docs/sdd map (Workshop flow order).
 * `{featureDir}` is resolved at runtime (e.g. `specs/001-my-feature`).
 */
export const DOCUMENT_PATH_MAP_STATIC: DocumentPathEntry[] = [
  {
    primary: ".specify/memory/constitution.md",
    mirror: "docs/sdd/mdd.md",
    label: "Constitución (MDD)",
  },
  {
    primary: "{featureDir}/research.md",
    mirror: "docs/sdd/research.md",
    label: "Investigación / Paso 0",
    optional: true,
  },
  {
    primary: "{featureDir}/spec.md",
    mirror: "docs/sdd/spec.md",
    label: "Spec",
  },
  {
    primary: "{featureDir}/architecture.md",
    mirror: "docs/sdd/architecture.md",
    label: "Arquitectura",
    optional: true,
  },
  {
    primary: "{featureDir}/use-cases.md",
    mirror: "docs/sdd/use-cases.md",
    label: "Casos de uso",
    optional: true,
  },
  {
    primary: "{featureDir}/user-stories.md",
    mirror: "docs/sdd/user-stories.md",
    label: "Historias de usuario",
    optional: true,
  },
  {
    primary: "{featureDir}/plan.md",
    mirror: "docs/sdd/blueprint.md",
    label: "Blueprint / Plan",
  },
  {
    primary: "{featureDir}/design-system.md",
    mirror: "docs/sdd/ux-ui-guide.md",
    label: "Design System",
    optional: true,
  },
  {
    primary: "{featureDir}/pantallas.md",
    mirror: "docs/sdd/pantallas.md",
    label: "Pantallas (UI MCP)",
    optional: true,
  },
  {
    primary: "{featureDir}/ui-project.json",
    mirror: "docs/sdd/ui-project.json",
    label: "UI project (MCP JSON)",
    optional: true,
  },
  {
    primary: "{featureDir}/contracts/api-contracts.md",
    mirror: "docs/sdd/api-contracts.md",
    label: "Contratos API",
    optional: true,
  },
  {
    primary: "{featureDir}/logic-flows.md",
    mirror: "docs/sdd/logic-flows.md",
    label: "Flujos lógicos",
    optional: true,
  },
  {
    primary: "{featureDir}/tasks.md",
    mirror: "docs/sdd/tasks.md",
    label: "Tasks",
  },
  {
    primary: "{featureDir}/infra.md",
    mirror: "docs/sdd/infra.md",
    label: "Infra",
    optional: true,
  },
  {
    primary: "{featureDir}/data-model.md",
    mirror: "docs/sdd/data-model.md",
    label: "Modelo de datos (MDD §3)",
    optional: true,
  },
  {
    primary: "{featureDir}/quickstart.md",
    mirror: "{featureDir}/quickstart.md",
    label: "Quickstart (smoke tests)",
    optional: true,
  },
  {
    primary: "docs/sdd/decisions/*.md",
    mirror: "docs/sdd/decisions/*.md",
    label: "ADRs",
    optional: true,
  },
];

/** Espejos docs/sdd/ exportables (sin wildcards ni quickstart duplicado). */
export const DOCUMENT_SDD_MIRROR_PATHS = DOCUMENT_PATH_MAP_STATIC.map((e) => e.mirror).filter(
  (mirror) => mirror.startsWith("docs/sdd/") && !mirror.includes("*"),
);

/** Artefactos del Workshop que no siguen el layout spec-kit estándar. */
export const WORKSHOP_SUPPLEMENT_ENTRIES: WorkshopSupplementEntry[] = [
  {
    label: "BRD",
    location: "The Forge (etapa) · contexto en `{featureDir}/research.md`",
    note: "Obligatorio en proyectos NEW antes del MDD; no siempre hay archivo BRD dedicado en el ZIP.",
  },
  {
    label: "AEM",
    location: "The Forge (`aemContent`)",
    note: "Análisis y Estudio de Mercado (Benchmark + Paso 0 + BRD); incluye dictamen de inversión digital. No siempre hay archivo dedicado en el ZIP.",
  },
  {
    label: "Handoff Spec",
    location: "`handoff-spec.md` (raíz, integración LEGACY)",
    note: "Contrato NEW ↔ LEGACY entre equipos; no es espejo `docs/sdd/`.",
  },
  {
    label: "Integración",
    location: "Panel Workshop + trazabilidad de etapa",
    note: "Coordinación entre flujos NEW y LEGACY en The Forge.",
  },
  {
    label: "Gobernanza IA",
    location: "`AGENTS.md`, `docs/agent-governance/**`, `IMPLEMENT.md`",
    note: "Rules, skills, commands y onboarding para agentes implementadores.",
  },
];

function formatPathMapLabel(entry: DocumentPathEntry): string {
  return entry.optional ? `${entry.label} (si existe)` : entry.label;
}

/** Resolve path map for a concrete feature directory (e.g. specs/001-my-feature). */
export function resolveDocumentPathMap(featureDir: string): DocumentPathEntry[] {
  return DOCUMENT_PATH_MAP_STATIC.map((entry) => ({
    ...entry,
    primary: entry.primary.replace(/\{featureDir\}/g, featureDir),
    mirror: entry.mirror.replace(/\{featureDir\}/g, featureDir),
  }));
}

/** Markdown table rows for handoff / governance docs. */
export function formatDocumentPathMapTable(featureDir: string): string {
  const rows = resolveDocumentPathMap(featureDir)
    .map(
      (e) => `| ${formatPathMapLabel(e)} | \`${e.primary}\` | \`${e.mirror}\` |`,
    )
    .join("\n");
  return `| Documento | Primario (spec-kit) | Espejo (gobernanza) |\n|-----------|---------------------|---------------------|\n${rows}`;
}

/** Static table (placeholder `{featureDir}`) for templates before feature slug is known. */
export function formatDocumentPathMapTableStatic(): string {
  const rows = DOCUMENT_PATH_MAP_STATIC.map(
    (e) => `| ${formatPathMapLabel(e)} | \`${e.primary}\` | \`${e.mirror}\` |`,
  ).join("\n");
  return `| Documento | Primario (spec-kit) | Espejo (gobernanza) |\n|-----------|---------------------|---------------------|\n${rows}`;
}

export function formatWorkshopSupplementTable(featureDir?: string): string {
  const featureRef = featureDir?.trim() || "specs/NNN-slug";
  const rows = WORKSHOP_SUPPLEMENT_ENTRIES.map((e) => {
    const location = e.location.replace(/\{featureDir\}/g, featureRef);
    return `| ${e.label} | ${location} | ${e.note} |`;
  }).join("\n");
  return `| Artefacto | Ubicación | Notas |\n|-----------|-------------|-------|\n${rows}`;
}

export function formatWorkshopSupplementSection(featureDir?: string): string {
  return (
    "### Artefactos Workshop (cuando aplican)\n\n" +
    "Estos pasos del flujo The Forge **no siempre** van como archivos spec-kit dedicados; consúltalos en el ZIP o en Workshop antes de implementar:\n\n" +
    formatWorkshopSupplementTable(featureDir)
  );
}

export interface NextTaskDocumentLayout {
  documentLayout: DocumentLayoutKind;
  featureDir: string;
  constitutionPath: string;
  tasksPath: string;
  specPath: string;
  planPath: string;
  governancePresent: boolean;
  implementReadmePath: string;
  implementHint?: string;
}

export function buildNextTaskDocumentLayout(
  featureDir: string,
  governancePresent: boolean,
): NextTaskDocumentLayout {
  return {
    documentLayout: "spec-kit-primary",
    featureDir,
    constitutionPath: ".specify/memory/constitution.md",
    tasksPath: `${featureDir}/tasks.md`,
    specPath: `${featureDir}/spec.md`,
    planPath: `${featureDir}/plan.md`,
    governancePresent,
    implementReadmePath: "IMPLEMENT.md",
  };
}

/** Respuesta de `GET /projects/:id/next-task` (API + MCP `get_next_implementation_task`). */
export interface ProjectNextTaskResponse extends NextTaskDocumentLayout {
  projectId: string;
  projectName: string;
  openCount: number;
  task: ParsedTaskItem | null;
  implementHint?: string;
}
