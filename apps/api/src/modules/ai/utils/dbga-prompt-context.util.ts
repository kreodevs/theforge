/** Máximo de caracteres de DBGA/codebase enviados al prompt de generación de BRD. */
export const DBGA_FOR_BRD_PROMPT_MAX_CHARS = 48_000;

const THINKING_BLOCK_RE = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi;
const PRESS_REPLY_LINE_RE = /^.*\bpress\s+reply\b.*$/gim;
const LLM_META_LINE_RE =
  /^.*\b(?:here'?s\s+my\s+thinking|let me think|let me draft|as an ai language model)\b.*$/gim;

/** Quita basura típica pegada desde el chat (thinking, placeholders de UI). */
export function sanitizeSourceDocForBrdPrompt(text: string): string {
  let t = (text ?? "").trim();
  if (!t) return "";
  t = t.replace(THINKING_BLOCK_RE, "");
  t = t.replace(PRESS_REPLY_LINE_RE, "");
  t = t.replace(LLM_META_LINE_RE, "");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Limita el documento fuente para el prompt de BRD preservando inicio y cierre.
 */
export function truncateSourceDocForBrdPrompt(
  text: string,
  maxChars: number = DBGA_FOR_BRD_PROMPT_MAX_CHARS,
): { text: string; truncated: boolean } {
  const sanitized = sanitizeSourceDocForBrdPrompt(text);
  if (sanitized.length <= maxChars) return { text: sanitized, truncated: false };

  const headLen = Math.floor(maxChars * 0.55);
  const tailLen = Math.floor(maxChars * 0.35);
  const omitted = sanitized.length - headLen - tailLen;
  const marker =
    `\n\n---\n\n*[Documento truncado para generación de BRD: se omitieron ~${omitted.toLocaleString("es-MX")} caracteres del centro. Usa el inicio y el cierre como referencia principal.]*\n\n---\n\n`;

  return {
    text: sanitized.slice(0, headLen) + marker + sanitized.slice(-tailLen),
    truncated: true,
  };
}
