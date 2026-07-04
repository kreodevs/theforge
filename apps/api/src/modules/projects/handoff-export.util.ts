import { createHash } from "node:crypto";
import type { Project, Stage } from "@theforge/database";
import {
  appendProjectDeliverablesToScaffold,
  getRequiredAgentGovernancePaths,
  parseAgentGovernanceResponse,
  reconcileAgentGovernanceScaffold,
  serializeAgentGovernanceScaffold,
  type ProjectDeliverableExportInput,
} from "../ai/utils/agent-governance.util.js";
import {
  suggestAgentGovernanceArtifacts,
  type SuggestAgentGovernanceInput,
} from "../ai/utils/suggest-agent-governance-artifacts.js";
import { resolveStageDeliverables } from "./stage-deliverables.util.js";
import {
  AGENT_GOVERNANCE_TEMPLATE_VERSION,
  buildBranchPolicyExportFile,
  buildSpecKitBundleFiles,
  GOVERNANCE_DOCS_PREFIX,
  parseAgentGovernanceScaffold,
  resolveDocumentPathMap,
  specKitFeatureDir,
  type AgentGovernanceScaffold,
  type ComplexityLevel,
  type DocumentPathEntry,
  type SddAgentGovernanceAnalyzeSlice,
  type SpecKitBundleFile,
  type TheforgeProjectJson,
} from "@theforge/shared-types";
import { pickPrimaryStage } from "./stage-helpers.js";

type ProjectWithStages = Project & { stages: Stage[] };

const SDD_MIRROR_PATHS = [
  "docs/sdd/mdd.md",
  "docs/sdd/spec.md",
  "docs/sdd/blueprint.md",
  "docs/sdd/tasks.md",
] as const;

export interface UnifiedHandoff {
  featureDir: string;
  projectName: string;
  specKitFiles: SpecKitBundleFile[];
  agentGovernance: AgentGovernanceScaffold | null;
  layout: "spec-kit-primary";
  pathMap: DocumentPathEntry[];
  governancePresent: boolean;
  /** Set when reconcile changed serialized governance (caller may persist). */
  serializedGovernance?: string;
  governancePersisted?: boolean;
}

export interface HandoffFileWithHash {
  path: string;
  content: string;
  size: number;
  sha256: string;
}

export interface HermesHandoffPayload {
  format: "spec-kit-compatible";
  featureDir: string;
  layout: "spec-kit-primary";
  implementReadme: string;
  governancePresent: boolean;
  pathMap: DocumentPathEntry[];
  files: HandoffFileWithHash[];
  governanceFiles: HandoffFileWithHash[];
  cliFallback: string;
}

/** MDD or fallback for LOW/MEDIUM without full MDD. */
export function projectConstitutionMarkdown(project: ProjectWithStages): string {
  const stage = pickPrimaryStage(project.stages);
  const mdd = (stage?.mddContent ?? "").trim();
  if (mdd.length > 0) return mdd;
  const cx = project.complexity ?? "HIGH";
  if (cx === "LOW" || cx === "MEDIUM") {
    const parts = [
      (project.dbgaContent ?? "").trim(),
      (project.phase0SummaryContent ?? "").trim(),
      (project.specContent ?? "").trim(),
    ].filter((p) => p.length > 0);
    return parts.join("\n\n---\n\n");
  }
  return "";
}

/** Deliverables for SDD mirrors / handoff ZIP (respects stage snapshot in analyze mode). */
export function buildProjectDeliverableExportInput(
  project: ProjectWithStages,
  stage: Stage | null | undefined,
): ProjectDeliverableExportInput {
  const deliverables = stage
    ? resolveStageDeliverables(project, stage, "analyze").deliverables
    : project;
  const mdd = projectConstitutionMarkdown(project);
  return {
    mddMarkdown: mdd,
    blueprintMarkdown: deliverables.blueprintContent ?? project.blueprintContent,
    specMarkdown: deliverables.specContent ?? project.specContent,
    architectureMarkdown: deliverables.architectureContent ?? project.architectureContent,
    tasksMarkdown: deliverables.tasksContent ?? project.tasksContent,
    useCasesMarkdown: deliverables.useCasesContent ?? project.useCasesContent,
    userStoriesMarkdown: deliverables.userStoriesContent ?? project.userStoriesContent,
    apiContractsMarkdown: deliverables.apiContractsContent ?? project.apiContractsContent,
    logicFlowsMarkdown: deliverables.logicFlowsContent ?? project.logicFlowsContent,
    uxUiGuideMarkdown: deliverables.uxUiGuideContent ?? project.uxUiGuideContent,
    uiScreensMarkdown: deliverables.uiScreensContent ?? project.uiScreensContent,
    infraMarkdown: deliverables.infraContent ?? project.infraContent,
  };
}

const SDD_MIRROR_PATHS_FOR_SPEC_KIT: Array<{
  key: keyof ProjectDeliverableExportInput;
  path: string;
}> = [
  { key: "mddMarkdown", path: "docs/sdd/mdd.md" },
  { key: "blueprintMarkdown", path: "docs/sdd/blueprint.md" },
  { key: "specMarkdown", path: "docs/sdd/spec.md" },
  { key: "architectureMarkdown", path: "docs/sdd/architecture.md" },
  { key: "tasksMarkdown", path: "docs/sdd/tasks.md" },
  { key: "useCasesMarkdown", path: "docs/sdd/use-cases.md" },
  { key: "userStoriesMarkdown", path: "docs/sdd/user-stories.md" },
  { key: "apiContractsMarkdown", path: "docs/sdd/api-contracts.md" },
  { key: "logicFlowsMarkdown", path: "docs/sdd/logic-flows.md" },
  { key: "uxUiGuideMarkdown", path: "docs/sdd/ux-ui-guide.md" },
  { key: "uiScreensMarkdown", path: "docs/sdd/pantallas.md" },
  { key: "infraMarkdown", path: "docs/sdd/infra.md" },
];

/**
 * Adds docs/sdd mirrors, openspec/BRANCH-POLICY and extra files to spec-kit bundle for ZIP export.
 * Ensures handoff is complete even when agent governance was not pre-generated.
 */
export function enrichSpecKitFilesForHandoff(
  specKitFiles: SpecKitBundleFile[],
  deliverables: ProjectDeliverableExportInput,
  extraFiles: SpecKitBundleFile[] = [],
): SpecKitBundleFile[] {
  const map = new Map<string, string>();
  for (const file of specKitFiles) map.set(file.path, file.content);
  for (const file of extraFiles) map.set(file.path, file.content);

  for (const { key, path } of SDD_MIRROR_PATHS_FOR_SPEC_KIT) {
    const content = deliverables[key]?.trim();
    if (content) map.set(path, content);
  }

  const branchPolicy = buildBranchPolicyExportFile();
  map.set(branchPolicy.path, branchPolicy.content);

  if (!map.has("docs/sdd/PROGRESO.md") && deliverables.tasksMarkdown?.trim()) {
    map.set(
      "docs/sdd/PROGRESO.md",
      `# Progreso de implementación\n\nChecklist derivado de **Tasks**. Marca \`[x]\` al completar.\n\n${deliverables.tasksMarkdown.trim()}\n`,
    );
  }

  return [...map.entries()]
    .map(([path, content]) => ({ path, content }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Full governance scaffold for export when `agentGovernanceContent` is empty (deterministic fallbacks).
 */
export function synthesizeExportGovernanceScaffold(
  project: ProjectWithStages,
): AgentGovernanceScaffold {
  const complexity = (project.complexity ?? "HIGH") as ComplexityLevel;
  const stage = pickPrimaryStage(project.stages);
  const mdd = projectConstitutionMarkdown(project);
  const governanceInput = buildAgentGovernanceInput(project, mdd, complexity, stage);
  const suggestions = suggestAgentGovernanceArtifacts(governanceInput);
  const featureDir = specKitFeatureDir(stage?.ordinal ?? 1, project.name);
  const scaffold = parseAgentGovernanceResponse('{"files":{}}', complexity, {
    suggestions,
    governanceInput,
    featureDir,
  });
  return appendProjectDeliverablesToScaffold(
    scaffold,
    buildProjectDeliverableExportInput(project, stage),
  );
}

export function buildAgentGovernanceInput(
  project: Project,
  mddMarkdown: string,
  complexity: ComplexityLevel,
  stage?: Stage | null,
): SuggestAgentGovernanceInput {
  return {
    mddMarkdown,
    blueprintMarkdown: project.blueprintContent,
    tasksMarkdown: project.tasksContent,
    architectureMarkdown: project.architectureContent,
    specMarkdown: project.specContent,
    apiContractsMarkdown: project.apiContractsContent,
    logicFlowsMarkdown: project.logicFlowsContent,
    uxUiGuideMarkdown: project.uxUiGuideContent,
    uiScreensMarkdown: project.uiScreensContent,
    infraMarkdown: project.infraContent,
    useCasesMarkdown: project.useCasesContent,
    userStoriesMarkdown: project.userStoriesContent,
    projectName: project.name,
    projectId: project.id,
    stageId: stage?.id ?? null,
    stageOrdinal: stage?.ordinal ?? null,
    complexity,
  };
}

const ROOT_CONSUMPTION_GUIDE = "THEFORGE-DOC-CONSUMPTION-GUIDE.md";

function ensureRootConsumptionGuideInSpecKit(
  specKitFiles: SpecKitBundleFile[],
  agentGovernance: AgentGovernanceScaffold | null,
  consumptionGuideContent: string | null,
): SpecKitBundleFile[] {
  if (specKitFiles.some((f) => f.path === ROOT_CONSUMPTION_GUIDE)) {
    return specKitFiles;
  }
  const fromGuide = consumptionGuideContent?.trim();
  const fromGovernance = agentGovernance?.files.find((f) =>
    f.path.endsWith("THEFORGE-DOC-CONSUMPTION-GUIDE.md"),
  )?.content;
  const content = fromGuide || fromGovernance?.trim();
  if (!content) return specKitFiles;
  return [...specKitFiles, { path: ROOT_CONSUMPTION_GUIDE, content }];
}

/** Reconcile governance scaffold + inject docs/sdd deliverables (shared by export paths). */
export function reconcileExportScaffold(
  project: ProjectWithStages,
  options?: { throwIfMissing?: boolean; forceFreshOverlay?: boolean },
): AgentGovernanceScaffold | null {
  const raw = project.agentGovernanceContent?.trim() ?? "";
  if (!raw) {
    if (options?.throwIfMissing) {
      throw new Error("No hay gobernanza de agentes generada para este proyecto.");
    }
    return null;
  }

  const scaffold = parseAgentGovernanceScaffold(raw);
  if (!scaffold) {
    if (options?.throwIfMissing) {
      throw new Error("El scaffold de gobernanza no contiene archivos válidos.");
    }
    return null;
  }

  const complexity = (project.complexity ?? "HIGH") as ComplexityLevel;
  const mdd = projectConstitutionMarkdown(project);
  const stage = pickPrimaryStage(project.stages);
  const governanceInput = buildAgentGovernanceInput(project, mdd, complexity, stage);
  const suggestions = suggestAgentGovernanceArtifacts(governanceInput);
  const featureDir = specKitFeatureDir(stage?.ordinal ?? 1, project.name);

  const reconciled = reconcileAgentGovernanceScaffold(scaffold, complexity, {
    suggestions,
    governanceInput,
    forceFreshOverlay: options?.forceFreshOverlay === true,
    featureDir,
  });

  return appendProjectDeliverablesToScaffold(
    reconciled,
    buildProjectDeliverableExportInput(project, pickPrimaryStage(project.stages)),
  );
}

export function buildSpecKitFilesForProject(
  project: ProjectWithStages,
  consumptionGuideContent: string | null,
  stage?: Stage | null,
): SpecKitBundleFile[] {
  const primaryStage = stage ?? pickPrimaryStage(project.stages);
  const deliverables = primaryStage
    ? resolveStageDeliverables(project, primaryStage, "analyze").deliverables
    : project;
  const mdd = (primaryStage?.mddContent ?? "").trim() || projectConstitutionMarkdown(project);
  return buildSpecKitBundleFiles({
    projectName: project.name,
    featureOrdinal: primaryStage?.ordinal ?? 1,
    mddContent: mdd,
    specContent: deliverables.specContent ?? project.specContent,
    blueprintContent: deliverables.blueprintContent ?? project.blueprintContent,
    tasksContent: deliverables.tasksContent ?? project.tasksContent,
    apiContractsContent: deliverables.apiContractsContent ?? project.apiContractsContent,
    logicFlowsContent: deliverables.logicFlowsContent ?? project.logicFlowsContent,
    infraContent: deliverables.infraContent ?? project.infraContent,
    architectureContent: deliverables.architectureContent ?? project.architectureContent,
    useCasesContent: deliverables.useCasesContent ?? project.useCasesContent,
    userStoriesContent: deliverables.userStoriesContent ?? project.userStoriesContent,
    phase0SummaryContent: project.phase0SummaryContent,
    dbgaContent: project.dbgaContent,
    uxUiGuideContent: deliverables.uxUiGuideContent ?? project.uxUiGuideContent,
    uiScreensContent: deliverables.uiScreensContent ?? project.uiScreensContent,
    consumptionGuideContent,
  });
}

/** Single source of truth for repo-handoff, agent-governance-export, Hermes. */
export function buildUnifiedHandoff(
  project: ProjectWithStages,
  consumptionGuideContent: string | null,
): UnifiedHandoff {
  const stage = pickPrimaryStage(project.stages);
  const featureDir = specKitFeatureDir(stage?.ordinal ?? 1, project.name);

  const raw = project.agentGovernanceContent?.trim() ?? "";
  let agentGovernance: AgentGovernanceScaffold | null = null;
  let serializedGovernance: string | undefined;
  let governancePersisted = false;

  if (raw) {
    agentGovernance = reconcileExportScaffold(project);
    if (agentGovernance) {
      serializedGovernance = serializeAgentGovernanceScaffold(agentGovernance);
      governancePersisted = serializedGovernance !== raw;
    }
  }

  const specKitFiles = ensureRootConsumptionGuideInSpecKit(
    buildSpecKitFilesForProject(project, consumptionGuideContent, stage),
    agentGovernance,
    consumptionGuideContent,
  );

  specKitFiles.push(theforgeProjectJsonSpecKitFile(project));

  return {
    featureDir,
    projectName: project.name,
    specKitFiles,
    agentGovernance,
    layout: "spec-kit-primary",
    pathMap: resolveDocumentPathMap(featureDir),
    governancePresent: !!(agentGovernance?.files?.length),
    serializedGovernance,
    governancePersisted,
  };
}

export function scaffoldToRepoHandoffGovernance(scaffold: AgentGovernanceScaffold | null): {
  present: boolean;
  files: Array<{ path: string; content: string }>;
  manifest?: Record<string, unknown>;
} {
  if (!scaffold?.files?.length) {
    return { present: false, files: [] };
  }
  return {
    present: true,
    files: scaffold.files.map((f) => ({ path: f.path, content: f.content })),
    manifest: scaffold.manifest as Record<string, unknown>,
  };
}

export function analyzeAgentGovernanceSlice(
  project: ProjectWithStages,
): SddAgentGovernanceAnalyzeSlice {
  const complexity = (project.complexity ?? "HIGH") as ComplexityLevel;
  const raw = project.agentGovernanceContent?.trim() ?? "";

  if (!raw) {
    return {
      present: false,
      fileCount: 0,
      missingRequiredPaths: getRequiredAgentGovernancePaths(complexity),
      hasInstallGuide: false,
      pathAlignmentOk: false,
    };
  }

  const reconciled = reconcileExportScaffold(project);
  if (!reconciled) {
    return {
      present: false,
      fileCount: 0,
      missingRequiredPaths: getRequiredAgentGovernancePaths(complexity),
      hasInstallGuide: false,
      pathAlignmentOk: false,
    };
  }

  const paths = new Set(reconciled.files.map((f) => f.path));
  const required = getRequiredAgentGovernancePaths(complexity);
  const missingRequiredPaths = required.filter((p) => !paths.has(p));
  const installPath = `${GOVERNANCE_DOCS_PREFIX}INSTALACION.md`;
  const hasInstallGuide = paths.has(installPath);
  const mirrorsPresent = SDD_MIRROR_PATHS.filter((p) => paths.has(p)).length;
  const pathAlignmentOk = mirrorsPresent >= 3;

  return {
    present: true,
    fileCount: reconciled.files.length,
    missingRequiredPaths,
    hasInstallGuide,
    pathAlignmentOk,
  };
}

export function hashHandoffContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** JSON raíz del handoff para vincular repo destino con The Forge MCP. */
export function buildTheforgeProjectJson(
  project: ProjectWithStages,
  options?: { handoffVersion?: string },
): TheforgeProjectJson {
  const stage = pickPrimaryStage(project.stages);
  const featureDir = specKitFeatureDir(stage?.ordinal ?? 1, project.name);
  const pathMap = resolveDocumentPathMap(featureDir);
  const artifactPaths: Record<string, string> = {};
  for (const entry of pathMap) {
    artifactPaths[entry.label] = entry.mirror;
  }
  return {
    projectId: project.id,
    stageId: stage?.id ?? "",
    projectName: project.name,
    stageOrdinal: stage?.ordinal ?? 1,
    handoffVersion: options?.handoffVersion ?? AGENT_GOVERNANCE_TEMPLATE_VERSION,
    exportedAt: new Date().toISOString(),
    artifactPaths,
    mcp: { tool: "report_documentation_gap" },
  };
}

export function theforgeProjectJsonSpecKitFile(
  project: ProjectWithStages,
  options?: { handoffVersion?: string },
): SpecKitBundleFile {
  const json = buildTheforgeProjectJson(project, options);
  return {
    path: ".theforge-project.json",
    content: `${JSON.stringify(json, null, 2)}\n`,
  };
}

export function toHandoffFilesWithHash(
  files: Array<{ path: string; content: string }>,
): HandoffFileWithHash[] {
  return files.map((f) => ({
    path: f.path,
    content: f.content,
    size: f.content.length,
    sha256: hashHandoffContent(f.content),
  }));
}

export function buildHermesHandoffPayload(
  unified: UnifiedHandoff,
): HermesHandoffPayload {
  const governanceFiles = unified.agentGovernance?.files ?? [];
  return {
    format: "spec-kit-compatible",
    featureDir: unified.featureDir,
    layout: unified.layout,
    implementReadme:
      "Lee IMPLEMENT.md, .specify/memory/constitution.md y tasks en specs/. " +
      "Instala agent-governance según INSTALACION.md si aplica.",
    governancePresent: unified.governancePresent,
    pathMap: unified.pathMap,
    files: toHandoffFilesWithHash(unified.specKitFiles),
    governanceFiles: toHandoffFilesWithHash(governanceFiles),
    cliFallback: `node scripts/theforge-export.mjs --project <id> --out ./handoff`,
  };
}
