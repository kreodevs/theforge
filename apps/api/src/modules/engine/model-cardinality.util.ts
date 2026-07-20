/**
 * Model cardinality alignment: MDD §3 entities = inventory = Prisma tasks (T-002 pattern).
 */

import { extractEntities } from "./conformance.service.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";
import { parseTasksV2 } from "./task-v2/tasks-parser-v2.js";
import type { DomainInventory } from "@theforge/shared-types";

export type ModelCardinalityReport = {
  mddEntityCount: number;
  inventoryEntityCount: number;
  taskEntityCount: number;
  missingInTasks: string[];
  missingInMdd: string[];
  aligned: boolean;
};

function normalizeEntity(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_");
}

/** Extracts domain entities referenced in tasks (entity field or §3 refs). */
export function extractTaskDomainEntities(tasksMarkdown: string): Set<string> {
  const entities = new Set<string>();
  const parsed = parseTasksV2(tasksMarkdown);
  for (const task of parsed.tasks) {
    if (task.entity?.trim()) entities.add(normalizeEntity(task.entity));
    for (const ref of task.mddRef ? [task.mddRef] : []) {
      const m = ref.match(/§3\s+([a-z0-9_]+)/i);
      if (m?.[1]) entities.add(normalizeEntity(m[1]));
    }
  }
  for (const m of tasksMarkdown.matchAll(/Modelo y persistencia\s+([a-z0-9_]+)/gi)) {
    if (m[1]) entities.add(normalizeEntity(m[1]));
  }
  return entities;
}

export function checkModelCardinalityAlignment(params: {
  mddMarkdown: string;
  inventory?: DomainInventory | null;
  tasksMarkdown?: string | null;
}): ModelCardinalityReport {
  const section3 = extractSectionByNumber(params.mddMarkdown ?? "", 3) || params.mddMarkdown || "";
  const mddEntities = [...extractEntities(section3)].map(normalizeEntity);
  const mddSet = new Set(mddEntities);

  const inventoryEntities = [
    ...(params.inventory?.suggestedEntities ?? []),
    ...(params.inventory?.crudMatrix ?? []).map((r) => r.entity),
  ].map(normalizeEntity);
  const inventorySet = new Set(inventoryEntities);

  const taskSet = params.tasksMarkdown?.trim()
    ? extractTaskDomainEntities(params.tasksMarkdown)
    : new Set<string>();

  const unionDomain = new Set([...mddSet, ...inventorySet]);
  const missingInTasks = [...unionDomain].filter((e) => !taskSet.has(e));
  const missingInMdd = [...inventorySet].filter((e) => !mddSet.has(e));

  return {
    mddEntityCount: mddSet.size,
    inventoryEntityCount: inventorySet.size,
    taskEntityCount: taskSet.size,
    missingInTasks,
    missingInMdd,
    aligned: missingInTasks.length === 0 && missingInMdd.length === 0,
  };
}

export function formatModelCardinalityGaps(report: ModelCardinalityReport): string[] {
  const gaps: string[] = [];
  if (report.missingInTasks.length > 0) {
    gaps.push(
      `Entidades sin task T-002/§3 (${report.missingInTasks.length}): ${report.missingInTasks.slice(0, 10).join(", ")}${report.missingInTasks.length > 10 ? "…" : ""}`,
    );
  }
  if (report.missingInMdd.length > 0) {
    gaps.push(
      `Entidades inventario ausentes en MDD §3 (${report.missingInMdd.length}): ${report.missingInMdd.slice(0, 10).join(", ")}${report.missingInMdd.length > 10 ? "…" : ""}`,
    );
  }
  if (report.mddEntityCount !== report.inventoryEntityCount && report.inventoryEntityCount > 0) {
    gaps.push(
      `Cardinalidad modelo: MDD §3=${report.mddEntityCount} vs inventario=${report.inventoryEntityCount}`,
    );
  }
  return gaps;
}
