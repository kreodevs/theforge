type Encoder = {
  encode: (text: string) => number[];
};

function isTiktokenEnabled(): boolean {
  const v = process.env.LEGACY_DELIVERABLES_STRATEGY_USE_TIKTOKEN?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}

function readPreferredEncodingName(): string {
  return process.env.LEGACY_DELIVERABLES_STRATEGY_TIKTOKEN_ENCODING?.trim() || "cl100k_base";
}

let encoder: Encoder | "failed" | undefined;
let loadPromise: Promise<void> | undefined;

function tryGetEncoding(getEncoding: (name: string) => Encoder, name: string): Encoder | undefined {
  try {
    return getEncoding(name);
  } catch {
    return undefined;
  }
}

/**
 * Carga `js-tiktoken` vía `import()` (ESM) para compatibilidad con salida CommonJS de Nest.
 * Idempotente; atajar errores deja `encoder === "failed"` y se usa fallback chars/ratio.
 */
export async function ensureLegacyStrategyTiktokenLoaded(): Promise<void> {
  if (!isTiktokenEnabled()) return;
  if (encoder === "failed" || encoder !== undefined) return;
  loadPromise ??= import("js-tiktoken")
    .then((mod) => {
      const getEncoding = mod.getEncoding as (name: string) => Encoder;
      const preferred = readPreferredEncodingName();
      const enc = tryGetEncoding(getEncoding, preferred) ?? tryGetEncoding(getEncoding, "cl100k_base");
      encoder = enc ?? "failed";
    })
    .catch(() => {
      encoder = "failed";
    });
  await loadPromise;
}

/** Tokens a sumar al conteo del cuerpo simulado (aprox. system + instrucciones fijas). */
export function readTiktokenInstructionOverheadTokens(): number {
  const n = parseInt(process.env.LEGACY_DELIVERABLES_STRATEGY_TIKTOKEN_INSTRUCTION_OVERHEAD_TOKENS ?? "450", 10);
  return Number.isFinite(n) && n >= 0 && n <= 50_000 ? n : 450;
}

function getStrategyEncoder(): Encoder | undefined {
  if (!isTiktokenEnabled()) return undefined;
  if (encoder === "failed" || encoder === undefined) return undefined;
  return encoder;
}

/**
 * Cuenta tokens del texto del user prompt simulado (tras `ensureLegacyStrategyTiktokenLoaded`).
 * Si tiktoken no está listo o falló, usa `ceil(chars / charsPerTokenFallback)`.
 */
export function countLegacyDeliverablesPromptTokens(
  text: string,
  charsPerTokenFallback: number,
): { tokens: number; method: "tiktoken" | "approx_chars" } {
  const enc = getStrategyEncoder();
  if (!enc) {
    return {
      tokens: Math.ceil(Math.max(0, text.length) / charsPerTokenFallback),
      method: "approx_chars",
    };
  }
  try {
    const ids = enc.encode(text);
    return { tokens: ids.length, method: "tiktoken" };
  } catch {
    return {
      tokens: Math.ceil(Math.max(0, text.length) / charsPerTokenFallback),
      method: "approx_chars",
    };
  }
}
