/**
 * Checklist determinista endpoint↔task, ruta↔pantalla y secciones Testing/Deploy.
 * Alimenta gates estructurales, auditor LLM y ciclos de repair.
 */

import { parseTasksV2 } from "../engine/task-v2/tasks-parser-v2.js";
import {
  extractHttpEndpointsFromMarkdown,
  normalizeApiPath,
  type HttpEndpointRef,
} from "../ui-mcp/api-contract-endpoints.util.js";
import { extractV1InScopePantallaRoutes } from "../ui-mcp/ui-screens-v1-scope.util.js";

export type TasksCoverageChecklist = {
  contractEndpoints: HttpEndpointRef[];
  missingEndpoints: string[];
  driftEndpoints: string[];
  pantallaRoutes: string[];
  missingRoutes: string[];
  requiresTestingSection: boolean;
  requiresDeploySection: boolean;
  hasTestingSection: boolean;
  hasDeploySection: boolean;
  testingTaskCount: number;
  deployTaskCount: number;
};

function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizeApiPath(path)}`;
}

/** Rutas de la tabla pantallas.md (`| /ruta | …`). */
export function extractPantallaRoutes(uiScreensMarkdown: string): string[] {
  const routes = new Set<string>();
  for (const line of (uiScreensMarkdown ?? "").split("\n")) {
    const m = line.match(/^\|\s*(\/[a-zA-Z0-9_\-/{}:.]+)/);
    if (m?.[1]) {
      const route = m[1].replace(/\/+$/, "") || m[1];
      routes.add(route);
    }
  }
  return [...routes];
}

/** ¿La tarea markdown cubre method+path (ventana local o coincidencia directa)? */
export function endpointCoveredInTasks(tasksMarkdown: string, method: string, path: string): boolean {
  const norm = normalizeApiPath(path).toLowerCase();
  const md = (tasksMarkdown ?? "").toLowerCase();
  const methodLower = method.toLowerCase();
  const direct = `${methodLower} ${norm}`;
  if (md.includes(direct)) return true;

  let from = 0;
  while (from < md.length) {
    const idx = md.indexOf(norm, from);
    if (idx < 0) break;
    const window = md.slice(Math.max(0, idx - 160), idx + norm.length + 160);
    if (window.includes(methodLower)) return true;
    from = idx + norm.length;
  }
  return false;
}

/** ¿Alguna tarea Frontend menciona la ruta? */
export function pantallaRouteCoveredInTasks(tasksMarkdown: string, route: string): boolean {
  const norm = route.replace(/\/+$/, "") || route;
  const md = (tasksMarkdown ?? "").toLowerCase();
  const routeLower = norm.toLowerCase();
  if (!md.includes(routeLower)) return false;

  const parsed = parseTasksV2(tasksMarkdown);
  const frontendTasks = parsed.tasks.filter((t) => /^frontend$/i.test(t.section?.trim() ?? ""));
  if (frontendTasks.length === 0) return md.includes(routeLower);

  return frontendTasks.some((t) => {
    const blob = `${t.title} ${t.description} ${t.rawMarkdown}`.toLowerCase();
    return blob.includes(routeLower);
  });
}

function extractTaskApiPaths(tasksMarkdown: string): string[] {
  const paths: string[] = [];
  const re = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[^\s`,|]+)/gi;
  for (const m of tasksMarkdown.matchAll(re)) {
    paths.push(normalizeApiPath((m[2] ?? "").replace(/[,;]+$/g, "")));
  }
  return paths;
}

function countSectionTasks(tasksMarkdown: string, sectionPattern: RegExp): number {
  let count = 0;
  for (const m of tasksMarkdown.matchAll(/^section:\s*(.+)$/gim)) {
    if (sectionPattern.test((m[1] ?? "").trim())) count += 1;
  }
  if (count > 0) return count;

  const sectionHeader =
    sectionPattern.source.includes("Testing")
      ? /^##\s+Testing tasks\b/im
      : /^##\s+Deploy tasks\b/im;
  if (sectionHeader.test(tasksMarkdown)) {
    const body = tasksMarkdown.split(sectionHeader)[1]?.split(/^##\s+/m)[0] ?? "";
    return (body.match(/^id:\s*T-\d+/gm) ?? []).length;
  }
  return 0;
}

function mddRequiresTestingDeploy(mddMarkdown: string, infraMarkdown?: string | null): {
  testing: boolean;
  deploy: boolean;
} {
  const mdd = (mddMarkdown ?? "").trim();
  const infra = (infraMarkdown ?? "").trim();
  const hasInfraSection = /##\s*7[\.\s]/i.test(mdd) || infra.length > 80;
  return {
    testing: mdd.length > 200,
    deploy: hasInfraSection,
  };
}

export function buildTasksCoverageChecklist(params: {
  tasksMarkdown: string;
  apiContractsMarkdown?: string | null;
  uiScreensMarkdown?: string | null;
  mddMarkdown?: string | null;
  infraMarkdown?: string | null;
}): TasksCoverageChecklist {
  const tasksMarkdown = (params.tasksMarkdown ?? "").trim();
  const apiMd = (params.apiContractsMarkdown ?? "").trim();
  const uiMd = (params.uiScreensMarkdown ?? "").trim();

  const contractEndpoints = apiMd.length > 80 ? extractHttpEndpointsFromMarkdown(apiMd) : [];
  const missingEndpoints: string[] = [];
  for (const ep of contractEndpoints) {
    if (!endpointCoveredInTasks(tasksMarkdown, ep.method, ep.path)) {
      missingEndpoints.push(endpointKey(ep.method, ep.path));
    }
  }

  const contractPathSet = new Set(contractEndpoints.map((e) => normalizeApiPath(e.path)));
  const driftEndpoints: string[] = [];
  if (contractPathSet.size > 0) {
    for (const path of extractTaskApiPaths(tasksMarkdown)) {
      if (!contractPathSet.has(path)) driftEndpoints.push(path);
    }
  }

  const pantallaRoutes =
    uiMd.length > 0 ? extractV1InScopePantallaRoutes(uiMd) : extractPantallaRoutes(uiMd);
  const missingRoutes: string[] = [];
  for (const route of pantallaRoutes) {
    if (!pantallaRouteCoveredInTasks(tasksMarkdown, route)) {
      missingRoutes.push(route);
    }
  }

  const req = mddRequiresTestingDeploy(params.mddMarkdown ?? "", params.infraMarkdown);
  const hasTestingSection = /^##\s+Testing tasks\b/im.test(tasksMarkdown);
  const hasDeploySection = /^##\s+Deploy tasks\b/im.test(tasksMarkdown);
  const testingTaskCount = countSectionTasks(tasksMarkdown, /^testing$/i);
  const deployTaskCount = countSectionTasks(tasksMarkdown, /^deploy$/i);

  return {
    contractEndpoints,
    missingEndpoints,
    driftEndpoints: [...new Set(driftEndpoints)],
    pantallaRoutes,
    missingRoutes,
    requiresTestingSection: req.testing,
    requiresDeploySection: req.deploy,
    hasTestingSection,
    hasDeploySection,
    testingTaskCount,
    deployTaskCount,
  };
}

export function formatTasksCoverageChecklistGaps(checklist: TasksCoverageChecklist): string[] {
  const gaps: string[] = [];

  if (checklist.missingEndpoints.length > 0) {
    gaps.push(
      `Endpoints sin task Backend (${checklist.missingEndpoints.length}): ${checklist.missingEndpoints.slice(0, 8).join(", ")}${checklist.missingEndpoints.length > 8 ? "…" : ""}`,
    );
  }
  if (checklist.driftEndpoints.length > 0) {
    gaps.push(
      `Rutas API en Tasks ausentes en api-contracts (${checklist.driftEndpoints.length}): ${checklist.driftEndpoints.slice(0, 6).join(", ")}${checklist.driftEndpoints.length > 6 ? "…" : ""}`,
    );
  }
  if (checklist.missingRoutes.length > 0) {
    gaps.push(
      `Pantallas sin task Frontend (${checklist.missingRoutes.length}): ${checklist.missingRoutes.slice(0, 8).join(", ")}${checklist.missingRoutes.length > 8 ? "…" : ""}`,
    );
  }
  if (checklist.requiresTestingSection && !checklist.hasTestingSection) {
    gaps.push("Falta sección canónica ## Testing tasks.");
  }
  if (checklist.requiresTestingSection && checklist.hasTestingSection && checklist.testingTaskCount === 0) {
    gaps.push("## Testing tasks existe pero no hay tareas con section: Testing.");
  }
  if (checklist.requiresDeploySection && !checklist.hasDeploySection) {
    gaps.push("Falta sección canónica ## Deploy tasks.");
  }
  if (checklist.requiresDeploySection && checklist.hasDeploySection && checklist.deployTaskCount === 0) {
    gaps.push("## Deploy tasks existe pero no hay tareas con section: Deploy.");
  }

  return gaps;
}

/** Resumen JSON compacto para auditor/repair LLM. */
export function serializeTasksCoverageChecklist(checklist: TasksCoverageChecklist): string {
  return JSON.stringify(
    {
      missingEndpoints: checklist.missingEndpoints.slice(0, 40),
      driftEndpoints: checklist.driftEndpoints.slice(0, 20),
      missingRoutes: checklist.missingRoutes.slice(0, 40),
      testing: {
        required: checklist.requiresTestingSection,
        hasSection: checklist.hasTestingSection,
        taskCount: checklist.testingTaskCount,
      },
      deploy: {
        required: checklist.requiresDeploySection,
        hasSection: checklist.hasDeploySection,
        taskCount: checklist.deployTaskCount,
      },
    },
    null,
    2,
  );
}
