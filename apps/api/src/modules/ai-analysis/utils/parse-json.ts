import type { z } from "zod";

/**
 * Extrae contenido de un bloque ```json ... ``` si existe.
 */
export function extractJsonFromCodeBlock(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) return match[1].trim();
  return null;
}

/**
 * Extrae el primer objeto JSON completo (desde el primer `{` hasta el `}` que cierra).
 * Útil cuando el LLM devuelve texto con JSON embebido o markdown alrededor.
 */
export function extractFirstJsonObject(text: string): string | null {
  const fromBlock = extractJsonFromCodeBlock(text);
  if (fromBlock) {
    const obj = extractFirstJsonObjectRaw(fromBlock);
    if (obj) return obj;
  }
  return extractFirstJsonObjectRaw(text.trim());
}

function extractFirstJsonObjectRaw(trimmed: string): string | null {
  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString: "'" | '"' | null = null;
  let i = start;
  const len = trimmed.length;
  while (i < len) {
    const c = trimmed[i];
    if (inString) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
    i++;
  }
  return null;
}

const VALID_SIMPLE_JSON_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);

/**
 * Repara secuencias `\` inválidas dentro de strings JSON (p. ej. rutas Windows `C:\Users`,
 * regex `\d`, SQL/markdown con backslashes). Duplica `\` cuando el siguiente carácter no es
 * escape JSON válido.
 */
export function repairInvalidJsonEscapes(input: string): string {
  let out = "";
  let i = 0;
  let inString = false;

  while (i < input.length) {
    const c = input[i];

    if (!inString) {
      out += c;
      if (c === '"') inString = true;
      i++;
      continue;
    }

    if (c === "\\") {
      const next = input[i + 1];
      if (next === undefined) {
        out += "\\\\";
        i++;
        continue;
      }
      if (next === "u") {
        const hex = input.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += input.slice(i, i + 6);
          i += 6;
          continue;
        }
        out += "\\\\u";
        i += 2;
        continue;
      }
      if (VALID_SIMPLE_JSON_ESCAPES.has(next)) {
        out += c + next;
        i += 2;
        continue;
      }
      out += "\\\\" + next;
      i += 2;
      continue;
    }

    out += c;
    if (c === '"') inString = false;
    i++;
  }

  return out;
}

export type ParseJsonTextResult = {
  value: unknown;
  escapeRepaired: boolean;
};

function stripJsonFenceWrapper(text: string): string {
  return text.replace(/^```json?\s*|\s*```$/g, "").trim();
}

/**
 * Parsea texto JSON con extracción de objeto embebido y reparación opcional de escapes.
 */
export function parseJsonText(text: string, options?: { repairEscapes?: boolean }): ParseJsonTextResult {
  const repairEscapes = options?.repairEscapes === true;
  const stripped = stripJsonFenceWrapper(text);

  const attempts: Array<{ jsonStr: string; escapeRepaired: boolean }> = [
    { jsonStr: stripped, escapeRepaired: false },
  ];

  const extracted = extractFirstJsonObject(stripped);
  if (extracted && extracted !== stripped) {
    attempts.push({ jsonStr: extracted, escapeRepaired: false });
  }

  if (repairEscapes) {
    const repairSources = [...attempts];
    for (const source of repairSources) {
      const repaired = repairInvalidJsonEscapes(source.jsonStr);
      if (repaired !== source.jsonStr) {
        attempts.push({ jsonStr: repaired, escapeRepaired: true });
      }
    }
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return {
        value: JSON.parse(attempt.jsonStr) as unknown,
        escapeRepaired: attempt.escapeRepaired,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SyntaxError("No se encontró JSON válido en la respuesta.");
}

export type ParseJsonWithMetaResult<T> = {
  value: T;
  escapeRepaired: boolean;
};

/**
 * Parsea JSON con metadata de reparación (usado por Clarifier para métricas).
 */
export function parseJsonOrThrowWithMeta<TSchema extends z.ZodTypeAny>(
  text: string,
  schema: TSchema,
  options?: { repairEscapes?: boolean },
): ParseJsonWithMetaResult<z.output<TSchema>> {
  const { value, escapeRepaired } = parseJsonText(text, options);
  return { value: schema.parse(value), escapeRepaired };
}

/**
 * Parsea texto que puede contener JSON con o sin markdown code fence.
 * Usado por nodos MDD y Benchmark para homologar el parsing de respuestas del LLM.
 * Si hay texto alrededor del JSON, intenta extraer el primer objeto con extractFirstJsonObject.
 */
export function parseJsonOrThrow<TSchema extends z.ZodTypeAny>(
  text: string,
  schema: TSchema,
): z.output<TSchema> {
  return parseJsonOrThrowWithMeta(text, schema, { repairEscapes: false }).value;
}
