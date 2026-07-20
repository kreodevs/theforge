/**
 * Matriz competitiva explícita en DBGA (benchmark) — gap si el producto la exige y falta.
 */

export type DbgaBenchmarkMatrixRow = {
  competitor: string;
  capability: string;
  gap?: string;
  ourPosition?: string;
};

export type DbgaBenchmarkMatrixReport = {
  hasExplicitMatrix: boolean;
  rows: DbgaBenchmarkMatrixRow[];
  gaps: string[];
};

const MATRIX_HEADING_RE =
  /(?:matriz\s+competitiva|benchmark\s+matrix|comparativa\s+de\s+mercado|competitive\s+matrix|an[aá]lisis\s+competitivo)/i;

function parseMatrixTable(section: string): DbgaBenchmarkMatrixRow[] {
  const rows: DbgaBenchmarkMatrixRow[] = [];
  for (const line of section.split("\n")) {
    if (!line.includes("|") || /^\|\s*[-:]+\s*\|/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const headerLike = /competidor|competitor|capacidad|capability|feature/i.test(cells.join(" "));
    if (headerLike) continue;
    rows.push({
      competitor: cells[0] ?? "",
      capability: cells[1] ?? "",
      gap: cells[2],
      ourPosition: cells[3],
    });
  }
  return rows.filter((r) => r.competitor.length > 2 && r.capability.length > 2);
}

/** Extrae matriz competitiva del DBGA si existe; advierte si el doc promete benchmark y no hay tabla. */
export function extractDbgaBenchmarkMatrix(dbgaMarkdown: string): DbgaBenchmarkMatrixReport {
  const text = (dbgaMarkdown ?? "").trim();
  const gaps: string[] = [];
  if (text.length < 300) {
    return { hasExplicitMatrix: false, rows: [], gaps };
  }

  const promisesBenchmark =
    MATRIX_HEADING_RE.test(text) ||
    /\b(benchmark|comparativa|competidor|matriz)\b/i.test(text.slice(0, 4000));

  const sectionStart = text.search(MATRIX_HEADING_RE);
  let rows: DbgaBenchmarkMatrixRow[] = [];
  if (sectionStart >= 0) {
    const section = text.slice(sectionStart, sectionStart + 12000);
    rows = parseMatrixTable(section);
  }

  if (rows.length === 0) {
    for (const block of text.match(/(\|[^\n]+\|\n)+/g) ?? []) {
      const parsed = parseMatrixTable(block);
      if (parsed.length >= 2) {
        rows = parsed;
        break;
      }
    }
  }

  const hasExplicitMatrix = rows.length >= 2;
  if (promisesBenchmark && !hasExplicitMatrix) {
    gaps.push(
      "DBGA promete benchmark/matriz competitiva pero no hay tabla explícita (Competidor | Capacidad | Gap | Posición).",
    );
  }

  return { hasExplicitMatrix, rows, gaps };
}

export function formatDbgaBenchmarkMatrixGaps(report: DbgaBenchmarkMatrixReport): string[] {
  return report.gaps;
}
