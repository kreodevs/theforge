import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { CLARIFIER_MDD_PROMPT, CLARIFIER_QUESTIONS_ONLY_MDD_PROMPT } from "../prompts/load-prompts.js";
import type { MDDStateType } from "../state/index.js";
import { mergeMddStructured } from "../utils/mdd-merge-structured.js";
import { getMddDraftSummary, extractAlreadyDocumentedTopics, extractIdentifiedInfraFromText, logMddNodeOutput } from "../utils/mdd-sanitize.js";
import { getUserBrief } from "../utils/mdd-user-brief.js";
import { extractFirstJsonObject, extractJsonFromCodeBlock, parseJsonOrThrowWithMeta } from "../utils/parse-json.js";
import { clarifierComplexityAppendix } from "../utils/mdd-complexity-rigor.js";
import { domainInventoryPromptBlock } from "../utils/mdd-domain-prompt.util.js";
import { extractBrdDigest } from "../utils/extract-brd-digest.js";
import { buildMddDraftFromClarifierOutput } from "../utils/merge-section1-into-template.js";
import { stripThinkingTags } from "../utils/mdd-security-parse.js";
import type { MddFlowTraceOpts } from "../mdd/mdd-flow-trace.service.js";
import { z } from "zod";

/** Acepta string o objeto (el LLM a veces devuelve objeto); normaliza a string. */
function toScopeString(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const obj = x as Record<string, unknown>;
    const key = ["content", "text", "scope", "summary", "clarifiedScope", "contextoAlcance"].find((k) => typeof obj[k] === "string");
    if (key) return String(obj[key]);
  }
  return typeof x === "object" ? JSON.stringify(x, null, 2) : String(x);
}

const stringOrObject = z
  .union([z.string(), z.record(z.unknown()), z.array(z.unknown())])
  .transform(toScopeString)
  .pipe(z.string());

const clarifierOutputSchema = z.object({
  clarifiedScope: stringOrObject,
  contextoAlcance: stringOrObject,
  title: z.string().optional(),
});

/** Tipo de salida tras parse (stringOrObject se transforma a string). */
type ClarifierParsed = z.output<typeof clarifierOutputSchema>;

const questionsOnlySchema = z.object({
  questions: z.array(z.string()).min(1).max(2),
});

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:Clarifier] ${msg}`, ...args);

const JSON_RETRY_SUFFIX =
  "\n\n**IMPORTANTE:** Responde ÚNICAMENTE JSON válido sin thinking ni markdown.";

const CLARIFIER_PARSE_ERROR = "Clarifier no pudo estructurar el alcance del BRD";

type ClarifierParseMeta = {
  source: "direct" | "local_repair" | "llm_retry" | "llm_retry_repair";
  escapeRepaired: boolean;
  llmRetry: boolean;
};

/** §2 con contenido real (no solo «(Pendiente)» del esqueleto ~800 chars). */
function hasSubstantialSection2Body(draft: string): boolean {
  const match = draft.match(/##\s*2\.\s*Arquitectura[\s\S]*?(?=##\s*3\.|$)/i);
  if (!match) return false;
  const body = match[0]
    .replace(/^##\s*2\.[^\n]*\n?/i, "")
    .replace(/\(Pendiente[^)]*\)/gi, "")
    .trim();
  return body.length > 80;
}

function isSubstantialClarifierFallbackDraft(draft: string, existingScope?: string): boolean {
  if ((existingScope ?? "").trim().length > 300) return true;
  return hasSubstantialSection2Body(draft);
}

function buildClarifierJsonCandidates(text: string): string[] {
  const stripped = stripThinkingTags(text);
  const raw = [
    stripped,
    extractJsonFromCodeBlock(text) ?? "",
    extractJsonFromCodeBlock(stripped) ?? "",
    extractFirstJsonObject(stripped) ?? "",
    extractFirstJsonObject(text) ?? "",
  ].filter((c) => c.trim().length > 0);

  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    const key = candidate.slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }
  return candidates;
}

function parseClarifierResponseWithMeta(text: string): { parsed: ClarifierParsed; escapeRepaired: boolean } {
  const cleaned = stripThinkingTags(text);
  const jsonStr = extractFirstJsonObject(cleaned) ?? cleaned.trim();
  const { value, escapeRepaired } = parseJsonOrThrowWithMeta(jsonStr, clarifierOutputSchema, {
    repairEscapes: true,
  });
  return { parsed: value, escapeRepaired };
}

/** Intentos locales antes de re-invocar el LLM (ahorra ~60–120s en retries JSON). */
function tryParseClarifierLocally(text: string): { parsed: ClarifierParsed; escapeRepaired: boolean } | null {
  for (const candidate of buildClarifierJsonCandidates(text)) {
    try {
      return parseClarifierResponseWithMeta(candidate);
    } catch {
      /* next candidate */
    }
  }
  return null;
}

function resolveClarifierParsed(text: string): { parsed: ClarifierParsed; meta: ClarifierParseMeta } {
  const localParsed = tryParseClarifierLocally(text);
  if (localParsed) {
    return {
      parsed: localParsed.parsed,
      meta: {
        source: localParsed.escapeRepaired ? "local_repair" : "direct",
        escapeRepaired: localParsed.escapeRepaired,
        llmRetry: false,
      },
    };
  }

  const direct = parseClarifierResponseWithMeta(text);
  return {
    parsed: direct.parsed,
    meta: {
      source: direct.escapeRepaired ? "local_repair" : "direct",
      escapeRepaired: direct.escapeRepaired,
      llmRetry: false,
    },
  };
}

async function resolveClarifierParsedWithRetry(
  llm: BaseChatModel,
  prompt: string,
  initialText: string,
): Promise<{ parsed: ClarifierParsed; meta: ClarifierParseMeta; text: string }> {
  let text = initialText;
  try {
    const resolved = resolveClarifierParsed(text);
    return { ...resolved, text };
  } catch (parseErr) {
    LOG("JSON inválido, retry 1x: %s", parseErr instanceof Error ? parseErr.message : String(parseErr));
    text = await invokeClarifierLlm(llm, prompt + JSON_RETRY_SUFFIX);
    const retryLocal = tryParseClarifierLocally(text);
    if (retryLocal) {
      return {
        parsed: retryLocal.parsed,
        text,
        meta: {
          source: retryLocal.escapeRepaired ? "llm_retry_repair" : "llm_retry",
          escapeRepaired: retryLocal.escapeRepaired,
          llmRetry: true,
        },
      };
    }
    const retryDirect = parseClarifierResponseWithMeta(text);
    return {
      parsed: retryDirect.parsed,
      text,
      meta: {
        source: retryDirect.escapeRepaired ? "llm_retry_repair" : "llm_retry",
        escapeRepaired: retryDirect.escapeRepaired,
        llmRetry: true,
      },
    };
  }
}

async function invokeClarifierLlm(llm: BaseChatModel, prompt: string): Promise<string> {
  const response = await llm.invoke([new HumanMessage(prompt)]);
  return typeof response.content === "string" ? response.content : "";
}

/** Creates the MDD Clarifier node. */
export type MddClarifierNodeOptions = {
  flowTrace?: MddFlowTraceOpts | null;
};

export function createMddClarifierNode(llm: BaseChatModel, opts?: MddClarifierNodeOptions) {
  const flowTrace = opts?.flowTrace ?? null;

  const emitClarifierParseMetric = (meta: ClarifierParseMeta, extra: Record<string, unknown> = {}) => {
    LOG(
      "JSON parse outcome source=%s escapeRepaired=%s llmRetry=%s",
      meta.source,
      meta.escapeRepaired,
      meta.llmRetry,
    );
    const correlationId = flowTrace?.correlationId;
    const trace = flowTrace?.service;
    if (trace && correlationId) {
      trace.clarifierJsonParse(correlationId, {
        source: meta.source,
        escapeRepaired: meta.escapeRepaired,
        llmRetry: meta.llmRetry,
        ...extra,
      });
    }
  };

  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const requestQuestionsOnly = state.requestQuestionsOnly === true;
    LOG("entry requestQuestionsOnly=%s dbgaContentLen=%s", requestQuestionsOnly, (state.dbgaContent ?? "").length);

    if (requestQuestionsOnly) {
      try {
        const feedback =
          state.auditorFeedback?.trim() ||
          "Precisión baja: genera preguntas para cubrir las dimensiones que evalúa el Auditor: modelo de datos/entidades, contratos u operaciones (API u otro), seguridad, infraestructura/despliegue, resiliencia.";
        const draftAndUser = `${state.mddDraft ?? ""} ${state.userInputAccumulated ?? ""}`;
        const identifiedInfra = extractIdentifiedInfraFromText(draftAndUser);
        const alreadyDocumented = extractAlreadyDocumentedTopics(state.mddDraft ?? "");
        const contextParts = [
          "**Precisión actual:** " + (state.auditorScore ?? 0) + "%. Objetivo: 85% (a partir de 85% se cede la intervención al usuario).",
          "**Borrador actual del MDD:**",
          state.mddDraft || "(vacío)",
          alreadyDocumented.length > 0
            ? "**Ya documentado en el borrador (lista indicativa; NO preguntes sobre estos temas; revisa además el texto completo del borrador — cualquier tema ya cubierto en cualquier dominio no debe generar pregunta):** " + alreadyDocumented.join(", ") + "."
            : "",
          "**Huecos a cubrir:**",
          feedback,
          identifiedInfra.length === 0
            ? "**Hueco detectado:** El borrador no menciona infraestructura, orquestación ni despliegue (Docker, Kubernetes, Dokploy, AWS, GCP, etc.). Incluye una pregunta para definirlo: propón opciones concretas (ej. Docker Compose vs K8s, Dokploy vs AWS ECS) y pide validación."
            : "",
          "**Instrucción:** Para cada hueco genera una PROPUESTA concreta + validación (o opción A vs B). Si un hueco del feedback ya está cubierto en el borrador (cualquier dominio), NO preguntes por ese tema; elige otro hueco pendiente. Prohibido: '¿Podrías detallar cómo...?', '¿Qué medidas específicas...?', '¿Cómo se gestionan...?'. Ejemplos: transacciones → proponer ACID/eventual y preguntar si validan; infra/resiliencia → proponer Docker + health checks + reintentos y preguntar Docker Compose vs K8s.",
        ].filter(Boolean);
        if (state.userInputAccumulated?.trim()) {
          contextParts.splice(
            contextParts.length - 1,
            0,
            "**Respuestas acumuladas del usuario (si ya describen entidades/relaciones/reglas, NO pidas estructuras ni diagramas; pregunta siguiente nivel):**",
            state.userInputAccumulated.trim(),
          );
        }
        if (state.managerQuestions?.length) {
          contextParts.splice(
            contextParts.length - 1,
            0,
            "**Preguntas que ya hiciste al usuario en la ronda anterior (NO repitas ninguna de estas ni variantes; el usuario ya respondió):**",
            state.managerQuestions.join("\n"),
            "Genera preguntas sobre **otros** huecos pendientes; si no queda hueco distinto, propón una sola pregunta sobre el siguiente tema no cubierto.",
          );
        }
        const context = contextParts.join("\n");
        const prompt = `${CLARIFIER_QUESTIONS_ONLY_MDD_PROMPT}\n\n---\n${context}`;
        const response = await llm.invoke([new HumanMessage(prompt)]);
        const text = typeof response.content === "string" ? response.content : "";
        const questions = text.trim()
          ? parseJsonOrThrowWithMeta(text, questionsOnlySchema, { repairEscapes: true }).value.questions.slice(0, 2)
          : ["¿Cuáles son los objetivos principales del sistema?", "¿Qué requisitos técnicos o integraciones son prioritarios?"];
        LOG("questions-only ok count=%s", questions.length);
        return {
          managerQuestions: questions,
          requestQuestionsOnly: false,
          clarifierJustGeneratedQuestions: true,
        };
      } catch (err) {
        LOG("questions-only error: %s", err instanceof Error ? err.message : String(err));
        return {
          managerQuestions: ["¿Cuáles son los objetivos principales del sistema?", "¿Qué integraciones o sistemas externos necesitas?"],
          requestQuestionsOnly: false,
          clarifierJustGeneratedQuestions: true,
        };
      }
    }

    const draftTrimmed = (state.mddDraft ?? "").trim();
    const existingScope = (state.clarifiedScope ?? "").trim();
    const hasGoodPriorDraft = isSubstantialClarifierFallbackDraft(draftTrimmed, existingScope);

    try {
      const brief = getUserBrief(state);
      const hasSubstantialDraft = draftTrimmed.length > 500 && /##\s*2\.\s*Arquitectura/i.test(draftTrimmed);
      const briefBlock = brief && !hasSubstantialDraft
        ? `**Objetivo del documento (lo que el usuario pide):** ${brief}\n\n**Tu tarea:** Elaborar la sección 1. Contexto para una aplicación que cumple este objetivo; las secciones 2–7 las rellenará el pipeline (no las escribas).\n\n---\n\n`
        : brief && hasSubstantialDraft
          ? `**Objetivo del documento (lo que el usuario pide):** ${brief}\n\n**Tu tarea:** Revisa y actualiza **solo** la sección 1. Contexto según el objetivo. El sistema fusionará tu §1 en el borrador existente; **no** reescribas §2–7.\n\n---\n\n`
          : "";

      const { digest: dbgaForPrompt, usedDigest, originalLen } = extractBrdDigest(state.dbgaContent ?? "");
      if (usedDigest) {
        LOG("using BRD digest len=%s from original=%s", dbgaForPrompt.length, originalLen);
      }

      let prompt = `${CLARIFIER_MDD_PROMPT}${clarifierComplexityAppendix(state.mddComplexity)}\n\n---\n${briefBlock}**DBGA (entrada):**\n${dbgaForPrompt}`;
      const inventoryBlock = domainInventoryPromptBlock(state);
      if (inventoryBlock) {
        prompt += inventoryBlock;
        prompt +=
          "\n\n**Obligatorio en §1 Contexto:** enumera las capacidades de negocio del inventario (no solo auth/RBAC). Las capacidades de autenticación van como complemento.";
      }
      if (hasSubstantialDraft) {
        const maxDraftLen = 14_000;
        const draftBlock =
          draftTrimmed.length > maxDraftLen
            ? draftTrimmed.slice(0, maxDraftLen) + "\n\n...(truncado; conserva §2–7 del borrador existente)..."
            : draftTrimmed;
        prompt += `\n\n**Borrador actual del MDD (solo para contexto de refinamiento de §1; NO devuelvas §2–7 en tu salida):**\n${draftBlock}`;
      }
      if (state.auditorFeedback?.trim()) {
        prompt += `\n\n**Feedback del Auditor (incorporar en §1 y clarifiedScope):**\n${state.auditorFeedback.trim()}`;
      }
      if (state.userInputAccumulated?.trim()) {
        prompt += `\n\n**Respuestas del usuario (incorporar en §1 y clarifiedScope):**\n${state.userInputAccumulated.trim()}`;
        const lastSegment = state.userInputAccumulated.split(/\n\n---\n\n/).pop()?.trim() ?? "";
        if (lastSegment.length <= 80 && /^(?:usuario:\s*)?(?:s[ií]|s[ií]\s*,\s*de\s*acuerdo|de\s*acuerdo|ok|vale|correcto|estoy\s+de\s+acuerdo|perfecto|acepto)[\s.]*$/i.test(lastSegment)) {
          prompt += `\n\n**Importante:** La última respuesta es un acuerdo breve; el usuario acepta la propuesta concreta del Feedback del Auditor (ej. transacciones ACID, consistencia eventual, Docker, etc.). Incorpórala explícitamente en contextoAlcance y clarifiedScope.`;
        }
      }

      let text = await invokeClarifierLlm(llm, prompt);
      if (!text.trim()) {
        LOG("LLM vacío");
        if (hasGoodPriorDraft) {
          LOG("soft fallback: borrador previo sustancial (len=%s)", draftTrimmed.length);
          return {
            clarifiedScope: (state.clarifiedScope ?? draftTrimmed.slice(0, 2000)).trim(),
            mddDraft: draftTrimmed,
            clarifierJustGeneratedQuestions: false,
          };
        }
        throw new Error(CLARIFIER_PARSE_ERROR);
      }

      let parsed: ClarifierParsed;
      let parseMeta: ClarifierParseMeta;
      try {
        const resolved = await resolveClarifierParsedWithRetry(llm, prompt, text);
        parsed = resolved.parsed;
        parseMeta = resolved.meta;
        text = resolved.text;
        emitClarifierParseMetric(parseMeta, { clarifiedScopeLen: String(parsed.clarifiedScope ?? "").length });
      } catch (retryErr) {
        LOG("JSON inválido tras retry: %s", retryErr instanceof Error ? retryErr.message : String(retryErr));
        emitClarifierParseMetric(
          { source: "llm_retry", escapeRepaired: false, llmRetry: true },
          { failed: true, error: retryErr instanceof Error ? retryErr.message : String(retryErr) },
        );
        if (hasGoodPriorDraft) {
          LOG("soft fallback tras parse failure: borrador previo (len=%s)", draftTrimmed.length);
          const fallbackScope =
            existingScope ||
            (state.userInputAccumulated ?? "").trim().split(/\n\n---\n\n/).map((s) => s.trim()).filter((s) => s.length > 50 && !/^(Usuario:\s*)?(sí|ok|vale)/i.test(s))[0]?.slice(0, 500) ||
            state.dbgaContent?.trim().slice(0, 500) ||
            "Alcance pendiente de refinar.";
          return {
            clarifiedScope: fallbackScope,
            mddDraft: draftTrimmed,
            clarifierJustGeneratedQuestions: false,
          };
        }
        throw new Error(CLARIFIER_PARSE_ERROR);
      }

      let scope = String(parsed.clarifiedScope ?? "").trim();
      const contextoAlcance = String(parsed.contextoAlcance ?? "").trim();

      if (!contextoAlcance || contextoAlcance.length < 20) {
        if (hasGoodPriorDraft) {
          LOG("contextoAlcance vacío; soft fallback borrador previo");
          return {
            clarifiedScope: scope || state.clarifiedScope || draftTrimmed.slice(0, 500),
            mddDraft: draftTrimmed,
            clarifierJustGeneratedQuestions: false,
          };
        }
        throw new Error(CLARIFIER_PARSE_ERROR);
      }

      if (scope.length < 300 && (state.userInputAccumulated ?? "").trim().length > 80) {
        const acc = state.userInputAccumulated!.trim();
        const blocks = acc.split(/\n\n---\n\n/).map((s) => s.trim()).filter(Boolean);
        const trivialReply = /^(?:Usuario:\s*)?(?:s[ií]|ok|vale|de\s*acuerdo)[\s.]*$/i;
        const substantial = blocks.filter((b) => b.length > 80 && !trivialReply.test(b.replace(/^Usuario:\s*/i, "").trim()));
        if (substantial.length > 0) {
          const excerpt = substantial[0].slice(0, 800);
          scope = scope + "\n\n**Requisitos explícitos del usuario:** " + excerpt;
          LOG("clarifiedScope enriquecido con requisitos del usuario (scopeOutLen=%s)", scope.length);
        }
      }

      const scopeSummary = scope.length > 100 ? scope.slice(0, 100) + "..." : scope;
      LOG("Input detected -> Clarified Scope: %s", scopeSummary);
      LOG("contextoAlcance len=%s", contextoAlcance.length);

      const mddDraft = buildMddDraftFromClarifierOutput({
        contextoAlcance,
        clarifiedScope: scope,
        previousDraft: draftTrimmed,
        preserveSectionsBeyond1: hasSubstantialDraft,
      });

      const slice: { title?: string; contextoAlcance: string } = {
        contextoAlcance,
        ...(parsed.title?.trim() ? { title: parsed.title.trim() } : {}),
      };
      const merged = mergeMddStructured(state.mddStructured, slice, state.mddDraft ?? "");
      const outStructured = merged ?? mergeMddStructured(undefined, slice);
      const sum = getMddDraftSummary(mddDraft);
      LOG("ok clarifiedScopeLen=%s mddDraftLen=%s section2=%s", scope.length, sum.length, sum.section2);
      logMddNodeOutput("Clarifier", mddDraft);
      const out: Partial<MDDStateType> = {
        clarifiedScope: scope,
        mddDraft,
        clarifierJustGeneratedQuestions: false,
      };
      if (outStructured != null) {
        out.mddStructured = outStructured;
      }
      return out;
    } catch (err) {
      LOG("error: %s", err instanceof Error ? err.message : String(err));
      throw err;
    }
  };
}
