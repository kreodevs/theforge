import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import type { MddQualityGateGap, MddQualityGateResult } from "@theforge/shared-types";
import { z } from "zod";
import type { MDDStateType } from "../state/index.js";
import { parseJsonOrThrow } from "../utils/parse-json.js";
import { getInternalDirectivesContext } from "../utils/mdd-mesh-topology.js";
import { domainInventoryPromptBlock } from "../utils/mdd-domain-prompt.util.js";
import { truncateDraftForAuditorLlm } from "../utils/mdd-auditor-gaps.util.js";
import {
  buildMddQualityGateResult,
  runDeterministicMddQualityGate,
  shouldSkipLlmQualityGate,
} from "../utils/mdd-quality-gate.util.js";

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:QualityGate] ${msg}`, ...args);

const QUALITY_GATE_LLM_PROMPT =
  "Eres el Quality Gate del MDD (pipeline lean). Revisa el borrador y detecta huecos de calidad " +
  "por sección que requieran regeneración. Responde SOLO con JSON en español: " +
  '{ "gaps": [{ "section": "Sección N", "issue": "...", "fix": "..." }] }. ' +
  "Si no hay huecos adicionales, devuelve { \"gaps\": [] }. NO uses tags de razonamiento.";

const qualityGateGapSchema = z.object({
  section: z.string().optional().default("General"),
  issue: z.string().optional().default(""),
  fix: z.string().optional().default(""),
});

const qualityGateLlmOutputSchema = z.object({
  gaps: z.array(qualityGateGapSchema).optional().default([]),
});

export type MddQualityGateNodeOutput = {
  qualityGate: MddQualityGateResult;
};

function normalizeLlmGaps(raw: z.infer<typeof qualityGateLlmOutputSchema>): MddQualityGateGap[] {
  return raw.gaps
    .filter((g) => g.issue.trim().length > 0 || g.fix.trim().length > 0)
    .map((g) => ({
      section: g.section.trim() || "General",
      issue: g.issue.trim(),
      fix: g.fix.trim() || "Revisión manual requerida",
    }));
}

/**
 * Quality Gate lean: paso 1 determinista, paso 2 LLM opcional (tier B), paso 3 `{ ok, blockers, gaps }`.
 * `ok === true` cuando `blockers.length === 0` (sin umbrales 85/90).
 */
export function createMddQualityGateNode(llm?: BaseChatModel) {
  return async (state: MDDStateType): Promise<MddQualityGateNodeOutput> => {
    const draft = (state.mddDraft ?? "").trim();
    LOG("entry mddDraftLen=%s llm=%s", draft.length, Boolean(llm));

    const deterministic = runDeterministicMddQualityGate(draft, {
      brdMarkdown: state.brdContent,
      dbgaMarkdown: state.dbgaContent,
    });

    if (shouldSkipLlmQualityGate(deterministic) || !llm) {
      LOG(
        "deterministic pass (blockers=%s gaps=%s) → sin LLM",
        deterministic.blockers.length,
        deterministic.gaps.length,
      );
      return { qualityGate: buildMddQualityGateResult(deterministic) };
    }

    try {
      const draftForLlm = truncateDraftForAuditorLlm(draft);
      let prompt =
        `${QUALITY_GATE_LLM_PROMPT}\n\n---\n**Borrador del MDD:**\n${draftForLlm || "(vacío)"}\n\n` +
        `${getInternalDirectivesContext(state, "quality_gate")}`;
      const inventoryBlock = domainInventoryPromptBlock(state);
      if (inventoryBlock) {
        prompt +=
          inventoryBlock +
          "\n\n**Criterio domain-auth-only-skew:** Si el inventario tiene ≥3 capacidades de negocio y §3 solo lista tablas auth, registra gap con fix para ampliar §3/§4 al dominio.";
      }

      const response = await llm.invoke([new HumanMessage(prompt)]);
      const content = typeof response.content === "string" ? response.content : "";

      if (!content.trim()) {
        LOG("sin respuesta LLM → solo determinístico");
        return { qualityGate: buildMddQualityGateResult(deterministic) };
      }

      const parsed = parseJsonOrThrow(content, qualityGateLlmOutputSchema) as z.infer<
        typeof qualityGateLlmOutputSchema
      >;
      const llmGaps = normalizeLlmGaps(parsed);
      const qualityGate = buildMddQualityGateResult(deterministic, llmGaps);

      LOG(
        "ok=%s blockers=%s gaps=%s (llm=%s)",
        qualityGate.ok,
        qualityGate.blockers.length,
        qualityGate.gaps.length,
        llmGaps.length,
      );
      return { qualityGate };
    } catch (err) {
      LOG(
        "error LLM: %s — fallback determinístico",
        err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      );
      return { qualityGate: buildMddQualityGateResult(deterministic) };
    }
  };
}
