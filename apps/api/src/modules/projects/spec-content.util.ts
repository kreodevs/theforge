/**
 * Normalización determinista de Spec.md tras generación LLM.
 * Evita headings vacíos `## 1.` que penalizan DocAccuracy (C5) y bloquean preflight Tasks.
 */

import { cleanDocumentContent } from "../sessions/document-content.util.js";

const EMPTY_NUMBERED_H2 = /^##\s+\d+\.\s*$/;

/**
 * Convierte bloques `## N.` + párrafo en viñetas markdown.
 * Si no hay contenido reconocible debajo, degrada a `### Ítem N`.
 */
export function normalizeSpecMarkdown(markdown: string): string {
  const lines = (markdown ?? "").split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!EMPTY_NUMBERED_H2.test(line.trim())) {
      out.push(line);
      continue;
    }

    let j = i + 1;
    while (j < lines.length && (lines[j] ?? "").trim() === "") j += 1;

    if (j < lines.length) {
      const next = (lines[j] ?? "").trim();
      if (next.startsWith("**") || next.startsWith("[NEEDS CLARIFICATION")) {
        out.push(next.startsWith("- ") ? next : `- ${next}`);
        i = j;
        continue;
      }
    }

    const n = line.trim().match(/^##\s+(\d+)\./)?.[1] ?? "?";
    out.push(`### Ítem ${n}`);
  }

  return out.join("\n");
}

/** Spec listo para persistir: normaliza headings y aplica formato/changelog estándar. */
export function cleanSpecDocumentContent(text: string): string {
  return cleanDocumentContent(normalizeSpecMarkdown(text));
}
