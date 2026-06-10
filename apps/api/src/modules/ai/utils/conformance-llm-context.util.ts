export const CONFORMANCE_LLM_CHAR_LIMIT = 50_000;

export const CONFORMANCE_LLM_TRUNCATION_MARKER =
  "[DOCUMENTO TRUNCADO EN ESTE PUNTO — no afirmes ausencias posteriores]";

/** Trunca texto para el prompt de conformanceCheck; añade marcador si excede el límite. */
export function truncateForConformanceLlm(text: string): string {
  const trimmed = (text || "").trim();
  if (trimmed.length <= CONFORMANCE_LLM_CHAR_LIMIT) return trimmed;
  return `${trimmed.slice(0, CONFORMANCE_LLM_CHAR_LIMIT)}\n${CONFORMANCE_LLM_TRUNCATION_MARKER}`;
}
