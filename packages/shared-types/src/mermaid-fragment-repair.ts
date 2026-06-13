/**
 * Repara bloques Mermaid partidos fuera del fence (sequenceDiagram y graph/flowchart).
 */

const GRAPH_EDGE_OPERATOR_RE = /(-->|---|-\.->|==>)/;

function sequenceLineCore(trimmed: string): string {
  return trimmed.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, "").trim();
}

function graphEdgeLineCore(trimmed: string): string {
  return trimmed.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, "").trim();
}

/** Línea fuera del fence con arista de graph/flowchart (### N1 --> N2, viñetas). */
export function isOrphanGraphEdgeLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^#{1,2}\s+\d+\.\s/.test(trimmed)) return false;
  if (/^#{1,6}\s+\d+\.\d+\s/.test(trimmed)) return false;
  if (/^\|/.test(trimmed)) return false;
  if (/^---+\s*$/.test(trimmed)) return false;

  const core = graphEdgeLineCore(trimmed);
  if (!core) return false;
  if (/^(graph|flowchart)\s/i.test(core)) return false;
  return GRAPH_EDGE_OPERATOR_RE.test(core);
}

/** Línea fuera del fence con estilo Mermaid (style, classDef, linkStyle, class). */
export function isOrphanGraphStyleLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^#{1,2}\s+\d+\.\s/.test(trimmed)) return false;
  if (/^#{1,6}\s+\d+\.\d+\s/.test(trimmed)) return false;
  if (/^\|/.test(trimmed)) return false;
  if (/^---+\s*$/.test(trimmed)) return false;

  const core = graphEdgeLineCore(trimmed);
  if (!core) return false;
  return /^(style|classDef|linkStyle|class)\s+\S/.test(core);
}

function isAbsorbableGraphFragmentLine(trimmed: string): boolean {
  return isOrphanGraphEdgeLine(trimmed) || isOrphanGraphStyleLine(trimmed);
}

function normalizeOrphanGraphFragmentLine(line: string): string {
  let s = line.replace(/^(\s*)#{1,6}\s+/, "$1");
  if (/^(\s*)[-*]\s+/.test(s) && isAbsorbableGraphFragmentLine(s)) {
    s = s.replace(/^(\s*)[-*]\s+/, "$1    ");
  }
  return s;
}

export function isOrphanSequenceDiagramLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^#{1,2}\s+\d+\.\s/.test(trimmed)) return false;
  if (/^#{1,6}\s+\d+\.\d+\s/.test(trimmed)) return false;
  if (/^\|/.test(trimmed)) return false;
  if (/^---+\s*$/.test(trimmed)) return false;

  const core = sequenceLineCore(trimmed);
  if (!core) return false;
  if (/^sequenceDiagram\b/i.test(core)) return false;

  if (/^(participant|actor)\s/i.test(core)) return true;
  if (/^Note over\b/i.test(core)) return true;
  if (/^(alt|opt|loop|par|critical|break|rect|else|and|end)\b/i.test(core)) return true;
  if (/(-+>>|->>|--x|-x>)/.test(core)) return true;
  return false;
}

export function normalizeOrphanSequenceDiagramLine(line: string): string {
  let s = line.replace(/^(\s*)#{1,6}\s+/, "$1");
  if (/^(\s*)[-*]\s+/.test(s) && /(-+>>|->>|--x|-x>)/.test(s)) {
    s = s.replace(/^(\s*)[-*]\s+/, "$1    ");
  }
  return s;
}

/**
 * Fusiona líneas sequenceDiagram rotas fuera del fence (### Foo->>Bar, viñetas con flechas)
 * en el bloque ```mermaid precedente.
 */
export function repairFragmentedSequenceMermaidInDocument(document: string): string {
  if (!document?.trim()) return document ?? "";

  const lines = document.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!/^```mermaid\s*$/i.test(line.trim())) {
      out.push(line);
      i++;
      continue;
    }

    out.push(line);
    i++;
    const bodyLines: string[] = [];
    while (i < lines.length && !/^```\s*$/.test(lines[i]!.trim())) {
      bodyLines.push(lines[i]!);
      i++;
    }

    if (i >= lines.length) {
      out.push(...bodyLines);
      break;
    }

    const bodyText = bodyLines.join("\n");
    const isSequence = /sequenceDiagram/i.test(bodyText);

    if (isSequence) {
      i++;
      while (i < lines.length) {
        const trimmed = lines[i]!.trim();
        if (!trimmed) {
          let j = i + 1;
          while (j < lines.length && !lines[j]!.trim()) j++;
          if (j < lines.length && isOrphanSequenceDiagramLine(lines[j]!.trim())) {
            i++;
            continue;
          }
          break;
        }
        if (!isOrphanSequenceDiagramLine(trimmed)) break;
        bodyLines.push(normalizeOrphanSequenceDiagramLine(lines[i]!));
        i++;
      }
    } else {
      i++;
    }

    out.push(...bodyLines);
    out.push("```");
  }

  return out.join("\n");
}

/**
 * Fusiona aristas graph/flowchart rotas fuera del fence (### N1 --> N2, viñetas)
 * en el bloque ```mermaid precedente.
 */
export function repairFragmentedGraphMermaidInDocument(document: string): string {
  if (!document?.trim()) return document ?? "";

  const lines = document.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!/^```mermaid\s*$/i.test(line.trim())) {
      out.push(line);
      i++;
      continue;
    }

    out.push(line);
    i++;
    const bodyLines: string[] = [];
    while (i < lines.length && !/^```\s*$/.test(lines[i]!.trim())) {
      bodyLines.push(lines[i]!);
      i++;
    }

    if (i >= lines.length) {
      out.push(...bodyLines);
      break;
    }

    const bodyText = bodyLines.join("\n");
    const isGraph = /\b(graph|flowchart)\s/i.test(bodyText);

    if (isGraph) {
      i++;
      while (i < lines.length) {
        const trimmed = lines[i]!.trim();
        if (!trimmed) {
          let j = i + 1;
          while (j < lines.length && !lines[j]!.trim()) j++;
          if (j < lines.length && isAbsorbableGraphFragmentLine(lines[j]!.trim())) {
            bodyLines.push(lines[i]!);
            i++;
            continue;
          }
          break;
        }
        if (!isAbsorbableGraphFragmentLine(trimmed)) break;
        bodyLines.push(normalizeOrphanGraphFragmentLine(lines[i]!));
        i++;
      }
    } else {
      i++;
    }

    out.push(...bodyLines);
    out.push("```");
  }

  return out.join("\n");
}

/** Repara sequenceDiagram y graph/flowchart partidos fuera del fence. */
export function repairFragmentedMermaidInDocument(document: string): string {
  return repairFragmentedGraphMermaidInDocument(
    repairFragmentedSequenceMermaidInDocument(document),
  );
}
