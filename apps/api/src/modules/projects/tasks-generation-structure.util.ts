/**
 * Validación estructural determinista de tasks.md (truncado, secciones, Frontend, API drift).
 */

import { parseTasksV2 } from "../engine/task-v2/tasks-parser-v2.js";
import {
  extractHttpEndpointsFromMarkdown,
  normalizeApiPath,
} from "../ui-mcp/api-contract-endpoints.util.js";

export type TasksStructuralReport = {
  ok: boolean;
  gaps: string[];
  yamlTaskIds: number;
  parsedTaskCount: number;
  frontendTaskCount: number;
  pantallaRoutes: number;
  truncated: boolean;
};

function countYamlTaskIds(markdown: string): number {
  const ids = markdown.match(/^id:\s*(T-\d+)/gm);
  if (!ids) return 0;
  return new Set(ids.map((s) => s.replace(/^id:\s*/i, "").trim())).size;
}

/** Documento cortado o front-matter sin cerrar. */
export function isTasksDocumentTruncated(markdown: string): boolean {
  const trimmed = (markdown ?? "").trim();
  if (trimmed.length < 48) return true;

  let fenceCount = 0;
  for (const line of trimmed.split("\n")) {
    if (line.trim() === "---") fenceCount += 1;
  }
  if (fenceCount % 2 !== 0) return true;

  const tail = trimmed.split("\n").filter((l) => l.trim()).slice(-3).join("\n");
  if (/^target_files:\s*$/m.test(tail)) return true;
  if (/^\s+-\s+apps\/backend\/src\/application\/?\s*$/m.test(tail)) return true;
  if (/^id:\s*T-\d+[\s\S]*^title:\s*[^\n]+[\s\S]*^target_files:\s*$/m.test(trimmed.slice(-800))) {
    return true;
  }

  return false;
}

function hasCanonicalSection(markdown: string, pattern: RegExp): boolean {
  return pattern.test(markdown);
}

function countFrontendTasks(markdown: string): number {
  let count = 0;
  for (const m of markdown.matchAll(/^section:\s*(.+)$/gim)) {
    if (/^frontend$/i.test((m[1] ?? "").trim())) count += 1;
  }
  if (count > 0) return count;
  if (hasCanonicalSection(markdown, /^##\s+Frontend tasks\b/im)) {
    const sectionBody = markdown.split(/^##\s+Frontend tasks\b/im)[1]?.split(/^##\s+/m)[0] ?? "";
    return countYamlTaskIds(sectionBody);
  }
  return 0;
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

function extractTaskApiPaths(tasksMarkdown: string): string[] {
  const paths: string[] = [];
  const re = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[^\s`,|]+)/gi;
  for (const m of tasksMarkdown.matchAll(re)) {
    paths.push(normalizeApiPath((m[2] ?? "").replace(/[,;]+$/g, "")));
  }
  return paths;
}

function findApiPathsDriftingFromContracts(tasksMarkdown: string, apiMarkdown: string): string[] {
  const contractPaths = new Set(
    extractHttpEndpointsFromMarkdown(apiMarkdown).map((e) => normalizeApiPath(e.path)),
  );
  if (contractPaths.size === 0) return [];

  const drift: string[] = [];
  for (const path of extractTaskApiPaths(tasksMarkdown)) {
    if (contractPaths.has(path)) continue;
    drift.push(path);
  }
  return [...new Set(drift)].slice(0, 10);
}

export function evaluateTasksStructure(params: {
  tasksMarkdown: string;
  uiScreensMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
}): TasksStructuralReport {
  const tasksMarkdown = (params.tasksMarkdown ?? "").trim();
  const gaps: string[] = [];
  const truncated = isTasksDocumentTruncated(tasksMarkdown);
  const yamlTaskIds = countYamlTaskIds(tasksMarkdown);
  const parsed = parseTasksV2(tasksMarkdown);
  const parsedTaskCount = parsed.tasks.length;
  const pantallaRoutes = extractPantallaRoutes(params.uiScreensMarkdown ?? "").length;
  const frontendTaskCount = countFrontendTasks(tasksMarkdown);

  if (truncated) {
    gaps.push("Tasks truncado: front-matter sin cerrar o documento cortado a mitad de tarea.");
  }

  if (!hasCanonicalSection(tasksMarkdown, /^##\s+Backend tasks\b/im)) {
    gaps.push("Falta sección canónica ## Backend tasks (no sustituir por ## Fase N).");
  }

  if (!hasCanonicalSection(tasksMarkdown, /^##\s+Infra(?:estructura)? tasks\b/im)) {
    gaps.push("Falta sección canónica ## Infra tasks o ## Infraestructura tasks.");
  }

  if (pantallaRoutes >= 3 && frontendTaskCount === 0) {
    gaps.push(
      `${pantallaRoutes} rutas en pantallas.md pero 0 tareas con section: Frontend — requerido 1 task Frontend por vista principal.`,
    );
  }

  if (yamlTaskIds >= 5 && parsedTaskCount < Math.ceil(yamlTaskIds * 0.65)) {
    gaps.push(
      `Parser v2: ${parsedTaskCount} tareas vs ${yamlTaskIds} bloques id: — un bloque YAML --- por tarea, sin concatenar.`,
    );
  }

  const apiMd = (params.apiContractsMarkdown ?? "").trim();
  if (apiMd.length > 80) {
    const drift = findApiPathsDriftingFromContracts(tasksMarkdown, apiMd);
    if (drift.length >= 4) {
      gaps.push(
        `Tasks cita rutas API ausentes en api-contracts (≥4): ${drift.slice(0, 4).join(", ")}…`,
      );
    }
  }

  const parseErrors = parsed.errors.filter((e) => e.severity === "error");
  if (parseErrors.length > 0) {
    gaps.push(`Parser tasks v2: ${parseErrors.length} error(es) de formato YAML.`);
  }

  return {
    ok: gaps.length === 0,
    gaps,
    yamlTaskIds,
    parsedTaskCount,
    frontendTaskCount,
    pantallaRoutes,
    truncated,
  };
}
