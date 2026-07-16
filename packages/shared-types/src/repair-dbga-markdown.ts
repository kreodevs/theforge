/**
 * Reparaciones heurísticas para DBGA / Fase 0 mal formateados por el LLM:
 * - Bloques ```text que envuelven markdown (headings, reglas, tablas)
 * - Pasos de flujo en pseudo-tablas `|  | 1. | … |`
 * - Secciones numeradas sin `##` (p. ej. `7. Roles y Permisos`)
 * - Viñetas pegadas `-**R5.1**`
 * - Headings duplicados consecutivos
 */

const DBGA_SHAPE_RE =
  /^#\s+(?:Domain Benchmark|Fase 0\s*[—-])/im;

const BARE_DBGA_SECTION_RE =
  /^(\d+\.\s+(?:Propósito y Alcance|Entidades del Dominio|Especificaciones Técnicas|Reglas de Negocio|Flujos Principales|Roles y Permisos|Integraciones Externas|Edge Cases y Supuestos|Preguntas Pendientes)[^\n]*)$/i;

/** Pasos de flujo en tabla GFM rota: `|  | 1. | texto |` */
const FLOW_TABLE_STEP_RE = /^\|\s*\|\s*(\d+)\.\s*\|\s*(.+?)\s*\|?\s*$/;

function isDbgaShaped(text: string): boolean {
  return DBGA_SHAPE_RE.test(text ?? "");
}

function shouldUnwrapTextFenceBody(body: string): boolean {
  const lines = body.split("\n");
  let score = 0;
  for (const line of lines) {
    const t = line.trim();
    if (/^##\s+\d+\./.test(t)) score += 3;
    if (/^###\s+\d+\./.test(t)) score += 2;
    if (/^-\*\*R\d/.test(t)) score += 2;
    if (FLOW_TABLE_STEP_RE.test(t)) score += 2;
    if (/^\|\s*[^\|]+\|\s*---/.test(t)) score += 1;
    if (/^\|\s*Rol\s+\|/i.test(t)) score += 2;
    if (/^\|\s*•\s*\|/.test(t)) score += 2;
  }
  return score >= 2;
}

/** Quita fences ```text cuando el cuerpo es markdown estructurado, no diagrama ASCII. */
export function unwrapMarkdownInTextFences(text: string): string {
  if (!text?.trim()) return text ?? "";
  return text.replace(/```text\s*\n([\s\S]*?)```/gi, (full, body: string) => {
    if (!shouldUnwrapTextFenceBody(body)) return full;
    return `\n${body.trim()}\n`;
  });
}

/** Convierte pseudo-tablas de pasos de flujo a listas ordenadas. */
export function repairFlowStepPseudoTables(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const stepMatch = line.trim().match(FLOW_TABLE_STEP_RE);
    if (stepMatch) {
      const block: string[] = [`${stepMatch[1]}. ${stepMatch[2]!.trim()}`];
      i += 1;
      if (i < lines.length && /^\|\s*---/.test(lines[i]!.trim())) i += 1;
      while (i < lines.length) {
        const next = lines[i]!.trim();
        const m = next.match(FLOW_TABLE_STEP_RE);
        if (!m) break;
        block.push(`${m[1]}. ${m[2]!.trim()}`);
        i += 1;
      }
      out.push(...block, "");
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n");
}

/** Promueve `7. Roles y Permisos` → `## 7. Roles y Permisos` en documentos DBGA. */
export function promoteBareDbgaSectionHeadings(text: string): string {
  if (!isDbgaShaped(text)) return text;
  const lines = text.split("\n");
  return lines
    .map((line) => {
      const t = line.trim();
      if (/^#{1,6}\s/.test(t)) return line;
      const m = t.match(BARE_DBGA_SECTION_RE);
      if (!m) return line;
      const indent = line.match(/^(\s*)/)?.[1] ?? "";
      return `${indent}## ${m[1]!.trim()}`;
    })
    .join("\n");
}

/** `-**R5.1**` → `- **R5.1**`; `-**Responsabilidad:**` → `- **Responsabilidad:**`. */
export function repairGluedDbgaBullets(text: string): string {
  return text
    .replace(/^(\s*)-\*\*([R]\d+\.\d+)\*\*/gm, "$1- **$2**")
    .replace(/^(\s*)-\*\*([R]\d+\.\d+)\*\*\s*-/gm, "$1- **$2** -")
    .replace(/^(\s*)-\*\*(Responsabilidad|Estado|Flujo):\*\*/gim, "$1- **$2:**")
    .replace(/^(\s*)\*\*(\d+)\s+([^*]+)\*\*/gm, (full, indent, num, title) => {
      if (/Translation Engine|Alpha Engine|Execution|Data Ingestion|LLM Orchestrator|Notification Service/i.test(title)) {
        return `${indent}- **${num}. ${title.trim()}**`;
      }
      return full;
    });
}

/** Elimina líneas de heading idénticas consecutivas. */
export function repairDuplicateAdjacentHeadings(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    const prev = out[out.length - 1]?.trim() ?? "";
    if (t && t === prev && /^#{1,6}\s/.test(t)) continue;
    out.push(line);
  }
  return out.join("\n");
}

/** Cierra fences ``` abiertos erróneamente tras `#### N.M` sin cuerpo de diagrama. */
export function repairStrayFenceAfterSubheading(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const t = line.trim();
    out.push(line);
    if (/^#{4,6}\s+\d/.test(t)) {
      const next = (lines[i + 1] ?? "").trim();
      const next2 = (lines[i + 2] ?? "").trim();
      if (next === "```" && next2 === "```") {
        i += 2;
        continue;
      }
      if (next === "```" && next2 === "") {
        i += 1;
        continue;
      }
    }
    i += 1;
  }
  return out.join("\n");
}

/** Pipeline DBGA — solo aplica si el documento tiene forma DBGA/Fase 0. */
export function repairDbgaMarkdown(text: string): string {
  if (!text?.trim() || !isDbgaShaped(text)) return text ?? "";
  let out = text;
  out = repairStrayFenceAfterSubheading(out);
  out = unwrapMarkdownInTextFences(out);
  out = repairStrayFenceAfterSubheading(out);
  out = unwrapMarkdownInTextFences(out);
  out = promoteBareDbgaSectionHeadings(out);
  out = repairGluedDbgaBullets(out);
  out = repairFlowStepPseudoTables(out);
  out = repairDuplicateAdjacentHeadings(out);
  return out;
}
