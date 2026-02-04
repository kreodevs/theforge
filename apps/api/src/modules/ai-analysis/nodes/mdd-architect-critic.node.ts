import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { ARCHITECT_CRITIC_MDD_PROMPT } from "../prompts/load-prompts.js";
import type { MDDStateType } from "../state/index.js";
import { extractSection3Body, extractSection4Body } from "../utils/mdd-sanitize.js";
import { getUserExplicitRequirements } from "../utils/mdd-user-brief.js";
import { extractFirstJsonObject } from "../utils/parse-json.js";
import { z } from "zod";

const criticOutputSchema = z.object({
  verdict: z.enum(["ok", "gap"]),
  gaps: z.array(z.string()).optional(),
});

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:ArchitectCritic] ${msg}`, ...args);

/**
 * Nodo Architect Critic (Reflection): verifica si §3 y §4 del MDD cumplen la directiva del usuario.
 * Si verdict === "gap", escribe architectCriticFeedback e incrementa architectCriticAttempts; el grafo puede volver a software_architect una vez.
 * Si verdict === "ok" o ya se hizo un reintento, sigue a format_after_architect.
 */
export function createMddArchitectCriticNode(llm: BaseChatModel) {
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const directive = state.acceptedProposalDirective?.trim();
    const explicitReqs = getUserExplicitRequirements(state);
    const draft = (state.mddDraft ?? "").trim();

    if (!directive && !explicitReqs) {
      LOG("sin directiva ni requisitos explícitos, omitir critic");
      return {
        architectCriticFeedback: undefined,
        architectCriticAttempts: (state.architectCriticAttempts ?? 0) + 1,
      };
    }

    const section3 = extractSection3Body(draft);
    const section4 = extractSection4Body(draft);
    const fragment = [section3 ? `## 3. Modelo de Datos\n\n${section3}` : "", section4 ? `## 4. Contratos de API\n\n${section4}` : ""]
      .filter(Boolean)
      .join("\n\n");
    if (!fragment || fragment.length < 50) {
      LOG("fragmento §3+§4 insuficiente, omitir critic");
      return {
        architectCriticFeedback: undefined,
        architectCriticAttempts: (state.architectCriticAttempts ?? 0) + 1,
      };
    }

    const directiveBlock = [directive, explicitReqs].filter(Boolean).join("\n\n");
    const context = `**Directiva o requisitos del usuario:**\n${directiveBlock}\n\n**Fragmento de MDD recién generado (§3 y §4):**\n${fragment.slice(0, 6000)}`;
    const prompt = `${ARCHITECT_CRITIC_MDD_PROMPT}\n\n---\n${context}`;

    const attempts = (state.architectCriticAttempts ?? 0) + 1;
    const fallbackGapFeedback =
      "No se pudo verificar §3 y §4 automáticamente. Revisa que la directiva del usuario (modelo de datos, entidades, roles, aplicaciones, contratos API) esté aplicada en el SQL, diagrama ER y sección 4.";
    try {
      const response = await llm.invoke([new HumanMessage(prompt)]);
      const text = typeof response.content === "string" ? response.content : "";
      const raw = extractFirstJsonObject(text);
      const parsed = criticOutputSchema.safeParse(raw);
      if (!parsed.success) {
        LOG("parse critic output failed, treating as gap for one retry");
        if (attempts <= 1) {
          return {
            architectCriticFeedback: fallbackGapFeedback,
            architectCriticAttempts: attempts,
          };
        }
        return { architectCriticFeedback: undefined, architectCriticAttempts: attempts };
      }
      const { verdict, gaps } = parsed.data;
      if (verdict === "gap" && Array.isArray(gaps) && gaps.length > 0 && attempts <= 1) {
        const feedback = gaps.join("\n");
        LOG("verdict=gap attempts=%s feedback=%s", attempts, feedback.slice(0, 80));
        return {
          architectCriticFeedback: feedback,
          architectCriticAttempts: attempts,
        };
      }
      LOG("verdict=ok o attempts>1, seguir");
      return {
        architectCriticFeedback: undefined,
        architectCriticAttempts: attempts,
      };
    } catch (err) {
      LOG("critic error: %s", err instanceof Error ? err.message : String(err));
      if (attempts <= 1) {
        return {
          architectCriticFeedback: fallbackGapFeedback,
          architectCriticAttempts: attempts,
        };
      }
      return { architectCriticFeedback: undefined, architectCriticAttempts: attempts };
    }
  };
}
