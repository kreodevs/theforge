/**
 * Repara listas ordenadas partidas: el LLM emite el marcador en una línea y el texto en la siguiente.
 *
 * Mal:
 *   1.
 *
 *   Agnosticismo de producto: …
 *
 * Bien:
 *   1. Agnosticismo de producto: …
 */

/** Línea con solo `1.` / `1.1.` / `a.` (sin contenido). */
const STANDALONE_ORDERED_MARKER = /^(\s*)(\d+(?:\.\d+)*|[a-zA-Z])\.\s*$/;

function isFenceLine(trimmed: string): boolean {
  return /^```/.test(trimmed);
}

function isContinuationContentLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (isFenceLine(t)) return false;
  if (/^#{1,6}\s/.test(t)) return false;
  if (/^\|/.test(t)) return false;
  if (STANDALONE_ORDERED_MARKER.test(line)) return false;
  // Ya es ítem completo en la misma línea (p. ej. "2. Texto").
  if (/^\d+(?:\.\d+)*\.\s+\S/.test(t)) return false;
  if (/^[a-zA-Z]\.\s+\S/.test(t)) return false;
  return true;
}

export function repairSplitOrderedListItems(text: string): string {
  if (!text?.trim()) return text ?? "";

  const lines = text.split("\n");
  const out: string[] = [];
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (isFenceLine(trimmed)) {
      if (inFence && trimmed === "```") inFence = false;
      else if (!inFence) inFence = true;
      out.push(line);
      i += 1;
      continue;
    }

    if (inFence) {
      out.push(line);
      i += 1;
      continue;
    }

    const markerMatch = line.match(STANDALONE_ORDERED_MARKER);
    if (markerMatch) {
      const indent = markerMatch[1] ?? "";
      const marker = markerMatch[2]!;
      let j = i + 1;
      while (j < lines.length && lines[j]!.trim() === "") j += 1;
      if (j < lines.length && isContinuationContentLine(lines[j]!)) {
        out.push(`${indent}${marker}. ${lines[j]!.trim()}`);
        i = j + 1;
        continue;
      }
    }

    out.push(line);
    i += 1;
  }

  return out.join("\n");
}
