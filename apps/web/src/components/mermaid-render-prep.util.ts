import {
  resolveMermaidBlockForRender,
} from "@theforge/shared-types/mermaid";

/** Indentación: solo 2 espacios ASCII por nivel; sin espacios al final. */
function normalizeMermaidIndent(line: string): string {
  const m = line.match(/^(\s*)/);
  const len = m?.[1]?.length ?? 0;
  const rest = line.slice(len);
  return "  ".repeat(Math.floor(len / 2)) + rest;
}

/** Espacios Unicode → ASCII, tabs → espacios, trailing whitespace. */
function normalizeMermaidContent(content: string): string {
  const base = content
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  if (!base) return "";
  return base
    .split("\n")
    .map(normalizeMermaidIndent)
    .join("\n")
    .trim();
}

function normalizeMermaidFirstLineKeywords(content: string): string {
  const lines = content.split("\n");
  if (!lines.length) return content;
  const first = lines[0] ?? "";
  const fixed = first.replace(/^\s*timeline\b/i, (m) => m.replace(/timeline/gi, "timeline"));
  if (fixed === first) return content;
  lines[0] = fixed;
  return lines.join("\n");
}

/** Corrige errores sintácticos frecuentes en sequenceDiagram generados por IA. */
export function normalizeMermaidSequenceSyntax(content: string): string {
  const looksSequential =
    /sequenceDiagram/i.test(content) || /^(participant|actor)\s/im.test(content);
  if (!looksSequential) return content;

  const lines = content.trim().split("\n");
  const out: string[] = [];

  let hasSeqDiag = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^sequenceDiagram$/i.test(t)) {
      hasSeqDiag = true;
      break;
    }
  }
  if (!hasSeqDiag) {
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (/^(participant|actor)\s/i.test(t)) {
        out.push("sequenceDiagram");
        break;
      }
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();

    if (!trimmed) {
      out.push(raw);
      continue;
    }
    if (
      /^```|^#{1,6}\s|^\*\*TechnicalMetadata\*\*|^TechnicalMetadata\s*:?\s*$|^-\s*`/i.test(trimmed)
    ) {
      break;
    }
    if (
      /^(sequenceDiagram|participant|actor|Note\s|alt|else|end|loop|opt|par|rect|critical|break)\b/i.test(
        trimmed,
      )
    ) {
      out.push(raw);
      continue;
    }

    let fixed = trimmed.replace(/(\w+)\s+-->\s*(\w+)/g, "$1-->>$2");
    fixed = fixed.replace(/(-->>[A-Za-z_]\w*)\s+(\d[\d\s{])/g, "$1: $2");
    fixed = fixed.replace(/(-->>[A-Za-z_]\w*)\s+(\{)/g, "$1: $2");
    fixed = fixed.replace(/([A-Za-z_]\w*)>>([A-Za-z_])/g, "$1->>$2");

    if (!/->|-->>|-->/.test(fixed) && !/^\s*(Note|alt|else|end|loop)/.test(fixed)) {
      if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s,:]+$/i.test(fixed.trim())) {
        let lastParticipant = "B";
        for (let j = i - 1; j >= 0; j--) {
          const p = lines[j]!.trim();
          const pm = p.match(/^participant\s+(\w+)/i);
          if (pm?.[1]) {
            lastParticipant = pm[1];
            break;
          }
          const am = p.match(/^(\w+)(?:--?>>?|->>?)/);
          if (am?.[1]) {
            lastParticipant = am[1];
            break;
          }
        }
        fixed = `Note over ${lastParticipant}: ${fixed.trim()}`;
      }
    }

    out.push(fixed);
  }

  return out.join("\n");
}

/** Pipeline de normalización antes de `mermaid.render` (MDD, DBGA, tutorial). */
export function prepareMermaidForRender(content: string): string {
  let body = resolveMermaidBlockForRender(content);
  if (!body.trim()) return "";

  if (/sequenceDiagram/i.test(body) || /^(participant|actor)\s/im.test(body)) {
    body = normalizeMermaidSequenceSyntax(body);
  }

  if (/^erDiagram\b/i.test(body)) {
    return normalizeMermaidContent(body);
  }

  return normalizeMermaidFirstLineKeywords(normalizeMermaidContent(body));
}
