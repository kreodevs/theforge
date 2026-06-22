/**
 * Minimal BRD F2 health: objective keywords should appear in MDD when both exist.
 */

export interface BrdHealthResult {
  ok: boolean;
  warnings: string[];
}

const OBJECTIVE_PATTERNS = [
  /(?:^|\n)#+\s*objetivo[s]?\b/im,
  /(?:^|\n)#+\s*goal[s]?\b/im,
  /(?:^|\n)#+\s*kpi[s]?\b/im,
  /(?:^|\n)-\s*objetivo:/im,
];

function extractObjectiveLines(brd: string): string[] {
  const lines = brd.split("\n").map((l) => l.trim()).filter(Boolean);
  const objectives: string[] = [];
  let inObjectiveSection = false;
  for (const line of lines) {
    if (/^#+\s*(objetivo|goal|kpi|alcance)/i.test(line)) {
      inObjectiveSection = true;
      continue;
    }
    if (inObjectiveSection && /^#+\s/.test(line) && !/^#+\s*(objetivo|goal|kpi|alcance)/i.test(line)) {
      inObjectiveSection = false;
    }
    if (inObjectiveSection && line.length > 12 && !line.startsWith("#")) {
      objectives.push(line.replace(/^[-*]\s*/, ""));
    }
  }
  if (objectives.length === 0 && OBJECTIVE_PATTERNS.some((p) => p.test(brd))) {
    const chunk = brd.slice(0, 4000);
    chunk.split("\n").forEach((l) => {
      const t = l.trim();
      if (t.length > 20 && !t.startsWith("#")) objectives.push(t.replace(/^[-*]\s*/, ""));
    });
  }
  return objectives.slice(0, 8);
}

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9áéíóúñ]+/i)
    .filter((w) => w.length >= 5)
    .slice(0, 12);
}

/** Returns warnings when BRD objectives are not reflected in MDD text. */
export function checkBrdObjectiveMentionHealth(
  brdContent: string | null | undefined,
  mddContent: string | null | undefined,
): BrdHealthResult {
  const brd = (brdContent ?? "").trim();
  const mdd = (mddContent ?? "").trim();
  if (!brd || !mdd) return { ok: true, warnings: [] };

  const objectives = extractObjectiveLines(brd);
  if (objectives.length === 0) {
    return {
      ok: false,
      warnings: ["BRD presente pero no se detectaron objetivos/KPIs estructurados para cruzar con el MDD."],
    };
  }

  const mddLower = mdd.toLowerCase();
  const warnings: string[] = [];
  for (const obj of objectives) {
    const tokens = significantTokens(obj);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((t) => mddLower.includes(t));
    if (hits.length < Math.max(1, Math.ceil(tokens.length * 0.25))) {
      warnings.push(
        `Objetivo BRD posiblemente ausente en MDD: "${obj.slice(0, 120)}${obj.length > 120 ? "…" : ""}"`,
      );
    }
  }
  return { ok: warnings.length === 0, warnings: warnings.slice(0, 6) };
}
