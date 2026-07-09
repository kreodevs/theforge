/** Appends Context7 / Technology Docs snippets to LLM system prompts. */
export function appendTechDocsToSystemPrompt(
  systemPrompt: string,
  techDocsContext: string | null | undefined,
  opts?: { citeSource?: boolean },
): string {
  const block = (techDocsContext ?? "").trim();
  if (!block) return systemPrompt;

  const cite =
    opts?.citeSource === true
      ? " **Cita la fuente** (nombre de librería / sección Context7) en tu respuesta cuando uses estos extractos."
      : " Cita la fuente (nombre de librería) cuando uses estos extractos.";

  return (
    `${systemPrompt}\n\n**Documentación oficial (Context7 — Technology Docs MCP):**\n---\n` +
    `${block}\n---\n\n**Instrucción:** Usa estos extractos como referencia verificable para APIs, tokens, OAuth y patrones de integración.${cite} No inventes formatos de token ni endpoints si Context7 no los respalda.`
  );
}

/** Appends Context7 snippets to user/generation prompts (Architecture, API, Tasks). */
export function appendTechDocsToUserPrompt(
  prompt: string,
  techDocsContext: string | null | undefined,
): string {
  const block = (techDocsContext ?? "").trim();
  if (!block) return prompt;
  return (
    `${prompt}\n\n**Documentación oficial de tecnologías (Technology Docs MCP — patrones y APIs; no sustituye MDD ni Ariadne):**\n---\n` +
    `${block}\n---`
  );
}
