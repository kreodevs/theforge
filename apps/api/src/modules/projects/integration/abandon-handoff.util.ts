import type { IntegrationHandoffItem } from "@theforge/shared-types";

export type StageOrdinalRow = {
  id: string;
  ordinal: number;
  workflowStatus: string;
};

/** Item ids frozen on the stage handoff snapshot at promote/import time. */
export function handoffItemIdsFromStageSnapshot(handoffSnapshot: unknown): string[] {
  const snap = handoffSnapshot as { items?: { id?: string }[] } | null;
  if (!Array.isArray(snap?.items)) return [];
  return snap.items.map((i) => i?.id?.trim()).filter((id): id is string => !!id);
}

/** Clears legacyStageId on NEW handoff items tied to an abandoned legacy stage. */
export function releaseHandoffItemsForAbandonedStage(
  items: IntegrationHandoffItem[],
  stageId: string,
  itemIdsFromSnapshot: string[],
  rejectReleasedItems: boolean,
): { items: IntegrationHandoffItem[]; releasedIds: string[] } {
  const idSet = new Set(itemIdsFromSnapshot);
  const releasedIds: string[] = [];

  const next = items.map((item) => {
    const tiedToStage = item.legacyStageId === stageId || idSet.has(item.id);
    if (!tiedToStage) return item;

    releasedIds.push(item.id);
    const { legacyStageId: _drop, ...rest } = item;
    let status = item.status;
    if (rejectReleasedItems) {
      status = "rejected";
    } else if (status === "accepted" || status === "implemented") {
      status = "sent";
    }
    return integrationHandoffItemParse(rest, status);
  });

  return { items: next, releasedIds: [...new Set(releasedIds)] };
}

function integrationHandoffItemParse(
  rest: Omit<IntegrationHandoffItem, "legacyStageId">,
  status: IntegrationHandoffItem["status"],
): IntegrationHandoffItem {
  return { ...rest, status };
}

/** When abandoning the ACTIVE stage, activate the best remaining non-archived stage. */
export function pickActivateStageIdAfterAbandon(
  stages: StageOrdinalRow[],
  abandonedStageId: string,
  explicitActivateStageId?: string,
): string | null {
  if (explicitActivateStageId?.trim()) {
    const explicit = stages.find((s) => s.id === explicitActivateStageId.trim());
    if (explicit && explicit.workflowStatus !== "ARCHIVED" && explicit.id !== abandonedStageId) {
      return explicit.id;
    }
  }

  const candidates = stages
    .filter((s) => s.id !== abandonedStageId && s.workflowStatus !== "ARCHIVED")
    .sort((a, b) => a.ordinal - b.ordinal);

  if (!candidates.length) return null;

  const baseline = candidates.find((s) => s.ordinal === 1);
  if (baseline) return baseline.id;

  return candidates[candidates.length - 1]!.id;
}
