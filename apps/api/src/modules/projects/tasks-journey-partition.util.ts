/**
 * Partition Tasks plan by journey/process for phased redaction until US coverage.
 */

import type { DomainInventory, TasksGenerationPlan, TasksPlanItem } from "@theforge/shared-types";
import { stableJourneyUserStoryId } from "@theforge/shared-types";

export type JourneyPlanPartition = {
  journeyId: string;
  label: string;
  storyRefs: string[];
  items: TasksPlanItem[];
};

const JOURNEY_UPSTREAM_RE = /^journey:(.+)$/i;
const PROC_UPSTREAM_RE = /^(?:brd|process):(.+)$/i;

function journeyKeyFromItem(item: TasksPlanItem): string | null {
  for (const ref of item.upstreamRefs ?? []) {
    const j = ref.match(JOURNEY_UPSTREAM_RE);
    if (j?.[1]) return j[1];
    const p = ref.match(PROC_UPSTREAM_RE);
    if (p?.[1]) return p[1];
  }
  for (const sr of item.storyRefs ?? []) {
    if (sr.startsWith("US-JRN-")) return sr.replace(/^US-JRN-/, "proc-").toLowerCase();
  }
  return null;
}

/** Groups plan items by journey; unassigned items land in `_core`. */
export function partitionTasksPlanByJourney(
  plan: TasksGenerationPlan,
  inventory?: DomainInventory | null,
): JourneyPlanPartition[] {
  const buckets = new Map<string, JourneyPlanPartition>();

  const ensure = (journeyId: string, label: string, storyRefs: string[] = []): JourneyPlanPartition => {
    const existing = buckets.get(journeyId);
    if (existing) return existing;
    const partition: JourneyPlanPartition = { journeyId, label, storyRefs, items: [] };
    buckets.set(journeyId, partition);
    return partition;
  };

  for (const proc of inventory?.processes ?? []) {
    const usId = stableJourneyUserStoryId(proc.id);
    ensure(proc.id, proc.name, [usId]);
  }

  for (const item of plan.items) {
    const key = journeyKeyFromItem(item) ?? "_core";
    const label =
      inventory?.processes.find((p) => p.id === key)?.name ??
      (key === "_core" ? "Núcleo transversal" : key);
    const part = ensure(key, label);
    part.items.push(item);
  }

  const order = [...(inventory?.processes ?? []).map((p) => p.id), "_core"];
  return order
    .map((id) => buckets.get(id))
    .filter((p): p is JourneyPlanPartition => Boolean(p && p.items.length > 0));
}

/** Flattens journey partitions back into a single plan (preserves journey order). */
export function flattenJourneyPartitions(partitions: JourneyPlanPartition[]): TasksGenerationPlan {
  const items: TasksPlanItem[] = [];
  for (const part of partitions) items.push(...part.items);
  return { sections: [], items };
}
