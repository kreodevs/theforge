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

  return sections.join("\n").trim();
}

export function getAgentLabel(nodeName: string, context?: "mdd"): string {
  if (context === "mdd" && nodeName === "auditor") return MDD_AUDITOR_LABEL;
  return AGENT_LABELS[nodeName] ?? nodeName;
}
