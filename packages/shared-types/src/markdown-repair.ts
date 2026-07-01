/**
 * Repara salidas de LLM donde trozos de MDD quedan dentro de fences ``` sin idioma
 * o con fence de apertura sin cierre: el markdown se mostraba como un bloque de código
 * (sin wrap, texto cortado a la derecha).
 */

import { looksLikeMermaidDiagramBody, splitMermaidFenceBodyAtDocumentLeak } from "./mermaid.js";

/** Idioma del fence abierto antes de `lineIndex` (null = ninguno). */
function openFenceLangBeforeLine(lines: string[], lineIndex: number): string | null {
  let openLang: string | null = null;
  for (let i = 0; i < lineIndex; i++) {
    const trimmed = (lines[i] ?? "").trim();
    const openMatch = trimmed.match(/^```([a-zA-Z0-9_-]*)?$/);
    if (!openMatch) continue;
    if (openLang === null) {
      openLang = (openMatch[1] ?? "").toLowerCase();
    } else {
      openLang = null;
    }
  }
  return openLang;
}

/**
 * Elimina ``` huérfano que envuelve el heading + ```mermaid como bloque plano (MDD LLM).
 * No quita un ``` que cierra un bloque ```mermaid real (BRD §4: varios diagramas seguidos).
 */
export function stripOrphanFenceLineBeforeMermaid(document: string): string {
  if (!document?.trim()) return document ?? "";

  const normalized = document.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const dropLine = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? "").trim();
    if (trimmed !== "```") continue;

    const openLang = openFenceLangBeforeLine(lines, i);
    if (openLang === "mermaid") continue;

    const rest = lines.slice(i + 1);
    let j = 0;
    while (j < rest.length && (rest[j] ?? "").trim() === "") j++;

    const afterBlank = (rest[j] ?? "").trim();
    const headingThenMermaid =
      /^#{1,6}\s+\S/.test(afterBlank) &&
      rest.slice(j + 1).some((l) => /^```mermaid[ \t]*$/i.test((l ?? "").trim()));
    const directMermaid = /^```mermaid[ \t]*$/i.test(afterBlank);

    if (headingThenMermaid || directMermaid) {
      dropLine.add(i);
    }
  }

  if (dropLine.size === 0) return normalized;
  return lines.filter((_line, idx) => !dropLine.has(idx)).join("\n");
}

/** Fence sin lenguaje cuyo cuerpo es heading + ```mermaid literal → markdown válido. */
export function unwrapEmbeddedMermaidFence(body: string): string | null {
  const m = body.match(/^(\s*#{1,6}\s[^\n]*\n+)?\s*```mermaid\s*\n([\s\S]*)$/i);
  if (!m) return null;
  const diagram = m[2]!.trim();
  if (!looksLikeMermaidDiagramBody(diagram)) return null;
  const heading = m[1] ?? "";
  return `${heading}\`\`\`mermaid\n${diagram}\n\`\`\``;
}

function markdownLikeDocFragment(t: string): boolean {
  const s = t.trim();
  if (s.length < 40) return false;
  const headers = s.match(/^#{1,6}\s+[^\n]+/gm) ?? [];
  if (headers.length < 2) return false;
  const hasListOrPara = /^[-*]\s/m.test(s) || /^\d+\.\s/m.test(s) || /\n\n[^\n`]{20,}/.test(s);
  return hasListOrPara || /\n##\s/.test(s);
}

/**
 * - Desenvuelve bloques ``` / ```markdown cuyo interior son títulos y listas (markdown real).
 * - Si hay un ``` de apertura sin cierre y el resto parece MDD, elimina la línea del fence.
 */
export function repairMarkdownFences(raw: string): string {
  if (!raw?.trim()) return raw ?? "";
  const preprocessed = stripOrphanFenceLineBeforeMermaid(raw);
  const lines = preprocessed.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (/^```[a-zA-Z0-9_-]*\s*$/.test(trimmed)) {
      const lang = (trimmed.match(/^```([a-zA-Z0-9_-]*)?/)?.[1] ?? "").toLowerCase();
      const openLine = line;
      i++;
      const inner: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i]!.trim())) {
        inner.push(lines[i]!);
        i++;
      }
      const hasClose = i < lines.length && /^```\s*$/.test(lines[i]!.trim());
      if (hasClose) i++;
      const body = inner.join("\n");
      const isMermaidDiagram = lang === "mermaid" && looksLikeMermaidDiagramBody(body);
      const embeddedMermaid = !lang && hasClose ? unwrapEmbeddedMermaidFence(body) : null;
      // LLMs sometimes fence BRD/MDD prose as ```mermaid; unwrap when body is markdown, not a diagram.
      const unwrapLang = !lang || lang === "markdown" || lang === "md" || lang === "mermaid";
      if (embeddedMermaid) {
        if (out.length > 0 && (out[out.length - 1] ?? "").trim() !== "") out.push("");
        out.push(...embeddedMermaid.split("\n"));
      } else if (!hasClose && isMermaidDiagram) {
        const { diagram, remainder } = splitMermaidFenceBodyAtDocumentLeak(body);
        out.push(openLine);
        if (diagram) out.push(...diagram.split("\n"));
        out.push("```");
        if (remainder.trim()) {
          if ((out[out.length - 1] ?? "").trim() !== "") out.push("");
          out.push(...remainder.split("\n"));
        }
      } else if (hasClose && unwrapLang && markdownLikeDocFragment(body) && !isMermaidDiagram) {
        if (out.length > 0 && (out[out.length - 1] ?? "").trim() !== "") out.push("");
        out.push(...body.split("\n"));
      } else if (!hasClose && unwrapLang && markdownLikeDocFragment(body) && !isMermaidDiagram) {
        if (out.length > 0 && (out[out.length - 1] ?? "").trim() !== "") out.push("");
        out.push(...body.split("\n"));
      } else {
        out.push(openLine);
        out.push(...inner);
        if (hasClose) out.push("```");
      }
    } else {
      out.push(line);
      i++;
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
