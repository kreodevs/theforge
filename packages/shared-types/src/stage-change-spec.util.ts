import type { IntegrationHandoffItem } from "./project-integration.js";

export interface StageChangeSpecInput {
  stageOrdinal: number;
  stageName?: string | null;
  /** Prior stage MDD excerpt (ordinal N-1). */
  priorMddExcerpt?: string | null;
  legacyChangeDescription?: string | null;
  handoffItems?: IntegrationHandoffItem[] | null;
}

/**
 * Builds a delta change spec for legacy stage 2+ (AS-IS inherited + explicit delta).
 */
export function buildStageChangeSpecContent(input: StageChangeSpecInput): string | null {
  if (input.stageOrdinal < 2) return null;

  const lines: string[] = [
    `# Change spec — Etapa ${input.stageOrdinal}${input.stageName ? `: ${input.stageName}` : ""}`,
    "",
    "## AS-IS inherited (summary)",
    "",
  ];

  const prior = (input.priorMddExcerpt ?? "").trim();
  if (prior) {
    lines.push(prior.length > 6000 ? `${prior.slice(0, 6000)}\n\n… [truncado]` : prior);
  } else {
    lines.push(
      "_No hay MDD de la etapa anterior disponible. Consulta `.specify/memory/constitution.md` de la etapa baseline._",
    );
  }

  lines.push("", "## Delta (this stage)", "");

  const desc = (input.legacyChangeDescription ?? "").trim();
  if (desc) {
    lines.push("### Change description", "", desc, "");
  }

  const items = input.handoffItems ?? [];
  if (items.length > 0) {
    lines.push("### Handoff items (NEW → LEGACY)", "");
    for (const item of items) {
      lines.push(`#### ${item.id}: ${item.title}`);
      if (item.description?.trim()) lines.push("", item.description.trim());
      if (item.acceptanceCriteria?.length) {
        lines.push("", "**Acceptance criteria:**");
        for (const ac of item.acceptanceCriteria) lines.push(`- ${ac}`);
      }
      lines.push("");
    }
  }

  if (!desc && items.length === 0) {
    lines.push("_Sin delta explícito — completa Modificación o importa handoff._");
  }

  return lines.join("\n").trim();
}
