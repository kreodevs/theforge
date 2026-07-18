/**
 * Prerrequisitos UI para generar Tasks (alineado con tasks-preflight strict).
 */

export type TasksPrerequisitesResult = {
  ready: boolean;
  missing: string[];
  hint: string;
};

export function evaluateTasksGenerationPrerequisites(params: {
  mddMarkdown: string;
  blueprintMarkdown?: string | null;
  specMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
  uiScreensMarkdown?: string | null;
  hasUxTeam?: boolean;
  legacyBaseline?: boolean;
}): TasksPrerequisitesResult {
  const missing: string[] = [];
  const mdd = (params.mddMarkdown ?? "").trim();
  const blueprint = (params.blueprintMarkdown ?? "").trim();
  const spec = (params.specMarkdown ?? "").trim();
  const api = (params.apiContractsMarkdown ?? "").trim();
  const pantallas = (params.uiScreensMarkdown ?? "").trim();
  const legacy = params.legacyBaseline === true;

  if (mdd.length < 80) missing.push("MDD");
  if (blueprint.length < 80) missing.push("Blueprint");

  if (!legacy) {
    if (spec.length < 80) missing.push("Spec");
    if (/##\s*4[\.\s]/i.test(mdd) && api.length < 80) missing.push("Contratos API");
    if (params.hasUxTeam === true && pantallas.length < 80) missing.push("Pantallas");
  }

  const hint =
    missing.length === 0
      ? "Desglose ejecutable desde MDD, Spec, Blueprint, API y pantallas."
      : `Genera antes: ${missing.join(", ")}.`;

  return { ready: missing.length === 0, missing, hint };
}
