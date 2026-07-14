/**
 * Persist and resolve Stage.domainInventory (PLAN-CASCADE-90 P0).
 */

import {
  domainInventorySchema,
  type DomainInventory,
} from "@theforge/shared-types";
import { buildDomainInventory } from "./domain-inventory.util.js";
import { extractEntities } from "./conformance.service.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

export function parsePersistedDomainInventory(raw: unknown): DomainInventory | null {
  if (raw == null) return null;
  const parsed = domainInventorySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function resolveDomainInventory(input: {
  persisted?: unknown;
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown?: string | null;
}): DomainInventory {
  // Prefer live rebuild from BRD/DBGA when available; persisted is fallback / cache.
  if (input.brdMarkdown?.trim() || input.dbgaMarkdown?.trim() || input.mddMarkdown?.trim()) {
    const mddEntities = extractEntities(
      extractSectionByNumber(input.mddMarkdown ?? "", 3) || input.mddMarkdown || "",
    );
    const live = buildDomainInventory({
      brdMarkdown: input.brdMarkdown,
      dbgaMarkdown: input.dbgaMarkdown,
      mddMarkdown: input.mddMarkdown,
      mddEntities,
    });
    if (live.capabilities.length > 0 || live.suggestedEntities.length > 0) return live;
  }
  const fromDb = parsePersistedDomainInventory(input.persisted);
  if (fromDb) return fromDb;
  return buildDomainInventory({
    brdMarkdown: input.brdMarkdown,
    dbgaMarkdown: input.dbgaMarkdown,
    mddMarkdown: input.mddMarkdown,
  });
}

/** Prefer persisted BRD capabilities when rebuilding after MDD edit. */
export function rebuildDomainInventoryPreferringBrd(input: {
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown?: string | null;
}): DomainInventory {
  const mddEntities = extractEntities(
    extractSectionByNumber(input.mddMarkdown ?? "", 3) || input.mddMarkdown || "",
  );
  return buildDomainInventory({
    brdMarkdown: input.brdMarkdown,
    dbgaMarkdown: input.dbgaMarkdown,
    mddMarkdown: input.mddMarkdown,
    mddEntities,
  });
}
