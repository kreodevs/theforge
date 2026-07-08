/**
 * Árboles de directorios del Blueprint pegados en una sola línea → bloque ```text multilínea.
 */

const TREE_BRANCH_RE = /(?:├──|└──|├─|└─|│\s|—\s*\|)/;
const TREE_PATH_RE = /(?:^|[^\w/])(?:apps|packages|src|backend|frontend|docker|deploy|\.github)[/\\]/i;
const TREE_DASH_CLASS = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;

function normalizeTreeLine(line: string): string {
  return line.replace(TREE_DASH_CLASS, "—");
}

/** Línea única con varios conectores de árbol o rutas típicas de monorepo. */
export function isCollapsedDirectoryTreeLine(line: string): boolean {
  const t = normalizeTreeLine(line.trim());
  if (t.length < 40) return false;
  if (t.startsWith("|") || t.startsWith("│") || t.startsWith("```")) return false;
  if (/^[┌└├┘┬┴┼]/.test(t)) return false;
  if (/[┌┐└┘│┃─━]/.test(t) && !TREE_PATH_RE.test(t)) return false;
  if (/\(\(Root\)\)/i.test(t) && TREE_PATH_RE.test(t)) return true;
  const markers = (t.match(/(?:├──|└──|│|—\s*\||\/—|—\s+(?=apps\/|packages\/|docker|deploy|\.github))/gi) ?? [])
    .length;
  const paths = (t.match(TREE_PATH_RE) ?? []).length;
  return markers >= 3 || (markers >= 1 && paths >= 2) || paths >= 3;
}

/** Párrafo markdown que debería mostrarse como árbol (preview sin fence). */
export function looksLikeDirectoryTreeParagraph(text: string): boolean {
  const collapsed = normalizeTreeLine(text.replace(/\s+/g, " ").trim());
  if (!collapsed) return false;
  if ((collapsed.match(/[|│]/g) ?? []).length >= 2) return false;
  if (/[┌┐└┘┬┴┼▼▲│┃─━]/.test(collapsed)) return false;
  if (/_{4,}/.test(collapsed)) return false;
  if (isCollapsedDirectoryTreeLine(collapsed)) return true;
  if (/\(\(Root\)\)/i.test(collapsed) && TREE_PATH_RE.test(collapsed)) return true;
  if (/[├└│]/.test(collapsed) && TREE_PATH_RE.test(collapsed)) return true;
  const pathHits = (collapsed.match(TREE_PATH_RE) ?? []).length;
  return pathHits >= 2 && /(?:—\s*\||\/—|—\s+apps\/)/i.test(collapsed);
}

/** Parte una línea colapsada en entradas de árbol (una por línea). */
export function splitCollapsedDirectoryTree(line: string): string[] {
  let s = normalizeTreeLine(line.trim());
  s = s.replace(/\(\(Root\)\)\s*/gi, "/\n");
  s = s.replace(/\s*—\s*\|\s*—\s*/g, "\n");
  s = s.replace(/\s*\/\s*—\s*/g, "/\n");
  s = s.replace(/\s+(?=(?:├──|└──|├─|└─))/g, "\n");
  s = s.replace(/\s*\|\s*(?=(?:├──|│))/g, "\n");
  s = s.replace(/\s+—\s+(?=(?:apps\/|packages\/|docker|deploy\/|\.github\/|\(\(|# ))/gi, "\n");
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function wrapAsTextFence(lines: string[]): string {
  return ["```text", ...lines, "```"].join("\n");
}

function repairCollapsedLine(line: string): string {
  if (!isCollapsedDirectoryTreeLine(line)) return line;
  return wrapAsTextFence(splitCollapsedDirectoryTree(line));
}

function isDirectoryTreeBlock(lines: string[]): boolean {
  if (lines.length < 2) return false;
  const pathish = lines.filter((l) => {
    const t = l.trim();
    if (!t || t.startsWith("```")) return false;
    return (
      t === "/" ||
      TREE_BRANCH_RE.test(t) ||
      /[/\\]/.test(t) ||
      /^[a-z0-9_.-]+\/$/i.test(t)
    );
  }).length;
  return pathish >= 2;
}

/** Repara árbol colapsado tras encabezado «Árbol de directorios» / «Estructura del proyecto». */
function repairAfterTreeHeading(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    out.push(line);

    const isTreeHeading =
      /^#{1,4}\s+.*(?:árbol de directorios|estructura del (?:proyecto|monorepo)|directory tree)/i.test(
        line.trim(),
      ) ||
      /^\*\*Árbol de directorios/i.test(line.trim()) ||
      /^(?:\*\*)?Árbol de directorios(?:\*\*)?(?:\s*\([^)]+\))?\s*$/i.test(line.trim());

    if (!isTreeHeading) {
      i++;
      continue;
    }

    i++;
    const block: string[] = [];
    while (i < lines.length) {
      const t = lines[i]!.trim();
      if (!t) {
        if (block.length) break;
        i++;
        continue;
      }
      if (/^#{1,4}\s+/.test(t) || /^```/.test(t)) break;
      block.push(lines[i]!);
      i++;
    }

    if (block.length === 0) continue;

    const joined = block.map((l) => l.trim()).join(" ");
    if (isCollapsedDirectoryTreeLine(joined)) {
      out.push("");
      out.push(repairCollapsedLine(joined));
      out.push("");
      continue;
    }

    const inFence = block[0]?.trim().startsWith("```");
    if (!inFence && (block.some((l) => TREE_BRANCH_RE.test(l)) || isDirectoryTreeBlock(block))) {
      out.push("");
      out.push(wrapAsTextFence(block.map((l) => l.trimEnd())));
      out.push("");
      continue;
    }

    out.push(...block);
  }

  return out.join("\n");
}

/** Repara líneas sueltas colapsadas en todo el documento (p. ej. Blueprint §1). */
export function repairDirectoryTreeBlocks(text: string): string {
  if (!text?.trim()) return text ?? "";

  let out = repairAfterTreeHeading(text.replace(/\r\n/g, "\n"));

  const lines = out.split("\n");
  const rebuilt: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const t = line.trim();
    if (/^```/.test(t)) {
      inFence = t !== "```";
      rebuilt.push(line);
      continue;
    }
    if (inFence) {
      if (isCollapsedDirectoryTreeLine(line)) {
        rebuilt.push(...splitCollapsedDirectoryTree(line));
        continue;
      }
      rebuilt.push(line);
      continue;
    }
    if (isCollapsedDirectoryTreeLine(line)) {
      rebuilt.push(repairCollapsedLine(line));
      continue;
    }
    rebuilt.push(line);
  }

  return rebuilt.join("\n");
}
