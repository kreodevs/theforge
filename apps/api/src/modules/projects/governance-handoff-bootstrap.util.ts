import {
  buildSddImplementReadme,
  buildTheforgeDocConsumptionGuide,
  DOCUMENT_SDD_MIRROR_PATHS,
  GOVERNANCE_THEFORGE_DOC_CONSUMPTION_GUIDE,
  ROOT_THEFORGE_DOC_CONSUMPTION_GUIDE,
  type AgentGovernanceScaffold,
} from "@theforge/shared-types";

/** Añade IMPLEMENT.md y guía de consumo unificada al scaffold de gobernanza. */
export function enrichGovernanceScaffoldForHandoff(
  scaffold: AgentGovernanceScaffold,
  featureDir: string,
): AgentGovernanceScaffold {
  const fileMap = new Map(scaffold.files.map((f) => [f.path, f.content] as const));
  const guide = buildTheforgeDocConsumptionGuide(featureDir);
  fileMap.set("IMPLEMENT.md", buildSddImplementReadme(featureDir));
  fileMap.set(GOVERNANCE_THEFORGE_DOC_CONSUMPTION_GUIDE, guide);
  fileMap.set(ROOT_THEFORGE_DOC_CONSUMPTION_GUIDE, guide);
  const files = [...fileMap.entries()]
    .map(([path, content]) => ({ path, content }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const paths = files.map((f) => f.path);
  return {
    manifest: {
      ...scaffold.manifest,
      files: paths,
    },
    files,
  };
}

export { DOCUMENT_SDD_MIRROR_PATHS };
