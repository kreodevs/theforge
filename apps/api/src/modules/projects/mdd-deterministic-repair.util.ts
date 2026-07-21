/**
 * Reparaciones deterministas MDD (BRD pre-patch, inventario, SSOT) para convergencia post-cascada.
 */

import type { DomainInventory } from "@theforge/shared-types";
import { patchMddFromBrdTraceability } from "../engine/brd-mdd-pre-patch.util.js";
import { reconcileDomainInventoryIntoMdd } from "../engine/domain-inventory-reconciler.util.js";
import { reconcileMddSsotBeforeDeliveryGate } from "../engine/mdd-ssot-repair.util.js";

export type DeterministicMddRepairResult = {
  markdown: string;
  changed: boolean;
  notes: string[];
};

export function applyDeterministicMddRepairs(
  mddMarkdown: string,
  params: {
    brdMarkdown?: string | null;
    dbgaMarkdown?: string | null;
    inventory?: DomainInventory | null;
    specMarkdown?: string | null;
  },
): DeterministicMddRepairResult {
  const notes: string[] = [];
  let markdown = mddMarkdown;

  const brdPatch = patchMddFromBrdTraceability(markdown, params.brdMarkdown);
  if (brdPatch.injected.length > 0) {
    markdown = brdPatch.markdown;
    notes.push(...brdPatch.injected.map((x) => `BRD patch: ${x}`));
  }

  const inv = reconcileDomainInventoryIntoMdd(markdown, {
    brdMarkdown: params.brdMarkdown,
    dbgaMarkdown: params.dbgaMarkdown,
    inventory: params.inventory,
  });
  if (inv.section3Injected.length > 0 || inv.section4Injected.length > 0) {
    markdown = inv.markdown;
    notes.push(...inv.section3Injected, ...inv.section4Injected);
  }

  const ssot = reconcileMddSsotBeforeDeliveryGate(markdown, {
    brdMarkdown: params.brdMarkdown,
    dbgaMarkdown: params.dbgaMarkdown,
    specMarkdown: params.specMarkdown,
    inventory: params.inventory,
  });
  if (ssot.markdown !== markdown) {
    markdown = ssot.markdown;
    notes.push(
      ...ssot.section3Injected,
      ...ssot.uatInjected,
      ...ssot.section4Injected,
    );
  }

  return {
    markdown,
    changed: markdown.trim() !== mddMarkdown.trim(),
    notes,
  };
}
