/**
 * Nodo "section5" — regenera SOLO `## 5. Lógica y Edge Cases` del MDD.
 *
 * Por qué existe: el delivery gate (validateMddForDelivery) tiene un
 * substance check que detecta secciones en (Pendiente) o con cuerpo < 200
 * chars. Cuando el ÚNICO substance blocker es §5, no tiene sentido
 * re-correr todo `software_architect` (que regenera §2/§3/§4/§5 juntos y
 * puede volver a fallar en §5). Este nodo enfoca el LLM en §5 con un
 * prompt dedicado, y reusa el resto del draft sin tocarlo.
 *
 * Disparado por el delivery gate loop cuando `deliveryGateFixTarget === "section5"`.
 * Ver CHANGELOG [Unreleased] → Added → "Dedicated §5 pass".
 */
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { SECTION5_MDD_PROMPT } from "../prompts/load-prompts.js";
import type { MDDStateType } from "../state/index.js";
import { getUserBrief } from "../utils/mdd-user-brief.js";
import { getInternalDirectivesContext } from "../utils/mdd-mesh-topology.js";
import { extractLlmText, invokeLlmWithRetry } from "../utils/mdd-llm-retry.util.js";
import {
  extractSection5Body,
  getMddDraftSummary,
  logMddNodeOutput,
  replaceMddSection5Body,
  sanitizeContextSection,
  stripInstructionAndFeedbackBlocks,
} from "../utils/mdd-sanitize.js";
import { isMddSectionPipelinePlaceholderBody } from "../utils/mdd-sanitize/section-merge.js";
import { stripThinkingTags } from "../utils/mdd-security-parse.js";

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:Section5] ${msg}`, ...args);

/** Crea el nodo section5. Retorna el nuevo mddDraft con §5 regenerada;
 *  el resto del MDD queda intacto. Si el LLM devuelve vacío tras retries,
 *  no toca el draft (deja que el loop lo marque como loop=true y avise). */
export function createMddSection5Node(llm: BaseChatModel) {
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const currentDraft = (state.mddDraft ?? "").trim();
    const section5Now = extractSection5Body(currentDraft);
    const section5Len = section5Now?.length ?? 0;
    LOG(
      "entry draftLen=%s section5Len=%s section5IsPlaceholder=%s",
      currentDraft.length,
      section5Len,
      section5Now ? isMddSectionPipelinePlaceholderBody(section5Now) : "n/a",
    );

    try {
      const brief = getUserBrief(state);
      const briefBlock = brief ? `**Objetivo del documento (contexto):** ${brief}\n\n` : "";
      const scope = (state.clarifiedScope ?? "").trim();
      const scopeBlock = scope ? `**Alcance clarificado:** ${scope.slice(0, 2000)}\n\n` : "";

      // DBGA: lista de capacidades de negocio (el LLM las referencia en las reglas BDD/AAA)
      const dbgaCore = (state.dbgaContent ?? "").trim();
      const dbgaBlock = dbgaCore ? `**Capacidades de negocio (DBGA):**\n${dbgaCore.slice(0, 3000)}\n\n` : "";

      // Draft truncado: el LLM necesita ver §1-§4 y §6-§7 para no contradecirlos.
      // §5 (la que va a regenerar) la enmascaramos para que el LLM no caiga en "ya hay contenido".
      const draftForLlm = currentDraft.length > 8000
        ? currentDraft.slice(0, 4000) + "\n\n...(truncado)...\n\n" + currentDraft.slice(currentDraft.length - 4000)
        : currentDraft;
      const draftBlock = `**Borrador actual del MDD (referencia; regenera SOLO ## 5):**\n${draftForLlm}\n\n`;

      const directivesBlock = getInternalDirectivesContext(state, "section5");

      const prompt = `${SECTION5_MDD_PROMPT}\n\n---\n${briefBlock}${scopeBlock}${dbgaBlock}${draftBlock}${directivesBlock ? `---\n${directivesBlock}\n\n` : ""}`;

      const response = await invokeLlmWithRetry(llm, [new HumanMessage(prompt)], { tag: "Section5" });
      if (!response) {
        LOG("LLM sin respuesta tras reintentos — preservando draft actual");
        return {};
      }
      const raw = stripThinkingTags(extractLlmText(response));
      if (!raw.trim()) {
        LOG("LLM vacío, preservando draft actual");
        return {};
      }

      // Limpiar fences markdown que el LLM a veces envuelve la respuesta
      let cleaned = raw
        .replace(/^```(?:markdown)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();

      // Extraer solo el bloque ## 5. … hasta el siguiente ## N. (o fin). Si el LLM incluyó
      // texto antes/después, lo recortamos — sólo queremos el bloque de §5.
      const startMatch = cleaned.match(/^##\s*5\.\s*Lógica\s+y\s*Edge\s+Cases\s*$/im);
      if (startMatch?.index != null) {
        const after = cleaned.slice(startMatch.index + startMatch[0].length);
        const nextH2 = after.search(/\n##\s+\d/);
        cleaned = (nextH2 !== -1 ? after.slice(0, nextH2) : after).trim();
      } else {
        // El LLM no devolvió el heading. Reintentamos con un wrap silencioso: prependerlo.
        LOG("LLM no devolvió heading ## 5 — prepending y re-trim");
        cleaned = cleaned.replace(/^#+\s*5\.\s*Lógica\s+y\s*Edge\s+Cases\s*/im, "").trim();
        cleaned = `## 5. Lógica y Edge Cases\n\n${cleaned}`;
      }

      cleaned = stripInstructionAndFeedbackBlocks(cleaned);
      cleaned = sanitizeContextSection(cleaned);

      if (!cleaned || isMddSectionPipelinePlaceholderBody(cleaned)) {
        LOG("body regenerado es placeholder — preservando draft actual");
        return {};
      }

      if (cleaned.length < 100) {
        LOG("body regenerado demasiado corto (%d chars) — preservando draft actual", cleaned.length);
        return {};
      }

      const merged = replaceMddSection5Body(currentDraft, cleaned);
      const sum = getMddDraftSummary(merged);
      LOG("ok nueva §5 len=%s totalDraftLen=%s section2=%s", cleaned.length, sum.length, sum.section2);
      logMddNodeOutput("Section5", merged);
      return { mddDraft: merged };
    } catch (err) {
      LOG("error: %s", err instanceof Error ? err.message : String(err));
      // No tirar el draft — preservar el estado y dejar que el loop lo marque.
      return {};
    }
  };
}
