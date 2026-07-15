import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  traceabilitySuggestFixResponseSchema,
  type MddTraceTargetSection,
  type TraceabilityGapInput,
  type TraceabilitySuggestFixResponse,
} from "@theforge/shared-types";
import { extractFirstJsonObject, parseJsonOrThrow } from "../utils/parse-json.js";
import {
  extractMddTraceabilityCorpus,
} from "../estimation/consistency.util.js";

const SLICE = 10_000;

const SECTION_LABEL: Record<MddTraceTargetSection, string> = {
  s1: "§1 Contexto y alcance",
  s4: "§4 Contratos de API",
  s5: "§5 Lógica y edge cases",
};

export function defaultTargetForKind(kind: TraceabilityGapInput["kind"]): MddTraceTargetSection {
  switch (kind) {
    case "entity":
    case "formula":
    case "uat":
    case "flow":
      return "s5";
    case "permission":
      return "s4";
    case "rule":
    case "capability":
    default:
      return "s1";
  }
}

/** Brechas simples (capability/rule/entity): respuesta instantánea sin LLM. */
export function shouldUseHeuristicFirst(gap: TraceabilityGapInput): boolean {
  const kind = gap.kind ?? "capability";
  return kind === "capability" || kind === "rule" || kind === "entity";
}

export function buildHeuristicTraceabilityFix(
  gap: TraceabilityGapInput,
  options?: { asFallback?: boolean },
): TraceabilitySuggestFixResponse {
  const targetSection = defaultTargetForKind(gap.kind);
  const label = gap.concept.slice(0, 120);
  const terms = (gap.missingTerms ?? []).slice(0, 4).join(", ");
  const loc = gap.brdSubsection
    ? `${gap.brdSubsection} (${gap.brdSection ?? "BRD"})`
    : (gap.brdSection ?? "BRD");

  let suggestion = "";
  if (targetSection === "s1") {
    suggestion = `- **${label}** (trazabilidad desde BRD: ${loc})${terms ? `: refleja ${terms}` : ""}.`;
  } else if (targetSection === "s4") {
    suggestion = `| Método | Ruta | Descripción |\n| --- | --- | --- |\n| GET | /api/v1/... | ${label}${terms ? ` (${terms})` : ""} |`;
  } else {
    suggestion = `- **Regla / lógica:** ${label}${terms ? ` — términos clave: ${terms}` : ""}.`;
  }

  return {
    suggestion,
    targetSection,
    insertMode: "append",
    rationale: options?.asFallback
      ? "Sugerencia heurística (el modelo no devolvió JSON válido)."
      : "Sugerencia heurística inmediata (sin LLM).",
  };
}

export function extractBrdExcerptForGap(brdText: string, gap: TraceabilityGapInput): string {
  const brd = (brdText ?? "").trim();
  if (!brd) return "";

  const needles = [
    gap.brdSubsection?.trim(),
    gap.concept.trim(),
    gap.brdSection?.trim(),
  ].filter((n): n is string => !!n && n.length > 2);

  for (const needle of needles) {
    const idx = brd.toLowerCase().indexOf(needle.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 600);
      const end = Math.min(brd.length, idx + needle.length + 1400);
      return brd.slice(start, end).trim();
    }
  }

  if (gap.brdSection) {
    const h2 = brd.match(new RegExp(`^##\\s+[^\\n]*${escapeRegExp(gap.brdSection.slice(0, 24))}[^\\n]*`, "im"));
    if (h2?.index != null) {
      return brd.slice(h2.index, h2.index + 2000).trim();
    }
  }

  return brd.slice(0, SLICE);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMddTraceSections(mddText: string): {
  s1: string;
  s4: string;
  s5: string;
  corpus: string;
} {
  const md = (mddText ?? "").trim();
  const corpus = extractMddTraceabilityCorpus(md);
  const lines = corpus.split("\n");
  const s1: string[] = [];
  const s4: string[] = [];
  const s5: string[] = [];
  let current: "s1" | "s4" | "s5" | null = null;

  for (const line of lines) {
    if (/^##\s*(?:1\.\s*)?(?:contexto\s+y\s+alcance|contexto\b)/i.test(line)) {
      current = "s1";
      s1.push(line);
      continue;
    }
    if (/^##\s*(?:4\.\s*)?(?:contratos\s+de\s+api|contratos\s+api|api\b)/i.test(line)) {
      current = "s4";
      s4.push(line);
      continue;
    }
    if (/^##\s*(?:5\.\s*)?(?:l[oó]gica|logic)/i.test(line)) {
      current = "s5";
      s5.push(line);
      continue;
    }
    if (current === "s1") s1.push(line);
    else if (current === "s4") s4.push(line);
    else if (current === "s5") s5.push(line);
  }

  return {
    s1: s1.join("\n").trim(),
    s4: s4.join("\n").trim(),
    s5: s5.join("\n").trim(),
    corpus,
  };
}

export async function suggestTraceabilityFixWithLlm(
  llm: BaseChatModel,
  input: {
    gap: TraceabilityGapInput;
    brdExcerpt: string;
    mddSections: ReturnType<typeof extractMddTraceSections>;
  },
): Promise<TraceabilitySuggestFixResponse> {
  const gap = input.gap;
  const missing = (gap.missingTerms ?? []).slice(0, 8).join(", ");

  const prompt = `Eres arquitecto de software en The Forge. Debes proponer un **parche markdown mínimo** para cerrar una brecha de trazabilidad BRD → MDD.

## Brecha
- Concepto BRD: ${gap.concept}
- Tipo: ${gap.kind ?? "capability"}
- Severidad: ${gap.severity ?? "missing"}
- Sección BRD: ${gap.brdSection ?? "(no indicada)"}
- Subsección BRD: ${gap.brdSubsection ?? "(no indicada)"}
- Términos sin reflejar en MDD: ${missing || "(ninguno listado)"}
- Pista: ${gap.hint ?? "(sin pista)"}

## Extracto BRD relevante
${input.brdExcerpt.slice(0, SLICE) || "(vacío)"}

## MDD actual (solo §1, §4, §5)
### ${SECTION_LABEL.s1}
${input.mddSections.s1.slice(0, 3500) || "(vacío o ausente)"}

### ${SECTION_LABEL.s4}
${input.mddSections.s4.slice(0, 3500) || "(vacío o ausente)"}

### ${SECTION_LABEL.s5}
${input.mddSections.s5.slice(0, 3500) || "(vacío o ausente)"}

## Reglas
1. Devuelve SOLO JSON: { "suggestion": string, "targetSection": "s1"|"s4"|"s5", "insertMode": "append", "rationale": string }
2. \`suggestion\`: markdown listo para **añadir al final** de la sección indicada (sin repetir el heading ##).
3. Elige \`targetSection\`:
   - s1: contexto de negocio, capacidades, alcance funcional.
   - s4: endpoints, contratos API, permisos expuestos vía API.
   - s5: reglas, fórmulas, flujos, UAT, entidades en lógica.
4. Sé conciso (1–8 líneas o una tabla pequeña). Español. No inventes stack distinto al MDD existente.
5. \`insertMode\` siempre "append".`;

  try {
    const response = await llm.invoke([new HumanMessage(prompt)]);
    const text = typeof response.content === "string" ? response.content : "";
    const jsonStr = extractFirstJsonObject(text);
    if (!jsonStr) {
      return buildHeuristicTraceabilityFix(gap, { asFallback: true });
    }
    const parsed = parseJsonOrThrow(jsonStr, traceabilitySuggestFixResponseSchema);
    const suggestion = parsed.suggestion.trim();
    if (!suggestion) {
      return buildHeuristicTraceabilityFix(gap, { asFallback: true });
    }
    return {
      suggestion,
      targetSection: parsed.targetSection,
      insertMode: "append",
      rationale: parsed.rationale?.trim() || undefined,
    };
  } catch {
    return buildHeuristicTraceabilityFix(gap, { asFallback: true });
  }
}
