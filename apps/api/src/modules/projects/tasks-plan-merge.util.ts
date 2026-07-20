/**
 * Fusiona el plan del Tasks Planner (LLM) con el plan heurístico determinista.
 * El LLM suele devolver ~10–20 ítems aunque el MVP requiera decenas; el redactor
 * está acotado al plan JSON, así que el piso heurístico garantiza cobertura API,
 * pantallas, entidades, infra y QA antes de redactar.
 */

import type { TasksGenerationPlan, TasksPlanItem } from "@theforge/shared-types";

function planItemCoverageKey(item: TasksPlanItem): string {
  for (const ref of item.upstreamRefs) {
    if (
      ref.startsWith("api-contracts:") ||
      ref.startsWith("pantallas:") ||
      ref.startsWith("mdd:entity:") ||
      ref.startsWith("mdd:§7:") ||
      ref.startsWith("blueprint:")
    ) {
      return ref;
    }
  }
  if (/^spec:/.test(item.upstreamRefs[0] ?? "")) {
    return item.upstreamRefs[0]!;
  }
  return `${item.layer}:${item.title.trim().toLowerCase().slice(0, 80)}`;
}

/** Renumera T-001…T-N y remapea dependsOn al nuevo id cuando existía en el mapa. */
export function renumberTasksPlanItems(items: TasksPlanItem[]): TasksPlanItem[] {
  const idMap = new Map<string, string>();
  const renumbered = items.map((item, idx) => {
    const newId = `T-${String(idx + 1).padStart(3, "0")}`;
    idMap.set(item.id, newId);
    return { ...item, id: newId };
  });
  const newIds = new Set(renumbered.map((item) => item.id));
  return renumbered.map((item) => ({
    ...item,
    dependsOn: item.dependsOn
      .map((dep) => idMap.get(dep) ?? dep)
      .filter((dep) => newIds.has(dep)),
  }));
}

/**
 * Une primary (LLM) + floor (heurístico). Los ítems del piso solo se añaden si no
 * hay otro ítem con la misma clave de cobertura upstream.
 */
export function mergeTasksPlanWithCoverageFloor(
  primary: TasksGenerationPlan,
  floor: TasksGenerationPlan,
): TasksGenerationPlan {
  const seen = new Set<string>();
  const merged: TasksPlanItem[] = [];

  for (const item of primary.items) {
    const key = planItemCoverageKey(item);
    seen.add(key);
    merged.push({ ...item });
  }

  for (const item of floor.items) {
    const key = planItemCoverageKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...item });
  }

  const sections = new Set<string>([
    ...(primary.sections ?? []),
    ...(floor.sections ?? []),
    ...merged.map((i) => i.layer),
  ]);

  return {
    sections: [...sections],
    items: renumberTasksPlanItems(merged),
  };
}
