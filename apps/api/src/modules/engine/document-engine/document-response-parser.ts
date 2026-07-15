/**
 * RFC-001 §2: Dual Output Protocol — DocumentResponseParser
 *
 * Parser para respuestas LLM que contienen JSON + Markdown.
 *  protocolVersion: "dual-output-v1"
 *  documentAst: { ... }
 *  documentMarkdown: "..."
 *  patches: [ ... ]
 *
 * Desacoplado del parser de chat anterior; trabaja sobre estructuras AST estrictas (Zod).
 * No usa regex "§para encontrar secciones".
 *
 * Características:
 *  1. Intenta extraer bloque JSON de la respuesta primero.
 *  2. Si no hay JSON válido, retorna error estructurado (no exception).
 *  3. Valida contra `documentResponseSchema` (Zod).
 *  4. Opcionalmente puede re-parsar markdown en cascada para retro-compatibilidad experimental
 *     (con la app adecuada se puede marcar como warning y proceder con raw markdown).
 */

import {
  type DocumentResponse,
  documentResponseSchema,
  type MddDocumentAst,
} from "@theforge/shared-types/document-ast";
import { renderDocument } from "./mdd-markdown-transpiler.js";

export interface ParseResult {
  success: boolean;
  /** Parsed dual-output response (null if no JSON block found) */
  response: DocumentResponse | null;
  /** Error description if success=false */
  error?: string;
  /** Validation issues with the JSON block (warnings-level or hard errors) */
  validationErrors: string[];
  /** Extracted raw markdown if JSON was not found or parse failed */
  fallbackMarkdown?: string;
  /** Texto fuera del bloque JSON (chat del LLM) cuando dual-output fue detectado. */
  remainingMarkdown?: string;
  /** If dual-output was found but its markdown diverged from transpiled markdown, this is the canonical one */
  canonicalMarkdown?: string;
}

export interface ParseOptions {
  /** Allow fallback to raw markdown parsing if no JSON present (default: true) */
  allowMarkdownFallback?: boolean;
  /** Divergence threshold: consider warning if |len(markdown) - len(transpiled)| / len(markdown) > X (default 0.15) */
  divergenceThreshold?: number;
  /** If true, and markdown in response diverges, replace with transpiled version */
  enforceDeterminism?: boolean;
}

function detectJsonFence(raw: string): { jsonText: string; remainingMarkdown: string } | null {
  // Look for fenced JSON blocks first ```json ... ```
  const fenceRegex = /```json\s*\n([\s\S]+?)\n```/;
  const match = raw.match(fenceRegex);
  if (match) {
    return { jsonText: match[1].trim(), remainingMarkdown: raw.replace(match[0], "").trim() };
  }

  // Look for plain JSON object (starting with { and ending with } on outermost level)
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const candidate = raw.slice(start, i + 1);
        // Ensure there is a double-quote before colon somewhere (heuristic for JSON, not JS code)
        if (/"[\w\-]+":/.test(candidate)) {
          return {
            jsonText: candidate,
            remainingMarkdown: raw.slice(0, start).trim() + "\n" + raw.slice(i + 1).trim(),
          };
        }
        start = -1;
      }
    }
  }
  return null;
}

/**
 * Parse an LLM response that MAY contain a dual-output JSON block + markdown.
 */
export function parseDualOutputResponse(raw: string, opts: ParseOptions = {}): ParseResult {
  const {
    allowMarkdownFallback = true,
    divergenceThreshold = 0.15,
    enforceDeterminism = false,
  } = opts;

  const result: ParseResult = {
    success: false,
    response: null,
    validationErrors: [],
  };

  const detected = detectJsonFence(raw);
  if (!detected) {
    if (allowMarkdownFallback) {
      result.fallbackMarkdown = raw.trim();
      // For backward compatibility during transition: return success but flag no-AST
      result.success = true; // But you can't trust the AST; caller must use fallbackMarkdown
      result.error =
        "No JSON dual-output block found in response. Returning raw markdown fallback.";
      return result;
    }
    result.error = "No JSON dual-output block found in response and markdown fallback disabled.";
    return result;
  }

  result.remainingMarkdown = detected.remainingMarkdown;

  let parsedObj: unknown;
  try {
    parsedObj = JSON.parse(detected.jsonText);
  } catch (e: any) {
    result.error = `Invalid JSON in dual-output block: ${e.message}`;
    if (allowMarkdownFallback) {
      result.fallbackMarkdown = raw.trim();
    }
    return result;
  }

  const docParse = documentResponseSchema.safeParse(parsedObj);
  if (!docParse.success) {
    result.error = `Dual-output JSON fails schema validation: ${docParse.error.message}`;
    result.validationErrors = docParse.error.errors.map(
      (err) => `${err.path.join(".")}: ${err.message}`,
    );
    if (allowMarkdownFallback) {
      result.fallbackMarkdown = raw.trim();
    }
    return result;
  }

  const docResponse = docParse.data;
  result.response = docResponse;

  // Determinism check: compare received markdown vs. transpiled from AST
  if (docResponse.documentAst) {
    const transpiled = renderDocument(docResponse.documentAst);
    const receivedMd = docResponse.documentMarkdown || "";
    const maxLen = Math.max(transpiled.length, receivedMd.length, 1);
    const diff = Math.abs(transpiled.length - receivedMd.length);
    const divergence = diff / maxLen;

    if (divergence > divergenceThreshold) {
      result.validationErrors.push(
        `Markdown divergence detected: ${(divergence * 100).toFixed(1)}% difference ` +
          `(${diff} chars) between received markdown and transpiled AST.`,
      );
      if (enforceDeterminism) {
        result.canonicalMarkdown = transpiled;
      }
    } else if (!receivedMd) {
      result.validationErrors.push(
        "Document markdown is empty — generating from AST via transpiler.",
      );
      if (enforceDeterminism) {
        result.canonicalMarkdown = transpiled;
      }
    }
  } else {
    result.validationErrors.push("documentsAst missing in dual-output response.");
  }

  result.success = true;
  return result;
}

/**
 * Try to rebuild a canonical DocumentResponse from raw markdown only (transitional compatibility).
 * Uses legacy parser hooks if available.
 */
export async function buildDocumentResponseFromMarkdown(
  markdown: string, opts?: { documentType?: string; documentId?: string; projectId?: string },
): Promise<Omit<DocumentResponse, "protocolVersion">> {
  // During transition, we can convert markdown to AST via a best-effort parser
  // (This should eventually be replaced by a real markdown-to-AST importer)
  const fallbackAst: MddDocumentAst = {
    version: "2.0",
    documentId: opts?.documentId || "fallback",
    title: "Fallback from Markdown",
    sections: [
      {
        id: "sec-fallback",
        type: "custom_markdown",
        heading: "Contenido importado",
        order: 1,
        markdown,
      } as any,
    ],
  };

  return {
    documentVersion: 0,
    documentType: (opts?.documentType as any) || "mdd",
    documentAst: fallbackAst,
    documentMarkdown: markdown,
  };
}
