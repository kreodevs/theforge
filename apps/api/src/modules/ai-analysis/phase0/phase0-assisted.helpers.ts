/**
 * Helpers del Modo asistido Fase 0 (detección, mensajes, plan de preguntas).
 */

import { formatDocumentMarkdown } from "@theforge/shared-types";
import { analyzeGaps, buildQuestionPlan, isAskableGap } from "./phase0-gap-analyzer.js";
import { phase0ToMarkdown } from "./phase0-to-markdown.js";
import type { Phase0Document, Phase0Gap, Phase0InterviewState } from "./phase0.types.js";
import {
  detectPhase0Template,
  PHASE0_TEMPLATE_LABELS,
  phase0TemplateTargetField,
  type Phase0TemplateKind,
} from "./phase0-template-detect.util.js";

/** Tope blando para evitar loops infinitos; el usuario puede apagar el modo antes. */
export const ASSISTED_MAX_PREGUNTAS = 30;

export const ASSISTED_AWAITING_SEED_MESSAGE =
  "Modo asistido activado. Describe tu idea o pega el documento de Paso 0 en el chat para detectar la plantilla, reformatear y empezar con una pregunta a la vez.";

export const ASSISTED_COMPLETE_MESSAGE =
  "No necesitas Modo Asistido: tu documento de Paso 0 ya está completo (no quedan gaps críticos ni importantes). Puedes apagar el modo o seguir refinando en chat libre.";

export const ASSISTED_STOPPED_MESSAGE =
  "Modo asistido desactivado. El documento conserva los cambios de las iteraciones anteriores.";

export function templateKindFromState(
  state: Pick<Phase0InterviewState, "sourceFormat">,
): Phase0TemplateKind {
  if (state.sourceFormat === "freeform_dbga") return "freeform_dbga";
  if (state.sourceFormat === "deep_research") return "deep_research";
  return "structured";
}

export function reformatForTemplate(
  kind: Phase0TemplateKind,
  markdown: string,
  borrador?: Phase0Document,
): { markdown: string; reformatted: boolean } {
  const source = markdown.trim();
  if (kind === "structured" && borrador) {
    const canonical = phase0ToMarkdown(borrador);
    const formatted = formatDocumentMarkdown(canonical);
    return {
      markdown: formatted,
      reformatted: formatted.trim() !== source,
    };
  }
  if (!source) {
    return { markdown: "", reformatted: false };
  }
  const formatted = formatDocumentMarkdown(source);
  return {
    markdown: formatted,
    reformatted: formatted.trim() !== source,
  };
}

export function buildAssistedQuestionPlan(gaps: Phase0Gap[], alreadyAsked: number): Phase0Gap[] {
  const remainingSlots = Math.max(1, ASSISTED_MAX_PREGUNTAS - alreadyAsked);
  return buildQuestionPlan(gaps, remainingSlots);
}

export function nextAssistedQuestion(
  state: Phase0InterviewState,
): { question: string; n: number; total: number } | null {
  if (state.preguntasRealizadas >= state.maxPreguntas) return null;
  const gap = state.questionPlan[state.planCursor];
  if (!gap?.sugerenciaPregunta?.trim()) return null;
  const n = state.preguntasRealizadas + 1;
  const remaining = Math.max(0, state.questionPlan.length - state.planCursor);
  const total = Math.min(ASSISTED_MAX_PREGUNTAS, state.preguntasRealizadas + remaining);
  return {
    question: gap.sugerenciaPregunta.trim(),
    n,
    total: Math.max(n, total),
  };
}

/** Tras una respuesta: reconstruye el plan con gaps askables restantes. */
export function refreshAssistedPlanAfterAnswer(state: Phase0InterviewState): void {
  const askable = state.gaps.filter(isAskableGap);
  if (askable.length === 0) {
    state.questionPlan = [];
    state.planCursor = 0;
    state.maxPreguntas = state.preguntasRealizadas;
    return;
  }
  const plan = buildAssistedQuestionPlan(askable, state.preguntasRealizadas);
  state.questionPlan = plan;
  state.planCursor = 0;
  state.maxPreguntas = Math.min(
    ASSISTED_MAX_PREGUNTAS,
    state.preguntasRealizadas + plan.length,
  );
}

export function assistedGapsFromBorrador(borrador: Phase0Document): Phase0Gap[] {
  return analyzeGaps(borrador);
}

export function detectTemplateForProject(input: {
  dbgaContent?: string | null;
  phase0SummaryContent?: string | null;
  idea?: string | null;
}): {
  kind: Phase0TemplateKind;
  label: string;
  targetField: "dbgaContent" | "phase0SummaryContent";
} {
  const kind = detectPhase0Template(input);
  return {
    kind,
    label: PHASE0_TEMPLATE_LABELS[kind],
    targetField: phase0TemplateTargetField(kind),
  };
}

export function formatAssistedChatMessage(opts: {
  templateLabel?: string;
  impacto?: string;
  cambios?: string[];
  question?: string;
  n?: number;
  total?: number;
  done?: boolean;
  intro?: string;
  gapSummary?: string;
}): string {
  const parts: string[] = [];
  if (opts.intro?.trim()) parts.push(opts.intro.trim());
  if (opts.templateLabel?.trim()) {
    parts.push(`Plantilla detectada: **${opts.templateLabel.trim()}**.`);
  }
  if (opts.gapSummary?.trim()) parts.push(opts.gapSummary.trim());
  if (opts.impacto?.trim()) {
    parts.push(`**Impacto:** ${opts.impacto.trim()}`);
  }
  if (opts.cambios && opts.cambios.length > 0) {
    parts.push(
      "**Cambios:**\n" + opts.cambios.map((c) => `- ${c.trim()}`).filter(Boolean).join("\n"),
    );
  }
  if (opts.done) {
    parts.push(ASSISTED_COMPLETE_MESSAGE);
  } else if (opts.question?.trim()) {
    const counter =
      opts.n != null && opts.total != null ? ` (${opts.n}/${opts.total})` : "";
    parts.push(`**Pregunta${counter}:** ${opts.question.trim()}`);
  }
  return parts.join("\n\n");
}

export function parseAssistedImpact(parsed: Record<string, unknown>): {
  impacto: string;
  cambios: string[];
} {
  const impacto =
    typeof parsed.impacto === "string" && parsed.impacto.trim()
      ? parsed.impacto.trim()
      : "Se actualizó el documento con la respuesta.";
  const cambiosRaw = parsed.cambios;
  const cambios = Array.isArray(cambiosRaw)
    ? cambiosRaw
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim())
    : [];
  return { impacto, cambios };
}

/** Pregunta meta en chat (no es respuesta a la entrevista). */
export function isAssistedMetaQuestion(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /\b(que falta|que me falta|gaps?|faltante|incompleto|auditar|revisar|analiza|analizar)\b/.test(
    t,
  );
}

export function formatAssistedGapSummary(gaps: Phase0Gap[]): string {
  const askable = gaps.filter(isAskableGap);
  if (askable.length === 0) {
    return "No detecté gaps críticos ni importantes pendientes.";
  }
  const lines = askable.slice(0, 12).map((g, i) => {
    const tag = g.criticidad === "critico" ? "crítico" : g.criticidad;
    return `${i + 1}. **[${tag}]** ${g.descripcion.trim()}`;
  });
  const extra = askable.length > 12 ? `\n… y ${askable.length - 12} más.` : "";
  return `**Gaps pendientes (${askable.length}):**\n${lines.join("\n")}${extra}`;
}
