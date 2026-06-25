/**
 * IntegrationAgent — redactor node (Plan-then-Execute).
 *
 * NOTE: this is NOT a LangGraph StateGraph node. The handoff-spec.md is a *separate*
 * deliverable (not part of the MDD draft), so the agent runs as a dedicated redactor
 * invoked by `IntegrationAgentService` (on user "Sincronizar Especificación de Handoff"
 * or via the Manager intent hook). It keeps the `*.node.ts` naming for consistency with
 * the agent catalog and lives in `ai-analysis/nodes` per the agent module convention.
 *
 * Governance ("Regla de Oro"): the agent ONLY structures and technically deepens the
 * NEW-LEG handoff items already registered by the user. It never invents items.
 */

import type { IntegrationHandoffItem } from "@theforge/shared-types";
import type { LLMProvider } from "../../ai/interfaces/llm-provider.interface.js";
import { INTEGRATION_AGENT_PROMPT } from "../../ai/prompts/integration-agent-prompt.js";
import type { TheForgeService } from "../../theforge/theforge.service.js";

/** Evidence gathered from AriadneSpecs (the legacy knowledge graph) for one handoff item. */
export interface HandoffItemEvidence {
  newLegId: string;
  /** Candidate symbols/nodes the agent probed in the graph. */
  probedSymbols: string[];
  /** Concatenated tool output (validate_before_edit / get_contract_specs / semantic_search). */
  evidence: string;
}

export interface IntegrationAgentInput {
  llm: LLMProvider;
  /** Null when TheForge MCP is not configured or the project is not legacy-linked. */
  theforge: TheForgeService | null;
  /** Stored TheForge project id for the LEGACY repo (resolves to graph project internally). */
  theforgeProjectId?: string | null;
  items: IntegrationHandoffItem[];
  legacyProjectName: string;
  newProjectName?: string | null;
  /** MDD §3 (data model) excerpt for the active stage. */
  mddSection3?: string;
  /** MDD §4 (API / contracts) excerpt for the active stage. */
  mddSection4?: string;
  /** AS-IS legacy context block (optional). */
  asIsContext?: string;
}

export interface IntegrationAgentResult {
  markdown: string;
  evidence: HandoffItemEvidence[];
  /** Items that produced no graph evidence (flagged for manual verification in the doc). */
  itemsWithoutEvidence: string[];
}

const MAX_ITEMS_PROBED = 12;
const MAX_SYMBOLS_PER_ITEM = 2;
const MAX_EVIDENCE_CHARS_PER_ITEM = 2400;

/** PascalCase / camelCase identifiers and back-tick / quoted symbols from free text. */
export function extractCandidateSymbols(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();

  const quoted = text.match(/[`"']([A-Za-z_][\w.]{2,60})[`"']/g);
  if (quoted) {
    for (const q of quoted) {
      const inner = q.slice(1, -1).trim();
      if (inner) found.add(inner);
    }
  }

  const pascal = text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+\b/g);
  if (pascal) pascal.forEach((n) => found.add(n));

  const suffixed = text.match(
    /\b[A-Za-z][A-Za-z0-9]*(?:Controller|Service|Component|Repository|Entity|Model|Dto|Endpoint|Schema|Table|Field|Module|Resolver|Handler)\b/g,
  );
  if (suffixed) suffixed.forEach((n) => found.add(n));

  return [...found].slice(0, MAX_SYMBOLS_PER_ITEM);
}

/**
 * EXECUTE phase: probe the legacy graph for real technical impact of one item.
 * Tries `validate_before_edit` per candidate symbol; falls back to `semantic_search`.
 */
async function gatherEvidenceForItem(
  item: IntegrationHandoffItem,
  theforge: TheForgeService,
  theforgeProjectId: string,
): Promise<HandoffItemEvidence> {
  const symbols = extractCandidateSymbols(`${item.title}\n${item.description}`);
  const parts: string[] = [];

  for (const symbol of symbols) {
    try {
      const out = await theforge.validateBeforeEdit(symbol, theforgeProjectId);
      if (out?.trim()) parts.push(`#### validate_before_edit(${symbol})\n${out.trim()}`);
    } catch {
      // Tool unavailable for this symbol — continue.
    }
  }

  if (parts.length === 0) {
    try {
      const query = `${item.title}. ${item.description}`.slice(0, 240);
      const out = await theforge.semanticSearch(query, theforgeProjectId, 6);
      if (out?.trim()) parts.push(`#### semantic_search\n${out.trim()}`);
    } catch {
      // No evidence available.
    }
  }

  const evidence = parts.join("\n\n").slice(0, MAX_EVIDENCE_CHARS_PER_ITEM);
  return { newLegId: item.id, probedSymbols: symbols, evidence };
}

function renderItemBlock(item: IntegrationHandoffItem, ev: HandoffItemEvidence | undefined): string {
  const lines: string[] = [];
  lines.push(`### ${item.id} — ${item.title}`);
  lines.push(`- **Propuesta (NEW):** ${item.description}`);
  if (item.actor) lines.push(`- **Actor:** ${item.actor}`);
  if (item.acceptanceCriteria?.length) {
    lines.push(`- **Criterios de aceptación (propuestos):**`);
    item.acceptanceCriteria.forEach((c) => lines.push(`  - ${c}`));
  }
  if (item.legacyStoryId) lines.push(`- **Historia legacy enlazada:** ${item.legacyStoryId}`);
  if (ev?.evidence?.trim()) {
    lines.push(`- **Evidencia AriadneSpecs** (símbolos: ${ev.probedSymbols.join(", ") || "—"}):`);
    lines.push("");
    lines.push(ev.evidence.trim());
  } else {
    lines.push(`- **Evidencia AriadneSpecs:** Sin evidencia en el grafo — requiere verificación manual.`);
  }
  return lines.join("\n");
}

/** Builds the context block appended below the system prompt for the LLM redactor. */
export function buildIntegrationAgentContext(
  input: IntegrationAgentInput,
  evidence: HandoffItemEvidence[],
): string {
  const evByItem = new Map(evidence.map((e) => [e.newLegId, e]));
  const sections: string[] = [];

  sections.push(`## PROYECTOS`);
  sections.push(`- LEGACY (destino): ${input.legacyProjectName}`);
  if (input.newProjectName) sections.push(`- NEW (origen de las propuestas): ${input.newProjectName}`);

  if (input.mddSection3?.trim()) {
    sections.push(`## MDD §3 — Modelo de Datos (etapa activa)\n${input.mddSection3.trim()}`);
  }
  if (input.mddSection4?.trim()) {
    sections.push(`## MDD §4 — API / Contratos (etapa activa)\n${input.mddSection4.trim()}`);
  }
  if (input.asIsContext?.trim()) {
    sections.push(`## Contexto AS-IS del legacy\n${input.asIsContext.trim()}`);
  }

  sections.push(`## MATRIZ DE TRAZABILIDAD — Items NEW-LEG (alcance cerrado, NO inventar)`);
  for (const item of input.items) {
    sections.push(renderItemBlock(item, evByItem.get(item.id)));
  }

  sections.push(
    `## INSTRUCCIÓN\nRedacta el documento \`handoff-spec.md\` siguiendo el formato definido arriba. Usa exclusivamente los ${input.items.length} item(s) listados y su evidencia. No agregues items nuevos.`,
  );

  return sections.join("\n\n");
}

/**
 * PLAN → EXECUTE → SYNTHESIZE. Returns the handoff-spec markdown.
 * When there are no items, returns a minimal placeholder (governance: nothing to structure).
 */
export async function runIntegrationAgent(input: IntegrationAgentInput): Promise<IntegrationAgentResult> {
  const items = input.items.slice(0, MAX_ITEMS_PROBED);

  if (items.length === 0) {
    return {
      markdown: `# Handoff Spec — ${input.legacyProjectName}\n\n> No hay items NEW-LEG registrados en la pestaña de Integración para esta etapa. El IntegrationAgent no crea items por su cuenta: registra los cambios propuestos en la Matriz de Trazabilidad y vuelve a sincronizar.`,
      evidence: [],
      itemsWithoutEvidence: [],
    };
  }

  // EXECUTE: gather graph evidence per item (only when the MCP is configured).
  let evidence: HandoffItemEvidence[] = [];
  const canProbe = !!input.theforge?.isConfigured() && !!input.theforgeProjectId?.trim();
  if (canProbe) {
    const tfPid = input.theforgeProjectId!.trim();
    evidence = await Promise.all(items.map((item) => gatherEvidenceForItem(item, input.theforge!, tfPid)));
  }

  const itemsWithoutEvidence = items
    .filter((item) => !evidence.find((e) => e.newLegId === item.id)?.evidence?.trim())
    .map((item) => item.id);

  // SYNTHESIZE: LLM redactor with the closed-scope context.
  const context = buildIntegrationAgentContext({ ...input, items }, evidence);
  const raw = await input.llm.generateResponse(context, [], {
    systemPrompt: INTEGRATION_AGENT_PROMPT,
  });

  return {
    markdown: (raw ?? "").trim(),
    evidence,
    itemsWithoutEvidence,
  };
}
