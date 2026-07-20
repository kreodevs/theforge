/**
 * Cross-artifact bundle versioning for atomic regeneration (US + pantallas + API + tasks).
 */

import { z } from "zod";

export const DELIVERABLE_BUNDLE_ARTIFACT_KEYS = [
  "userStoriesContent",
  "uiScreensContent",
  "apiContractsContent",
  "tasksContent",
] as const;

export type DeliverableBundleArtifactKey = (typeof DELIVERABLE_BUNDLE_ARTIFACT_KEYS)[number];

export const deliverableBundleMetaSchema = z.object({
  bundleVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  artifacts: z.array(z.enum(DELIVERABLE_BUNDLE_ARTIFACT_KEYS)).default([]),
});

export type DeliverableBundleMeta = z.infer<typeof deliverableBundleMetaSchema>;

/** ISO timestamp + short hash suffix for human-readable bundle versions. */
export function buildDeliverableBundleVersion(now: Date = new Date()): string {
  const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const suffix = now.getTime().toString(36).slice(-4);
  return `${iso}#${suffix}`;
}

export function readDeliverableBundleMeta(raw: unknown): DeliverableBundleMeta | null {
  const parsed = deliverableBundleMetaSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
