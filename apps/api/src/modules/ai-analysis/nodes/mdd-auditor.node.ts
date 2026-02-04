import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { LivePrecisionCalculator } from "../estimation/estimation.types.js";
import { AUDITOR_MDD_PROMPT } from "../prompts/load-prompts.js";
import { mddAuditorDecisionSchema, type MDDStateType } from "../state/index.js";
import { parseJsonOrThrow } from "../utils/parse-json.js";
import { validateMddStructure } from "../utils/mdd-sanitize.js";
import { z } from "zod";

const SEMAPHORE_DONE_THRESHOLD = 95;

const auditorOutputSchema = z.object({
  auditorScore: z.number().min(0).max(100),
  auditorFeedback: z.string().optional().nullable(),
  auditorDecision: mddAuditorDecisionSchema,
});

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:Auditor] ${msg}`, ...args);
const MAX_TOOL_LOOPS = 2;

function buildToolsByName(tools: StructuredToolInterface[]): Record<string, StructuredToolInterface> {
  const byName: Record<string, StructuredToolInterface> = {};
  for (const t of tools) byName[t.name] = t;
  return byName;
}

/** Creates the MDD Auditor (quality) node. Optionally with tools and precisionCalculator (semáforo). 4.3: si state.currentStepAllowedTools está set, solo usa esas tools. */
export function createMddAuditorNode(
  llm: BaseChatModel,
  tools: StructuredToolInterface[] = [],
  precisionCalculator?: LivePrecisionCalculator | null,
) {
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const allowed = state.currentStepAllowedTools;
    const toolsToUse = allowed?.length ? tools.filter((t) => allowed.includes(t.name)) : tools;
    const toolsByName = buildToolsByName(toolsToUse);
    const llmWithTools = llm.bindTools && toolsToUse.length > 0 ? llm.bindTools(toolsToUse) : llm;

    LOG("entry mddDraftLen=%s tools=%s (allowed=%s)", (state.mddDraft ?? "").length, toolsToUse.length, allowed?.length ?? "all");
    try {
      const draft = (state.mddDraft ?? "").trim();
      let prompt = `${AUDITOR_MDD_PROMPT}\n\n---\n**Borrador completo del MDD:**\n${draft || "(vacío)"}`;
      if (toolsToUse.length > 0) {
        prompt +=
          "\n\n**Opcional:** Usa la tool validate_mdd_structure con el borrador anterior para obtener section3HasPayloads, missingSections, hasTechnicalMetadata e issues. Usa ese resultado para asignar auditorScore y auditorFeedback. Responde al final solo con el JSON { auditorScore, auditorFeedback, auditorDecision }.";
      }
      const messages = [new HumanMessage(prompt)];

      let lastContent = "";
      let loopCount = 0;

      while (loopCount < MAX_TOOL_LOOPS) {
        const response = await llmWithTools.invoke(messages);
        const aiMsg = response as AIMessage;
        lastContent = typeof aiMsg.content === "string" ? aiMsg.content : "";

        const toolCalls = aiMsg.tool_calls ?? [];
        if (toolCalls.length === 0) break;

        const toolMessages: ToolMessage[] = [];
        for (const tc of toolCalls) {
          const tool = toolsByName[tc.name];
          const toolCallId = tc.id ?? `tc-${loopCount}-${tc.name}`;
          if (!tool) {
            toolMessages.push(new ToolMessage({ content: `Unknown tool: ${tc.name}`, tool_call_id: toolCallId, status: "error" }));
            continue;
          }
          const args = typeof tc.args === "object" && tc.args !== null ? tc.args as Record<string, unknown> : {};
          const result = await tool.invoke(args);
          const content = typeof result === "string" ? result : JSON.stringify(result);
          toolMessages.push(new ToolMessage({ content, tool_call_id: toolCallId }));
        }
        messages.push(aiMsg, ...toolMessages);
        loopCount++;
      }

      let text = lastContent.trim();
      if (!text) {
        // Sin respuesta final: usar validación determinística para score/feedback
        const validation = validateMddStructure(draft);
        let score = 80;
        if (!validation.section3HasPayloads) score -= 20;
        if (!validation.hasTechnicalMetadata) score -= 5;
        if (validation.missingSections.length > 0) {
          score = Math.min(score, 94);
          score -= validation.missingSections.length * 5;
        }
        score = Math.max(0, Math.min(100, score));
        const decision =
          score >= SEMAPHORE_DONE_THRESHOLD && validation.missingSections.length === 0 ? "done" as const : "clarifier" as const;
        const iteration = (state.mddIteration ?? 0) + (decision === "clarifier" ? 1 : 0);
        const feedback =
          validation.issues.length > 0
            ? validation.issues.join(" ")
            : "Faltan: modelo de datos/entidades, contratos con payloads, decisiones de seguridad, estrategia de infraestructura.";
        LOG("sin respuesta LLM, usando validación determinística score=%s", score);
        return {
          auditorScore: score,
          auditorFeedback: feedback,
          auditorDecision: decision,
          mddIteration: iteration,
          delegateTarget: undefined,
          sectionsToRun: undefined,
          acceptedProposalDirective: undefined,
        };
      }

      const parsed = parseJsonOrThrow(text, auditorOutputSchema);
      let score = Math.min(100, Math.max(0, parsed.auditorScore));
      const validation = validateMddStructure(draft);

      // Estructura 7 secciones obligatoria: si faltan secciones, MDD no es válido (score < 95).
      if (validation.missingSections.length > 0) {
        score = Math.min(score, 94);
        const sectionsNote = "Secciones obligatorias faltantes: " + validation.missingSections.join(", ") + ". El MDD debe tener exactamente las 7 secciones canónicas.";
        const existing = (parsed.auditorFeedback ?? "").trim();
        parsed.auditorFeedback = existing ? existing + " " + sectionsNote : sectionsNote;
        LOG("missingSections=%s → score capped at 94", validation.missingSections.join(";"));
      }

      if (tools.length > 0 && !validation.section3HasPayloads && score > 20) {
        score = Math.min(score, 79);
        if (!parsed.auditorFeedback?.includes("Contratos de API")) {
          parsed.auditorFeedback = (parsed.auditorFeedback ?? "").trim() + " Sección 3. Contratos de API: debe incluir endpoints con request/response en ```json.";
        }
      }

      // Alinear con semáforo (reglas universales): si el semáforo marca < 95%, es la fuente de verdad.
      if (precisionCalculator && draft.length > 100) {
        const metrics = precisionCalculator.calculateLiveMetrics(draft);
        if (metrics.precision < SEMAPHORE_DONE_THRESHOLD) {
          score = metrics.precision;
          const semaphoreNote =
            ` El semáforo de consistencia marca ${metrics.precision}%; se requieren correcciones según las reglas universales (alcance↔modelo de datos, integridad SQL, contradicciones entre secciones, manifest de infra) para llegar a 95%.`;
          const existingFeedback = (parsed.auditorFeedback ?? "").trim();
          parsed.auditorFeedback = existingFeedback ? existingFeedback + semaphoreNote : semaphoreNote.trim();
          LOG("semáforo precision=%s < 95 → score y feedback alineados al semáforo", metrics.precision);
        }
      }

      const decision =
        score >= SEMAPHORE_DONE_THRESHOLD && validation.missingSections.length === 0
          ? "done" as const
          : (parsed.auditorDecision === "clarifier" ? "clarifier" : "clarifier");
      const iteration = (state.mddIteration ?? 0) + (decision === "clarifier" ? 1 : 0);
      const feedback =
        parsed.auditorFeedback?.trim() ||
        (score < SEMAPHORE_DONE_THRESHOLD
          ? "Faltan: modelo de datos/entidades con tipos y relaciones, contratos u operaciones con entrada/salida, decisiones de seguridad, estrategia de infraestructura/despliegue. Genera preguntas para cubrir estos huecos."
          : undefined);
      LOG("ok score=%s decision=%s iteration=%s feedback=%s", score, decision, iteration, feedback ? "(presente)" : "(no)");
      return {
        auditorScore: score,
        auditorFeedback: feedback,
        auditorDecision: decision,
        mddIteration: iteration,
        delegateTarget: undefined,
        sectionsToRun: undefined,
        acceptedProposalDirective: undefined,
      };
    } catch (err) {
      LOG("error: %s", err instanceof Error ? err.message : String(err));
      throw err;
    }
  };
}
