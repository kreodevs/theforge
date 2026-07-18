import type { AriadneChangePackV1, CreateStageFromAriadneChangePackOutput } from "@theforge/shared-types";

export function buildLegacyChangeStateFromAriadnePack(
  pack: AriadneChangePackV1,
  defaultRepoId: string | null,
): Record<string, unknown> {
  const filesToModify = (pack.filesToModify ?? [])
    .map((file) => ({
      path: file.path.trim(),
      repoId: file.repoId?.trim() || defaultRepoId?.trim() || undefined,
    }))
    .filter((file) => file.path);

  return {
    description: pack.changeDescription.trim(),
    ...(filesToModify.length ? { filesToModify } : {}),
    ...(pack.questionsToRefine?.length ? { questions: pack.questionsToRefine } : {}),
    ariadneChangePack: {
      version: pack.version,
      ariadneChangeId: pack.ariadneChangeId ?? null,
      ariadneRepositoryId: pack.ariadneRepositoryId ?? null,
      importedAt: new Date().toISOString(),
    },
  };
}

export function defaultStageNameFromAriadnePack(pack: AriadneChangePackV1): string {
  if (pack.ariadneChangeId?.trim()) {
    return `Ariadne — ${pack.ariadneChangeId.trim().slice(0, 80)}`;
  }
  const excerpt = pack.changeDescription.trim().replace(/\s+/g, " ").slice(0, 72);
  return excerpt.length >= pack.changeDescription.trim().length
    ? `Ariadne — ${excerpt}`
    : `Ariadne — ${excerpt}…`;
}

export function shouldRunLegacyStartForAriadnePack(
  pack: AriadneChangePackV1,
  explicit: boolean | undefined,
  autoLegacyStartEnabled: boolean,
): boolean {
  if (explicit != null) return explicit;
  if ((pack.filesToModify?.length ?? 0) > 0) return false;
  return autoLegacyStartEnabled;
}

export function buildRecommendedNextToolsAfterAriadnePack(input: {
  questionsCount: number;
  hasHandoffItems: boolean;
}): CreateStageFromAriadneChangePackOutput["recommendedNextTools"] {
  const steps: CreateStageFromAriadneChangePackOutput["recommendedNextTools"] = [];
  if (input.questionsCount > 0) {
    steps.push({
      tool: "legacy_answer",
      reason: "El pack incluye preguntas de refinamiento; persistir respuestas antes del MDD.",
    });
  }
  steps.push({
    tool: "legacy_generate_mdd",
    reason: "Generar MDD de cambio para la etapa creada/importada (incluir stageId).",
  });
  if (input.hasHandoffItems) {
    steps.push({
      tool: "sync_handoff_spec",
      reason: "Opcional: POST …/integration/stages/:stageId/sync-handoff-spec si hay ítems NEW-LEG.",
    });
  }
  steps.push({
    tool: "legacy_generate_deliverables",
    reason: "Tras MDD en VERDE, cascada legacy de entregables para la etapa activa.",
  });
  return steps;
}
