/**
 * Parseo de tasks.md para converge, export a GitHub Issues y MCP implement.
 * Compatible con formato spec-kit: `[P]`, rutas de archivo, checkpoints por user story.
 */

export interface ParsedTaskItem {
  line: number;
  title: string;
  /** Título sin prefijo `[P]` ni IDs tipo T-001. */
  cleanTitle: string;
  section: string;
  done: boolean;
  /** Marcador spec-kit de tarea paralelizable dentro del checkpoint actual. */
  parallel: boolean;
  /** Rutas `src/...` o `**Archivo:**` extraídas del ítem. */
  filePaths: string[];
  /** Checkpoint de la user story activa (línea `**Checkpoint**:` o `### Checkpoint`). */
  checkpoint: string | null;
}

const TASK_LINE = /^(\s*)- \[( |x|X)\]\s+(.+)$/;
const SECTION_HEADING = /^##\s+(.+)$/;
const CHECKPOINT_LINE = /^\*{0,2}Checkpoint\*{0,2}\s*:\s*(.+)$/i;
const FILE_PATH_INLINE = /(?:`([^`]+)`|\*\*Archivo:\*\*\s*([^\s\n]+)|\b((?:src|apps|packages)\/[\w./-]+))/gi;
export {
  countClarificationMarkers,
  specHasPendingClarificationSection,
} from "./document-clarification.js";

function stripParallelPrefix(title: string): { parallel: boolean; clean: string } {
  const m = title.match(/^\[P\]\s+/i);
  if (m) {
    return { parallel: true, clean: title.slice(m[0].length).trim() };
  }
  return { parallel: false, clean: title };
}

function extractFilePaths(text: string): string[] {
  const paths = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(FILE_PATH_INLINE.source, FILE_PATH_INLINE.flags);
  while ((match = re.exec(text)) !== null) {
    const p = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (p.length > 2 && !p.startsWith("http")) paths.add(p);
  }
  return [...paths];
}

/**
 * Extrae ítems de checklist del markdown Tasks (formato The Forge + spec-kit).
 */
export function parseTasksMarkdown(md: string): ParsedTaskItem[] {
  const lines = (md ?? "").split("\n");
  const items: ParsedTaskItem[] = [];
  let currentSection = "General";
  let currentCheckpoint: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const sectionMatch = line.match(SECTION_HEADING);
    if (sectionMatch?.[1]) {
      currentSection = sectionMatch[1].trim();
      currentCheckpoint = null;
      continue;
    }
    const cpMatch = line.match(CHECKPOINT_LINE);
    if (cpMatch?.[1]) {
      currentCheckpoint = cpMatch[1].trim();
      continue;
    }
    const taskMatch = line.match(TASK_LINE);
    if (!taskMatch?.[3]) continue;
    const done = (taskMatch[2] ?? " ").toLowerCase() === "x";
    const rawTitle = taskMatch[3].trim();
    if (rawTitle.length === 0) continue;
    const { parallel, clean } = stripParallelPrefix(rawTitle);
    items.push({
      line: i + 1,
      title: rawTitle,
      cleanTitle: clean,
      section: currentSection,
      done,
      parallel,
      filePaths: extractFilePaths(rawTitle),
      checkpoint: currentCheckpoint,
    });
  }

  return items;
}

export function filterOpenTasks(items: ParsedTaskItem[]): ParsedTaskItem[] {
  return items.filter((t) => !t.done);
}

/** Lista checkpoints únicos en orden de aparición. */
export function extractTaskCheckpoints(md: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of (md ?? "").split("\n")) {
    const m = line.match(CHECKPOINT_LINE);
    if (m?.[1]) {
      const cp = m[1].trim();
      if (!seen.has(cp)) {
        seen.add(cp);
        out.push(cp);
      }
    }
  }
  return out;
}

/** Primera tarea abierta (orden documento) — equivalente ligero a `/speckit.implement` next task. */
export function getNextOpenTask(items: ParsedTaskItem[]): ParsedTaskItem | null {
  const open = filterOpenTasks(items);
  return open[0] ?? null;
}

/** Etiqueta GitHub segura desde nombre de sección. */
export function sectionToIssueLabel(section: string): string {
  const s = section
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s.length > 0 ? `theforge:${s}` : "theforge:task";
}
