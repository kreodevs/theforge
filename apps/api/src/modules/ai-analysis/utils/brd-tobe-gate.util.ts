/** Longitud mínima de texto para considerar BRD/To-Be “presentes” (anti one-liner). */
export const BRD_TOBE_MIN_BODY_CHARS = 80;

export type StageBrdTobeGateFields = {
  brdContent: string | null | undefined;
  toBeManualContent: string | null | undefined;
  brdApprovedAt: Date | null | undefined;
  toBeApprovedAt: Date | null | undefined;
};

export function isBrdTobeGateSatisfied(stage: StageBrdTobeGateFields): boolean {
  const brd = (stage.brdContent ?? "").trim();
  const tobe = (stage.toBeManualContent ?? "").trim();
  return (
    brd.length >= BRD_TOBE_MIN_BODY_CHARS &&
    tobe.length >= BRD_TOBE_MIN_BODY_CHARS &&
    stage.brdApprovedAt != null &&
    stage.toBeApprovedAt != null
  );
}

export function brdTobeGateFailureMessage(): string {
  return (
    "El MDD técnico (§3 modelo, §4 API y posteriores) requiere **BRD** y **Manual To-Be** aprobados en la etapa: " +
    `mínimo ${BRD_TOBE_MIN_BODY_CHARS} caracteres cada uno y marcar aprobación (PATCH etapa con approveBrd / approveToBe). ` +
    "Edita BRD y To-Be en el panel del Workshop, o desactiva «Exigir BRD/To-Be» en ese panel si no aplica a esta fase."
  );
}

/** Bloque markdown para anteponer al Benchmark/MDD (solo si hay contenido aprobado). */
export function composeBrdToBeAsIsPreamble(stage: StageBrdTobeGateFields & { asIsManualContent?: string | null }): string {
  const parts: string[] = [];
  const asis = (stage.asIsManualContent ?? "").trim();
  const brd = (stage.brdContent ?? "").trim();
  const tobe = (stage.toBeManualContent ?? "").trim();
  if (asis.length >= 40) {
    parts.push("## Contexto — Mapa As-Is (proceso/código actual)\n\n" + asis.slice(0, 24_000));
  }
  if (brd.length >= 40 && stage.brdApprovedAt) {
    parts.push("## Contexto — BRD aprobado (negocio, KPIs, alcance)\n\n" + brd.slice(0, 24_000));
  }
  if (tobe.length >= 40 && stage.toBeApprovedAt) {
    parts.push("## Contexto — Manual To-Be aprobado (lógica deseada)\n\n" + tobe.slice(0, 24_000));
  }
  if (!parts.length) return "";
  return parts.join("\n\n---\n\n") + "\n\n---\n\n**Instrucción:** El MDD debe trazarse a lo anterior; no contradigas BRD/To-Be aprobados salvo que el Benchmark aporte matices explícitos.\n\n";
}

const TECHNICAL_MDD_NODES = new Set([
  "software_architect",
  "architect_critic",
  "format_after_architect",
  "security",
  "integration",
  "format_after_redactor",
  "diagram_injector",
  "auditor",
  "executor",
]);

export function isTechnicalMddGraphNode(nodeName: string | undefined): boolean {
  if (!nodeName) return false;
  return TECHNICAL_MDD_NODES.has(nodeName);
}

function extractTaggedBlock(text: string, open: string, close: string): string {
  const i = text.indexOf(open);
  const j = text.indexOf(close);
  if (i === -1 || j === -1 || j <= i) return "";
  return text.slice(i + open.length, j).trim();
}

/** Parsea la respuesta del LLM con delimitadores `<<<BRD>>>` / `<<<TOBE>>>` (mismo contrato que legacy `suggest-brd-tobe-from-codebase-doc`). */
export function parseBrdTobeTaggedSuggest(text: string): { brd: string; tobe: string } | null {
  const brdRaw = extractTaggedBlock(text, "<<<BRD>>>", "<<<END_BRD>>>");
  const tobeRaw = extractTaggedBlock(text, "<<<TOBE>>>", "<<<END_TOBE>>>");
  if (!brdRaw.trim() || !tobeRaw.trim()) return null;
  return { brd: brdRaw.trim(), tobe: tobeRaw.trim() };
}
