import type { DBGAState } from "./dbga-state.schema.js";

const AGENT_LABELS: Record<string, string> = {
  scout: "Market Scout (investigación)",
  auditor: "Tech Auditor (análisis técnico)",
  critic: "Critic (validación)",
  synthesis: "Synthesis (documento final)",
  // MDD pipeline
  manager: "Manager (entrevista)",
  ask_initial_topic: "Manager (pregunta inicial)",
  plan_approval: "Aprobación del plan",
  executor: "Executor (plan paso a paso)",
  clarifier: "Clarificador (MDD)",
  software_architect: "Arquitecto de Software",
  security: "Arquitecto de Seguridad",
  integration: "Ingeniero de Integración",
  redactor: "Redactor (MDD)",
  // "auditor" ya existe para DBGA; para MDD el nodo se llama "auditor" pero el mensaje es distinto
};

const MDD_AUDITOR_LABEL = "Auditor (calidad MDD)";

/**
 * Post-procesa el markdown para asegurar que bloques JSON sueltos (sin ```json)
 * tengan code fences. Detecta líneas que inician con `{` y contienen JSON válido.
 */
export function ensureJsonCodeFences(markdown: string): string {
  // No procesar si ya está dentro de un bloque de código
  const lines = markdown.split("\n");
  const result: string[] = [];
  let insideFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      insideFence = !insideFence;
      result.push(line);
      continue;
    }
    if (insideFence) {
      result.push(line);
      continue;
    }
    // Detectar bloque JSON: línea que empieza con `{` y no está ya en ```json
    const trimmed = line.trim();
    if (trimmed === "{" || trimmed.startsWith('{') && trimmed.length > 1) {
      // Buscar el cierre del bloque JSON (llave balanceada)
      let depth = 0;
      let endIdx = i;
      let started = false;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        if (/^```/.test(l.trim())) break; // otro fence antes de cerrar JSON
        for (const ch of l) {
          if (ch === "{") { depth++; started = true; }
          else if (ch === "}") { depth--; }
        }
        if (started && depth === 0) { endIdx = j; break; }
      }
      if (started && depth === 0 && endIdx > i) {
        // Verificar que el bloque sea JSON válido
        const jsonBlock = lines.slice(i, endIdx + 1).join("\n");
        try {
          JSON.parse(jsonBlock);
          result.push("```json");
          result.push(jsonBlock);
          result.push("```");
          i = endIdx;
          continue;
        } catch {
          // No es JSON válido, pasar como está
        }
      }
    }
    result.push(line);
  }
  return result.join("\n");
}

/**
 * Genera el documento markdown final del DBGA a partir del estado del grafo.
 * Incluye idea, competidores, tech stack, pain points y el gap analysis (markdown del Synthesis).
 */
export function stateToMarkdown(state: DBGAState): string {
  const sections: string[] = [];

  sections.push("# Domain Benchmark & Gap Analysis\n");
  sections.push(`**Idea:** ${state.rawIdea || "(sin especificar)"}\n`);

  if (state.competitors?.length > 0) {
    sections.push("## Competidores de referencia\n");
    for (const c of state.competitors) {
      sections.push(`- **${c.name}** — ${c.url}`);
      if (c.uvp) sections.push(`  - UVP: ${c.uvp}`);
      if (c.pricing) sections.push(`  - Precio: ${c.pricing}`);
      if (c.marketShare) sections.push(`  - Mercado: ${c.marketShare}`);
      sections.push("");
    }
  }

  if (state.techStackInsights?.length > 0) {
    sections.push("## Tech stack observado\n");
    state.techStackInsights.forEach((s) => sections.push(`- ${s}`));
    sections.push("");
  }

  if (state.userPainPoints?.length > 0) {
    sections.push("## Pain points del usuario\n");
    state.userPainPoints.forEach((p) => sections.push(`- ${p}`));
    sections.push("");
  }

  if (state.gapAnalysis?.trim()) {
    sections.push("---\n");
    sections.push(state.gapAnalysis.trim());
  } else {
    sections.push("---\n\n(Sin análisis de brechas generado.)");
  }

  return ensureJsonCodeFences(sections.join("\n").trim());
}

export function getAgentLabel(nodeName: string, context?: "mdd"): string {
  if (context === "mdd" && nodeName === "auditor") return MDD_AUDITOR_LABEL;
  return AGENT_LABELS[nodeName] ?? nodeName;
}
