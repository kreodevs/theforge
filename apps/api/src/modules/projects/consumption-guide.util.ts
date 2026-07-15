import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTheforgeDocConsumptionGuide } from "@theforge/shared-types";
const MONOREPO_ROOT = join(__dirname, "../../../../../..");

/**
 * Guía canónica para handoff (layout spec-kit dual).
 * @param featureDir p.ej. specs/001-my-feature — si se omite, usa placeholder NNN-slug.
 */
export function loadConsumptionGuideMarkdown(featureDir?: string): string {
  if (featureDir?.trim()) {
    return buildTheforgeDocConsumptionGuide(featureDir.trim());
  }
  try {
    const legacy = readFileSync(
      join(MONOREPO_ROOT, "docs/THEFORGE-DOC-CONSUMPTION-GUIDE.md"),
      "utf-8",
    ).trim();
    if (legacy.includes("layout spec-kit") || legacy.includes("specs/NNN-slug")) {
      return legacy;
    }
  } catch {
    // fallback generado
  }
  return buildTheforgeDocConsumptionGuide();
}
