/**
 * Modo asistido: peticiones de ayuda para inferir UAT/riesgos desde el documento.
 */

import type {
  Phase0Document,
  Phase0Gap,
  Phase0InterviewState,
  Phase0Risk,
  Phase0UATCriterion,
} from "./phase0.types.js";
import type { Phase0TemplateKind } from "./phase0-template-detect.util.js";
import { refreshBorradorFromWorkingMarkdown } from "./phase0-load-borrador.util.js";
import { analyzeGaps, filterResolvedGaps } from "./phase0-gap-analyzer.js";

export function gapForAssistedQuestion(state: Phase0InterviewState): Phase0Gap | undefined {
  const q = (state.ultimaPregunta ?? "").trim().toLowerCase();
  if (!q) return state.questionPlan[state.planCursor];
  return (
    state.gaps.find((g) => {
      const sug = (g.sugerenciaPregunta ?? "").trim().toLowerCase();
      return sug && (q.includes(sug) || sug.includes(q));
    }) ?? state.questionPlan[state.planCursor]
  );
}

export type AssistedGapKind = "uat" | "riesgos" | "other";

export function assistedGapKind(gap: Phase0Gap | undefined): AssistedGapKind {
  const d = (gap?.descripcion ?? "").toLowerCase();
  if (d.includes("criterios de aceptación") || d.includes("uat")) return "uat";
  if (d.includes("riesgos")) return "riesgos";
  return "other";
}

/** El usuario pide al asistente inferir/redactar en lugar de aportar la respuesta. */
export function isAssistedHelpRequest(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    /\b(con la informacion que tienes|con lo que tienes|basandote en el documento)\b/.test(t) ||
    /\b(puedes ayud|podrias ayud|me ayud|ayudame a gener|generarlos|generalas|genera los|genera las)\b/.test(t) ||
    /\b(infiere|inferir|propón|propon|sugiere|redacta|escribe los|completa los|rellena)\b/.test(t)
  );
}

export function hasAssistedSynthesisContext(
  borrador: Phase0Document,
  markdown: string,
  kind: AssistedGapKind,
): boolean {
  const mdLen = markdown.trim().length;
  if (kind === "uat") {
    return (
      (borrador.flujos?.length ?? 0) > 0 ||
      (borrador.reglasNegocio?.length ?? 0) >= 2 ||
      borrador.proposito.problema.trim().length >= 80 ||
      mdLen >= 2500
    );
  }
  if (kind === "riesgos") {
    return (
      (borrador.edgeCases?.length ?? 0) > 0 ||
      (borrador.integraciones?.length ?? 0) > 0 ||
      (borrador.reglasNegocio?.length ?? 0) >= 2 ||
      /\briesgo|mitigaci/i.test(markdown) ||
      mdLen >= 2500
    );
  }
  return mdLen >= 1500;
}

export function assistedHelpDeclinedMessage(
  gap: Phase0Gap | undefined,
  kind: AssistedGapKind,
): string {
  if (kind === "uat") {
    return (
      "No hay suficiente detalle en el documento (flujos, reglas o casos concretos) para inferir criterios UAT fiables. " +
      "Describe 2–4 escenarios en formato Dado/Cuando/Entonces en lenguaje de negocio."
    );
  }
  if (kind === "riesgos") {
    return (
      "No hay suficiente contexto en el documento para inferir riesgos y mitigaciones concretos. " +
      "Indica los 3 principales riesgos del proyecto y cómo los mitigarías."
    );
  }
  return (
    gap?.sugerenciaPregunta
      ? `No puedo completar esta sección solo con el documento actual; necesito tu respuesta concreta: ${gap.sugerenciaPregunta}`
      : "No puedo completar esta sección solo con el documento actual; necesito tu respuesta concreta."
  );
}

export function heuristicSynthesizeUat(borrador: Phase0Document): Phase0UATCriterion[] {
  const out: Phase0UATCriterion[] = [];
  const actor = borrador.proposito.usuarios[0]?.trim() || "usuario autenticado";

  for (const flow of borrador.flujos ?? []) {
    if (out.length >= 4 || !flow.nombre?.trim()) continue;
    const steps = flow.pasos.filter(Boolean).slice(0, 3).join("; ");
    out.push({
      id: `UAT-${String(out.length + 1).padStart(2, "0")}`,
      descripcion: `Dado un ${actor}, cuando ejecuta el flujo "${flow.nombre}", entonces el sistema ${steps ? `completa: ${steps}` : "finaliza el flujo sin errores"}.`,
    });
  }

  for (const rule of borrador.reglasNegocio ?? []) {
    if (out.length >= 4) break;
    const snippet = rule.trim().slice(0, 140);
    if (snippet.length < 12) continue;
    out.push({
      id: `UAT-${String(out.length + 1).padStart(2, "0")}`,
      descripcion: `Dado el contexto operativo del negocio, cuando aplica la regla "${snippet}", entonces el sistema la cumple de forma verificable.`,
    });
  }

  if (out.length === 0 && borrador.proposito.problema.trim().length >= 40) {
    out.push({
      id: "UAT-01",
      descripcion: `Dado un ${actor}, cuando usa la capacidad principal del sistema (${borrador.proposito.problema.trim().slice(0, 100)}…), entonces el resultado cumple el propósito declarado en §1.`,
    });
  }

  return out.slice(0, 4);
}

export function heuristicSynthesizeRiesgos(borrador: Phase0Document): Phase0Risk[] {
  const out: Phase0Risk[] = [];

  for (const edge of borrador.edgeCases ?? []) {
    if (out.length >= 3) break;
    const name = edge.trim().slice(0, 100);
    if (name.length < 8) continue;
    out.push({
      id: `R-${String(out.length + 1).padStart(2, "0")}`,
      nombre: name,
      impacto: "Medio",
      probabilidad: "Media",
      mitigacion: "Pruebas de regresión, monitoreo y manejo de errores documentado en el flujo afectado.",
    });
  }

  for (const integration of borrador.integraciones ?? []) {
    if (out.length >= 3) break;
    const name = `Dependencia externa: ${integration.trim().slice(0, 80)}`;
    out.push({
      id: `R-${String(out.length + 1).padStart(2, "0")}`,
      nombre: name,
      impacto: "Alto",
      probabilidad: "Media",
      mitigacion: "Timeouts, reintentos acotados, circuit breaker y alertas operativas.",
    });
  }

  if (out.length < 3 && (borrador.reglasNegocio?.length ?? 0) > 0) {
    out.push({
      id: `R-${String(out.length + 1).padStart(2, "0")}`,
      nombre: "Incumplimiento de reglas de negocio críticas",
      impacto: "Alto",
      probabilidad: "Media",
      mitigacion: "Validaciones automáticas alineadas a las reglas documentadas y auditoría periódica.",
    });
  }

  return out.slice(0, 3);
}

export function patchMarkdownUat(markdown: string, criteria: Phase0UATCriterion[]): string {
  if (criteria.length === 0) return markdown;
  const bullets = criteria.map((c) => `- **${c.id}:** ${c.descripcion}`).join("\n");
  const headingRe = /##\s+\d+\.\s*Criterios de Aceptaci[oó]n/i;
  if (headingRe.test(markdown)) {
    const lines = markdown.split("\n");
    const idx = lines.findIndex((l) => headingRe.test(l.trim()));
    if (idx >= 0) {
      let end = idx + 1;
      while (end < lines.length && !/^##\s+\d+\./.test(lines[end]!.trim())) end += 1;
      const before = lines.slice(0, idx + 1);
      const after = lines.slice(end);
      return [...before, "", bullets, "", ...after].join("\n");
    }
  }
  return `${markdown.trim()}\n\n## 12. Criterios de Aceptación (UAT)\n\n${bullets}\n`;
}

export function patchMarkdownRiesgos(markdown: string, riesgos: Phase0Risk[]): string {
  if (riesgos.length === 0) return markdown;
  const table = [
    "| ID | Riesgo | Impacto | Probabilidad | Mitigación |",
    "| --- | --- | --- | --- | --- |",
    ...riesgos.map(
      (r) => `| ${r.id} | ${r.nombre} | ${r.impacto} | ${r.probabilidad} | ${r.mitigacion} |`,
    ),
  ].join("\n");
  const headingRe = /##\s+\d+\.\s*Riesgos/i;
  if (headingRe.test(markdown)) {
    const lines = markdown.split("\n");
    const idx = lines.findIndex((l) => headingRe.test(l.trim()));
    if (idx >= 0) {
      let end = idx + 1;
      while (end < lines.length && !/^##\s+\d+\./.test(lines[end]!.trim())) end += 1;
      const before = lines.slice(0, idx + 1);
      const after = lines.slice(end);
      return [...before, "", table, "", ...after].join("\n");
    }
  }
  return `${markdown.trim()}\n\n## 11. Riesgos y Mitigación\n\n${table}\n`;
}

export function applyAssistedGapSynthesis(opts: {
  state: Phase0InterviewState;
  kind: AssistedGapKind;
  criteriosUAT?: Phase0UATCriterion[];
  riesgos?: Phase0Risk[];
  templateKind: Phase0TemplateKind;
  source: "llm" | "heuristic";
}): { impacto: string; cambios: string[] } {
  const { state, kind, templateKind, source } = opts;
  const cambios: string[] = [];

  if (kind === "uat" && opts.criteriosUAT?.length) {
    state.borrador.criteriosUAT = opts.criteriosUAT;
    if (templateKind !== "structured" && state.workingMarkdown) {
      state.workingMarkdown = patchMarkdownUat(state.workingMarkdown, opts.criteriosUAT);
    }
    cambios.push("criteriosUAT");
  }

  if (kind === "riesgos" && opts.riesgos?.length) {
    state.borrador.riesgos = opts.riesgos;
    if (templateKind !== "structured" && state.workingMarkdown) {
      state.workingMarkdown = patchMarkdownRiesgos(state.workingMarkdown, opts.riesgos);
    }
    cambios.push("riesgos");
  }

  if (templateKind !== "structured" && state.workingMarkdown) {
    state.borrador = refreshBorradorFromWorkingMarkdown(state.borrador, state.workingMarkdown);
  }

  state.gaps = filterResolvedGaps(
    analyzeGaps(state.borrador),
    state.borrador,
    state.ultimaPregunta,
  );

  const label = source === "llm" ? "modelo" : "documento existente";
  const impacto =
    kind === "uat"
      ? `Generé ${opts.criteriosUAT?.length ?? 0} criterio(s) UAT a partir del ${label} (no sustituyen validación de negocio).`
      : kind === "riesgos"
        ? `Generé ${opts.riesgos?.length ?? 0} riesgo(s) con mitigación a partir del ${label}.`
        : "Se completó la sección solicitada.";

  return { impacto, cambios };
}

/** Mensaje cuando el fallback no pudo mapear la respuesta a ninguna sección. */
export function assistedFallbackNoopImpact(
  answer: string,
  gap: Phase0Gap | undefined,
): string {
  if (isAssistedHelpRequest(answer)) {
    return assistedHelpDeclinedMessage(gap, assistedGapKind(gap));
  }
  return "Respuesta registrada; revisa el documento manualmente si no ves cambios.";
}
