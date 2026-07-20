import { ComplexityLevel, type Project } from "@theforge/database";
import { pickPrimaryStage, type StageWithEstimation } from "./stage-helpers.js";

export function pickMddFromStages(stages: StageWithEstimation[]): string {
  return pickPrimaryStage(stages)?.mddContent ?? "";
}

/** Insumo principal para prompts de entregables: MDD o, en LOW/MEDIUM sin MDD, DBGA + resumen + spec. */
export function buildConstitutionMarkdown(
  project: Pick<
    Project,
    "complexity" | "dbgaContent" | "phase0SummaryContent" | "specContent"
  > & { stages: StageWithEstimation[] },
): string {
  const mdd = pickMddFromStages(project.stages).trim();
  if (mdd.length > 0) return mdd;
  const cx = project.complexity ?? ComplexityLevel.HIGH;
  if (cx === ComplexityLevel.LOW || cx === ComplexityLevel.MEDIUM) {
    const parts = [
      (project.dbgaContent ?? "").trim(),
      (project.phase0SummaryContent ?? "").trim(),
      (project.specContent ?? "").trim(),
    ].filter((p) => p.length > 0);
    return parts.join("\n\n---\n\n");
  }
  return "";
}
