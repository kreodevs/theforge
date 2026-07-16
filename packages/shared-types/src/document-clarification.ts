import { z } from "zod";

/** Marcador spec-kit: `[NEEDS CLARIFICATION]` o `[NEEDS CLARIFICATION: pregunta]`. */
export const NEEDS_CLARIFICATION_MARKER_RE = /\[NEEDS CLARIFICATION(?::([^\]]*))?\]/gi;

export interface ClarificationItem {
  /** Id estable por orden de aparición (`clarify-0`, …). */
  id: string;
  /** Texto de la pregunta (vacío si el marcador no incluye `: …`). */
  question: string;
  /** Marcador literal en el markdown. */
  marker: string;
}

/** Cuenta marcadores `[NEEDS CLARIFICATION]` en markdown. */
export function countClarificationMarkers(md: string): number {
  const re = new RegExp(NEEDS_CLARIFICATION_MARKER_RE.source, NEEDS_CLARIFICATION_MARKER_RE.flags);
  const matches = (md ?? "").match(re);
  return matches?.length ?? 0;
}

export function hasPendingClarifications(md: string): boolean {
  return countClarificationMarkers(md) > 0;
}

export function documentHasPendingClarificationSection(md: string): boolean {
  return /##\s+Pendientes de clarificación/i.test(md ?? "");
}

/** @deprecated Alias histórico para Spec. */
export function specHasPendingClarificationSection(md: string): boolean {
  return documentHasPendingClarificationSection(md);
}

/** Extrae ítems de clarificación en orden de aparición. */
export function extractClarificationItems(md: string): ClarificationItem[] {
  const text = md ?? "";
  const re = new RegExp(NEEDS_CLARIFICATION_MARKER_RE.source, NEEDS_CLARIFICATION_MARKER_RE.flags);
  const items: ClarificationItem[] = [];
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(text)) !== null) {
    const question = (match[1] ?? "").trim();
    items.push({
      id: `clarify-${index}`,
      question: question || "Aclaración pendiente (sin pregunta explícita en el marcador)",
      marker: match[0],
    });
    index += 1;
  }
  return items;
}

/** Campos de documento del Workshop que soportan clarify / resolve. */
export const CLARIFYABLE_DOCUMENT_FIELDS = [
  "specContent",
  "mddContent",
  "dbgaContent",
  "brdContent",
  "architectureContent",
  "useCasesContent",
  "userStoriesContent",
  "blueprintContent",
  "tasksContent",
  "apiContractsContent",
  "logicFlowsContent",
  "infraContent",
  "agentGovernanceContent",
  "uxUiGuideContent",
  "uiScreensContent",
  "phase0SummaryContent",
  "aemContent",
] as const;

export type ClarifyableDocumentField = (typeof CLARIFYABLE_DOCUMENT_FIELDS)[number];

export const clarifyDocumentBodySchema = z.object({
  field: z.enum(CLARIFYABLE_DOCUMENT_FIELDS),
  /** Si true, persiste el documento aclarado. */
  persist: z.boolean().optional().default(false),
  /** Notas del usuario para guiar la clarificación. */
  notes: z.string().optional(),
  /** Etapa activa (entregables por stage / MDD / BRD). */
  stageId: z.string().optional(),
  /** Solo specContent: anota MDD tras resolver todos los marcadores. */
  syncMdd: z.boolean().optional().default(false),
});

export type ClarifyDocumentBody = z.infer<typeof clarifyDocumentBodySchema>;

export const resolveClarificationsBodySchema = z.object({
  field: z.enum(CLARIFYABLE_DOCUMENT_FIELDS),
  /** Respuestas por id (`clarify-0`, …). Debe cubrir todos los marcadores pendientes. */
  answers: z.record(z.string(), z.string().min(1)),
  /** Si true (default), persiste el documento regenerado. */
  persist: z.boolean().optional().default(true),
  stageId: z.string().optional(),
});

export type ResolveClarificationsBody = z.infer<typeof resolveClarificationsBodySchema>;
