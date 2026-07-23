/**
 * Detección automática de plantilla Fase 0 según el origen del documento.
 *
 * A — structured: `# Fase 0 — Especificación Inicial` (entrevista / canónico)
 * B — freeform_dbga: Domain Benchmark & Gap Analysis libre en `dbgaContent`
 * C — deep_research: `Especificador de Base para MDD` en `phase0SummaryContent`
 */

import { isPhase0BorradorJson } from "@theforge/shared-types";
import { isPhase0StructuredMarkdown, isDbgaFreeformMarkdown } from "./phase0-from-markdown.js";
import { MIN_DBGA_AUDIT_CHARS } from "./phase0-load-borrador.util.js";

export type Phase0TemplateKind = "structured" | "freeform_dbga" | "deep_research";

export const PHASE0_TEMPLATE_LABELS: Record<Phase0TemplateKind, string> = {
  structured: "Fase 0 — Especificación Inicial",
  freeform_dbga: "Domain Benchmark & Gap Analysis",
  deep_research: "Especificador de Base para MDD",
};

const DEEP_RESEARCH_TITLE_RE = /especificador\s+de\s+base\s+para\s+mdd/i;
const DEEP_RESEARCH_HINT_RE =
  /matriz\s+m\/d|mission\s+statement|#\s*especificador|#\s*research\s+report/i;

export function isDeepResearchMarkdown(raw: string | null | undefined): boolean {
  const t = raw?.trim() ?? "";
  if (!t || isPhase0BorradorJson(t)) return false;
  if (t.length < MIN_DBGA_AUDIT_CHARS) return false;
  if (DEEP_RESEARCH_TITLE_RE.test(t)) return true;
  // Markdown sustancial en phase0Summary (no JSON) con señales de research.
  return t.includes("#") && DEEP_RESEARCH_HINT_RE.test(t);
}

export type DetectPhase0TemplateInput = {
  dbgaContent?: string | null;
  phase0SummaryContent?: string | null;
  /** Idea o documento pegado al arrancar el modo asistido (sin contenido previo). */
  idea?: string | null;
};

/**
 * Prioridad: documento visible en Fase 0 (dbga) → Deep Research → idea/arranque.
 */
export function detectPhase0Template(input: DetectPhase0TemplateInput): Phase0TemplateKind {
  const dbga = input.dbgaContent?.trim() ?? "";
  const summary = input.phase0SummaryContent?.trim() ?? "";
  const idea = input.idea?.trim() ?? "";

  if (dbga.length >= MIN_DBGA_AUDIT_CHARS) {
    if (isDbgaFreeformMarkdown(dbga)) return "freeform_dbga";
    if (isPhase0StructuredMarkdown(dbga)) return "structured";
    return "freeform_dbga";
  }

  if (isDeepResearchMarkdown(summary)) return "deep_research";

  if (idea.length > 0) {
    // Documento externo largo → suele acabar en plantilla estructurada vía arranque.
    return "structured";
  }

  if (dbga.length > 0 && isPhase0StructuredMarkdown(dbga)) return "structured";
  if (dbga.length > 0) return "freeform_dbga";
  if (summary.length > 0 && !isPhase0BorradorJson(summary)) return "deep_research";

  return "structured";
}

export function phase0TemplateTargetField(
  kind: Phase0TemplateKind,
): "dbgaContent" | "phase0SummaryContent" {
  return kind === "deep_research" ? "phase0SummaryContent" : "dbgaContent";
}
