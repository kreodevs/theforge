/**
 * Stable user-story IDs with separate CRUD vs journey namespaces.
 * Prevents US-001..N re-numbering when CrudMatrix rows are inserted or re-sorted.
 */

export const US_CRUD_PREFIX = "US-CRUD";
export const US_JRN_PREFIX = "US-JRN";

const US_ID_PATTERN = /^US-(?:CRUD|JRN)-[A-Z0-9_-]+$/;

/** Normalize entity/process token for stable ID suffix. */
export function normalizeUsIdToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^proc[-_]?/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

/** Stable CRUD user-story ID keyed by entity name (not matrix ordinal). */
export function stableCrudUserStoryId(entity: string): string {
  const token = normalizeUsIdToken(entity);
  return token ? `${US_CRUD_PREFIX}-${token}` : `${US_CRUD_PREFIX}-UNKNOWN`;
}

/** Stable journey user-story ID keyed by process inventory id. */
export function stableJourneyUserStoryId(processId: string): string {
  const token = normalizeUsIdToken(processId);
  return token ? `${US_JRN_PREFIX}-${token}` : `${US_JRN_PREFIX}-UNKNOWN`;
}

export function isStableUserStoryId(id: string): boolean {
  return US_ID_PATTERN.test(id.trim());
}

export function userStoryNamespace(id: string): "crud" | "journey" | "legacy" {
  const t = id.trim();
  if (t.startsWith(`${US_CRUD_PREFIX}-`)) return "crud";
  if (t.startsWith(`${US_JRN_PREFIX}-`)) return "journey";
  return "legacy";
}
