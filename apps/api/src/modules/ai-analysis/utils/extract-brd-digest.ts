/**
 * Deterministic BRD/DBGA digest for large clarifier inputs (Phase 1).
 * Keeps headings, entities, MVP module IDs, KPIs and constraints within ~8–12K chars.
 */

export const BRD_DIGEST_INPUT_THRESHOLD = 12_000;
export const BRD_DIGEST_TARGET_MAX = 12_000;
export const BRD_DIGEST_TARGET_MIN = 8_000;

const CONSTRAINT_SECTION_RE =
  /^(?:fuera del alcance|dentro del alcance|restricciones?|riesgos?|métricas de [ée]xito|kpis?|criterios de [ée]xito|objetivos comerciales|impacto financiero)/i;

const KPI_LINE_RE =
  /\b(kpi|métrica|metric|objetivo numérico|tasa de|tiempo de|latencia|throughput|disponibilidad|uptime|sla)\b/i;

function trimToMax(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastBreak = cut.lastIndexOf("\n\n");
  if (lastBreak > max * 0.75) return cut.slice(0, lastBreak).trimEnd() + "\n\n...(digest truncado)";
  return cut.trimEnd() + "\n\n...(digest truncado)";
}

function extractHeadingBlocks(content: string): string[] {
  const blocks: string[] = [];
  const lines = content.split("\n");
  let current: string[] = [];
  let inBlock = false;

  const flush = () => {
    if (current.length === 0) return;
    const body = current.join("\n").trim();
    if (body.length > 0) blocks.push(body);
    current = [];
    inBlock = false;
  };

  for (const line of lines) {
    const isHeading = /^#{1,4}\s+/.test(line);
    if (isHeading) {
      flush();
      current.push(line);
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (/^\s*[-*]\s+/.test(line) || line.trim().length > 0) {
      current.push(line);
    }
    if (current.join("\n").length > 900) flush();
  }
  flush();
  return blocks;
}

function extractEntitySignals(content: string): string[] {
  const found = new Set<string>();
  for (const m of content.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z_][a-z0-9_]*)/gi)) {
    if (m[1]) found.add(m[1].toLowerCase());
  }
  for (const m of content.matchAll(/\b(?:tabla|entidad|entity|table)\s*[:\-]?\s*[`"]?([a-z_][a-z0-9_]*)/gi)) {
    if (m[1] && m[1].length >= 3) found.add(m[1].toLowerCase());
  }
  for (const m of content.matchAll(/^###\s+(?:\d+(?:\.\d+)*\s+)?(.+)$/gm)) {
    const title = (m[1] ?? "").replace(/\*\*/g, "").trim();
    if (title.length >= 4 && title.length <= 120) found.add(`cap:${title}`);
  }
  return [...found].sort();
}

function extractMvpModuleIds(content: string): string[] {
  const ids = new Set<string>();
  for (const m of content.matchAll(/^###\s+(\d+(?:\.\d+)*)\s+/gm)) ids.add(m[1]!);
  for (const m of content.matchAll(/\b(cap-\d+(?:\.\d+)*)\b/gi)) ids.add(m[1]!.toLowerCase());
  for (const m of content.matchAll(/\bMVP\s*[-:]?\s*([A-Z0-9._-]+)/gi)) ids.add(`mvp:${m[1]}`);
  return [...ids].sort();
}

function extractKpiLines(content: string): string[] {
  const lines: string[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (KPI_LINE_RE.test(t) && t.length >= 12 && t.length <= 400) lines.push(t);
    if (lines.length >= 24) break;
  }
  return lines;
}

function extractConstraintBlocks(blocks: string[]): string[] {
  const picked: string[] = [];
  for (const block of blocks) {
    const firstLine = block.split("\n")[0]?.replace(/^#+\s*/, "").trim() ?? "";
    if (CONSTRAINT_SECTION_RE.test(firstLine) || CONSTRAINT_SECTION_RE.test(block.slice(0, 200))) {
      picked.push(block.slice(0, 1200));
    }
    if (picked.length >= 8) break;
  }
  return picked;
}

/**
 * Returns a condensed digest when `content` exceeds the threshold; otherwise returns input unchanged.
 */
export function extractBrdDigest(
  content: string,
  opts?: { inputThreshold?: number; targetMax?: number },
): { digest: string; usedDigest: boolean; originalLen: number } {
  const originalLen = content.length;
  const threshold = opts?.inputThreshold ?? BRD_DIGEST_INPUT_THRESHOLD;
  if (originalLen <= threshold) {
    return { digest: content, usedDigest: false, originalLen };
  }

  const targetMax = opts?.targetMax ?? BRD_DIGEST_TARGET_MAX;
  const headingBlocks = extractHeadingBlocks(content);
  const entities = extractEntitySignals(content);
  const mvpIds = extractMvpModuleIds(content);
  const kpis = extractKpiLines(content);
  const constraints = extractConstraintBlocks(headingBlocks);

  const parts: string[] = [
    "## BRD Digest (entrada condensada para Clarifier)",
    "",
    `Origen: ${originalLen} caracteres → digest objetivo ≤${targetMax}.`,
    "",
  ];

  if (mvpIds.length > 0) {
    parts.push("### Módulos / capacidades MVP", "", mvpIds.map((id) => `- ${id}`).join("\n"), "");
  }
  if (entities.length > 0) {
    parts.push("### Entidades y tablas detectadas", "", entities.map((e) => `- ${e}`).join("\n"), "");
  }
  if (kpis.length > 0) {
    parts.push("### KPIs y métricas", "", kpis.map((k) => `- ${k}`).join("\n"), "");
  }
  if (constraints.length > 0) {
    parts.push("### Restricciones y fronteras", "", constraints.join("\n\n"), "");
  }

  const priorityHeadings = headingBlocks
    .filter((b) => {
      const h = b.split("\n")[0] ?? "";
      return /^#{1,3}\s/.test(h);
    })
    .slice(0, 40);

  if (priorityHeadings.length > 0) {
    parts.push("### Secciones clave (encabezados + extracto)", "", priorityHeadings.join("\n\n"));
  }

  let digest = parts.join("\n").trim();
  if (digest.length < BRD_DIGEST_TARGET_MIN && headingBlocks.length > 0) {
    const filler = headingBlocks.slice(0, 60).join("\n\n");
    digest = `${digest}\n\n### Contenido adicional\n\n${filler}`;
  }

  digest = trimToMax(digest, targetMax);
  return { digest, usedDigest: true, originalLen };
}
