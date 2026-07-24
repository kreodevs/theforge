/**
 * Retry helper para invocaciones LLM en el pipeline MDD.
 *
 * Por qué existe: los nodos LLM (SoftwareArchitect, Clarifier, LLMFormatter,
 * Auditor) reciben el texto crudo y, si viene vacío, caen a fallback
 * ("borrador sin transformar", "usando fallback", "determinístico con gaps
 * estructurados") que degrada el MDD persistido. El log real (job 92 del
 * proyecto ForgeOps, 2026-07-22 05:35–05:59) muestra 4 de 9 invocaciones
 * devolviendo texto vacío por rate-limit del proveedor, sin reintento.
 *
 * El nodo Security ya tenía retry 1x implementado in-line; este util
 * generaliza el patrón a los demás nodos con backoff exponencial y un
 * validador opcional (p. ej. "el texto no es sólo whitespace y tiene
 * al menos N caracteres").
 *
 * ⚠️  Scope: sólo para los nodos LLM del pipeline MDD. El chat interactivo
 * (SessionsService) sigue su propia política de retry/backoff vía
 * SessionsService.invokeWelcomeLlmWithRetries y modelos rate-limited.
 */
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Runnable } from "@langchain/core/runnables";
import type { BaseMessage } from "@langchain/core/messages";
import { recordTokenUsageFromContext } from "../../ai/utils/token-usage-recorder.js";

export type InvokeWithRetryOptions = {
  /** Etiqueta corta para logs: "SoftwareArchitect", "Clarifier", etc. */
  tag: string;
  /** Intentos totales incluyendo el primero. Default 3. */
  maxAttempts?: number;
  /** Backoff en ms antes de cada intento (index = intento-1). Default [0, 1500, 4000]. */
  backoffMs?: number[];
  /**
   * Validador del texto devuelto. Si retorna `false`, se considera respuesta
   * vacía/inválida y se reintenta. Default: texto no-vacío tras trim.
   */
  isResponseValid?: (text: string) => boolean;
};

const DEFAULT_BACKOFF_MS = [0, 1500, 4000];

/** Extrae texto plano de un AIMessage de LangChain (string content o array de bloques). */
export function extractLlmText(response: unknown): string {
  if (response == null) return "";
  if (typeof response === "string") return response;
  if (typeof response !== "object") return "";
  const content = (response as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object" && "text" in block && typeof (block as { text?: unknown }).text === "string") {
          return (block as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Tipo del objeto invocable: BaseChatModel directo o Runnable.bindTools(...).
 * Ambos exponen `.invoke(messages): Promise<unknown>`.
 */
export type InvokableLlm = BaseChatModel | Runnable<BaseMessage[], unknown>;

/**
 * Invoca el LLM con retry automático cuando la respuesta es vacía o falla
 * el validador. Devuelve la respuesta cruda o `null` si TODOS los intentos
 * fallan — el caller decide el fallback (devolver borrador sin transformar,
 * determinístico, etc.).
 */
export async function invokeLlmWithRetry(
  llm: InvokableLlm,
  messages: BaseMessage[],
  options: InvokeWithRetryOptions,
): Promise<unknown> {
  const max = Math.max(1, options.maxAttempts ?? 3);
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const isValid = options.isResponseValid ?? ((t) => t.trim().length > 0);
  const tag = options.tag || "LLM";

  for (let attempt = 1; attempt <= max; attempt += 1) {
    const wait = backoff[Math.min(attempt - 1, backoff.length - 1)] ?? 0;
    if (wait > 0) await sleep(wait);
    try {
      const response = await (llm as { invoke: (m: BaseMessage[]) => Promise<unknown> }).invoke(messages);
      recordLlmUsageFromMessage(llm, response, tag);
      const text = extractLlmText(response);
      if (isValid(text)) {
        if (attempt > 1) {
          console.log(
            `[${tag}] retry recuperó respuesta válida (attempt ${attempt}/${max}, len=${text.length})`,
          );
        }
        return response;
      }
      console.warn(
        `[${tag}] respuesta vacía/inválida del LLM (attempt ${attempt}/${max}, len=${text.length}), reintentando...`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[${tag}] error en LLM.invoke (attempt ${attempt}/${max}): ${msg}, reintentando...`,
      );
    }
  }
  console.error(`[${tag}] LLM sin respuesta válida tras ${max} intentos — devolviendo null`);
  return null;
}

/**
 * Extrae usage_metadata de un AIMessage de LangChain y lo registra en `TokenUsage`
 * si hay un contexto de telemetría activo. No-op si el LLM no expone usage.
 * El provider/modelo se derivan del llm pasado por parámetro (duck-typing).
 */
function recordLlmUsageFromMessage(
  llm: InvokableLlm,
  response: unknown,
  _tag: string,
): void {
  if (!response || typeof response !== "object") return;
  const message = response as {
    usage_metadata?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
    response_metadata?: {
      tokenUsage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
    };
  };
  const usage =
    message.usage_metadata ??
    (message.response_metadata?.tokenUsage
      ? {
          input_tokens: message.response_metadata.tokenUsage.promptTokens,
          output_tokens: message.response_metadata.tokenUsage.completionTokens,
          total_tokens: message.response_metadata.tokenUsage.totalTokens,
        }
      : undefined);
  if (!usage) return;
  const promptTokens = usage.input_tokens ?? 0;
  const completionTokens = usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
  if (!promptTokens && !completionTokens) return;
  const { providerId, modelId } = deriveLlmIdentity(llm);
  recordTokenUsageFromContext(
    providerId,
    modelId,
    promptTokens,
    completionTokens,
    totalTokens,
  );
}

/**
 * Duck-typing para extraer provider/modelo del `BaseChatModel`. LangChain no expone
 * una API uniforme; las subclases usan `modelName`, `model`, `lc_serializable` etc.
 * Si no se reconoce, devuelve "unknown" / "unknown" — el call se sigue registrando,
 * simplemente no se calcula coste.
 */
function deriveLlmIdentity(llm: InvokableLlm): {
  providerId: string;
  modelId: string;
} {
  const candidate = llm as unknown as Record<string, unknown>;
  const modelId =
    typeof candidate.modelName === "string"
      ? candidate.modelName
      : typeof candidate.model === "string"
        ? candidate.model
        : "unknown";
  // ChatAnthropic, ChatOpenAI, ChatGoogleGenerativeAI todos exponen `lc_serializable`
  // con un `kwargs.model` o similar. Construimos heurística por nombre de clase.
  const className = (candidate.constructor as { name?: string })?.name ?? "";
  let providerId = "openai-compatible";
  if (/Anthropic/i.test(className)) providerId = "anthropic";
  else if (/Google|Gemini|GenAI/i.test(className)) providerId = "gemini";
  else if (/OpenAI/i.test(className)) providerId = "openai";
  // OpenRouter pasa por ChatOpenAI con baseUrl distinto; ya queda registrado como
  // "openai" — suficiente para agregación, podemos refinar después.
  return { providerId, modelId };
}
