import type {
  AriadneForgeLinkKind,
  AriadneForgeProjectCandidate,
  ResolveForgeProjectForAriadneInput,
  ResolveForgeProjectForAriadneOutput,
} from "@theforge/shared-types";
import {
  normalizeGitRemoteUrl,
  normalizeProjectKey,
  normalizeRepoSlug,
} from "./normalize-git-remote.util.js";

export type ForgeProjectLinkRow = {
  projectId: string;
  projectName: string;
  theforgeProjectId: string | null;
  linkId: string | null;
  ariadneProjectId: string | null;
  ariadneRepositoryId: string | null;
  gitRemote: string | null;
  projectKey: string | null;
  repoSlug: string | null;
  isPrimary: boolean;
};

export type ForgeProjectStageRow = {
  id: string;
  name: string;
  workflowStatus: string;
};

type ScoredCandidate = AriadneForgeProjectCandidate & { score: number };

function linkKindFor(row: ForgeProjectLinkRow): AriadneForgeLinkKind {
  if (row.linkId) return row.isPrimary ? "primary" : "alias";
  return "inferred";
}

function scoreCandidate(
  input: ResolveForgeProjectForAriadneInput,
  row: ForgeProjectLinkRow,
): { score: number; reason: string } | null {
  const repoId = input.ariadneRepositoryId?.trim();
  const projectId = input.ariadneProjectId?.trim();
  const gitRemote = normalizeGitRemoteUrl(input.gitRemoteUrl);
  const projectKey = normalizeProjectKey(input.projectKey);
  const repoSlug = normalizeRepoSlug(input.repoSlug);

  if (repoId) {
    if (row.ariadneRepositoryId === repoId || row.theforgeProjectId === repoId) {
      return { score: 100, reason: "ariadneRepositoryId" };
    }
  }

  if (projectId) {
    if (row.ariadneProjectId === projectId || row.theforgeProjectId === projectId) {
      return { score: 90, reason: "ariadneProjectId" };
    }
  }

  if (gitRemote) {
    const rowRemote = normalizeGitRemoteUrl(row.gitRemote);
    if (rowRemote && rowRemote === gitRemote) {
      return { score: 80, reason: "gitRemoteUrl" };
    }
  }

  if (projectKey && repoSlug) {
    const rowKey = normalizeProjectKey(row.projectKey);
    const rowSlug = normalizeRepoSlug(row.repoSlug);
    if (rowKey === projectKey && rowSlug === repoSlug) {
      return { score: 70, reason: "projectKey+repoSlug" };
    }
  }

  if (projectKey && !repoSlug) {
    const rowKey = normalizeProjectKey(row.projectKey);
    if (rowKey === projectKey) {
      return { score: 40, reason: "projectKey" };
    }
  }

  if (repoSlug && !projectKey) {
    const rowSlug = normalizeRepoSlug(row.repoSlug);
    if (rowSlug === repoSlug) {
      return { score: 35, reason: "repoSlug" };
    }
  }

  return null;
}

export function resolveForgeProjectCandidates(
  input: ResolveForgeProjectForAriadneInput,
  rows: ForgeProjectLinkRow[],
  stagesByProject: Map<string, ForgeProjectStageRow[]>,
): {
  matches: ScoredCandidate[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const byProject = new Map<string, ScoredCandidate>();

  for (const row of rows) {
    const hit = scoreCandidate(input, row);
    if (!hit) continue;
    const kind = linkKindFor(row);
    let score = hit.score;
    if (kind === "primary") score += 5;
    if (kind === "inferred") score -= 3;

    const candidate: ScoredCandidate = {
      forgeProjectId: row.projectId,
      forgeProjectName: row.projectName,
      linkKind: kind,
      matchReason: hit.reason,
      existingStages: stagesByProject.get(row.projectId),
      score,
    };

    const prev = byProject.get(row.projectId);
    if (!prev || candidate.score > prev.score) {
      byProject.set(row.projectId, candidate);
    }
  }

  const matches = [...byProject.values()].sort((a, b) => b.score - a.score);
  if (matches.length > 1 && matches[0]!.score === matches[1]!.score) {
    warnings.push("varios matches con la misma puntuación; elige candidato en Ariadne");
  }
  if (matches.some((m) => m.linkKind === "inferred")) {
    warnings.push("algunos matches provienen de Project.theforgeProjectId sin fila en project_ariadne_links");
  }

  return { matches, warnings };
}

export function pickForgeProjectResolution(
  input: ResolveForgeProjectForAriadneInput,
  rows: ForgeProjectLinkRow[],
  stagesByProject: Map<string, ForgeProjectStageRow[]>,
):
  | { kind: "none" }
  | { kind: "single"; result: ResolveForgeProjectForAriadneOutput }
  | { kind: "ambiguous"; candidates: AriadneForgeProjectCandidate[]; warnings: string[] } {
  const { matches, warnings } = resolveForgeProjectCandidates(input, rows, stagesByProject);
  if (matches.length === 0) return { kind: "none" };

  const topScore = matches[0]!.score;
  const top = matches.filter((m) => m.score === topScore);
  if (top.length === 1) {
    const { score: _s, matchReason: _r, ...result } = matches[0]!;
    return {
      kind: "single",
      result: {
        ...result,
        warnings: warnings.length ? warnings : undefined,
      },
    };
  }

  return {
    kind: "ambiguous",
    candidates: top.map(({ score: _s, ...rest }) => rest),
    warnings,
  };
}
