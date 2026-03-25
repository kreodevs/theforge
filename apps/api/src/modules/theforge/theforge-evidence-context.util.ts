import type { AskCodebaseOptions } from "./theforge.service.js";

/**
 * API mínima del cliente TheForge/MCP para armar contexto “evidencia primero”.
 */
export interface TheForgeEvidenceApi {
  semanticSearch(query: string, projectId?: string, limit?: number): Promise<string>;
  getFunctionsInFile(path: string, projectId?: string, currentFilePath?: string): Promise<string>;
  getFileContent(path: string, projectId: string, ref?: string, currentFilePath?: string): Promise<string>;
  askCodebase(question: string, projectId: string, opts?: AskCodebaseOptions): Promise<string>;
}

export const DEFAULT_SEMANTIC_QUERIES = [
  "data models entities database schema prisma tables",
  "API routes endpoints controllers services nest express",
  "UI components screens pages views react vue",
] as const;

const RE_BACKTICK_PATH =
  /`([^\s`]+\.(?:ts|tsx|js|jsx|mjs|cjs|prisma|json|ya?ml|vue|svelte|md|sql|py|go|java|kt|rs|cs))`/gi;

/** Rutas tipo apps/api/src/foo.ts en texto MCP (sin backticks). */
const RE_SLASH_PATH =
  /(?:^|[\s"'(>[\]])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.(?:ts|tsx|js|jsx|mjs|cjs|prisma|json|ya?ml|vue|svelte|md|sql))(?=[\s)'"<,\]]|$)/gm;

function envFlag(name: string, defaultTrue: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return defaultTrue;
  return !["0", "false", "off", "no"].includes(v);
}

function envInt(name: string, fallback: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Activa pipeline evidencia-primero (documentación legacy / entregables). Default: activo. */
export function isLegacyEvidenceFirstEnabled(): boolean {
  return envFlag("LEGACY_EVIDENCE_FIRST_CONTEXT", true);
}

function parsePositiveInt(name: string, fallback: number): number {
  return envInt(name, fallback);
}

/**
 * Extrae rutas de archivo plausibles de salidas del MCP (markdown, listas, backticks).
 */
export function extractCandidatePathsFromMcpText(text: string): string[] {
  if (!text?.trim()) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(RE_BACKTICK_PATH)) {
    const p = m[1]?.trim();
    if (p && !p.includes("..") && p.length > 2) out.add(p.replace(/^\/+/, ""));
  }
  for (const m of text.matchAll(RE_SLASH_PATH)) {
    const p = m[1]?.trim();
    if (p && !p.includes("..") && p.length > 2) out.add(p);
  }
  return [...out];
}

function pathPriority(p: string): number {
  const lower = p.toLowerCase();
  let score = 0;
  if (lower.endsWith("schema.prisma") || lower.includes("prisma/schema")) score += 100;
  if (lower.endsWith("package.json") || lower.endsWith("turbo.json")) score += 80;
  if (lower.includes("/routes/") || lower.includes("\\routes\\")) score += 40;
  if (lower.includes("app.module") || lower.includes("main.ts")) score += 35;
  if (lower.endsWith(".prisma")) score += 50;
  return score;
}

function sortPathsByPriority(paths: string[]): string[] {
  return [...new Set(paths)].sort((a, b) => pathPriority(b) - pathPriority(a) || a.localeCompare(b));
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n… [recortado por LEGACY_SEMANTIC_SECTION_MAX_CHARS]";
}

/** Recorte configurable para bloques semantic_search (modo legacy clásico). */
export function clipLegacySemanticSection(s: string): string {
  const max = parsePositiveInt("LEGACY_SEMANTIC_SECTION_MAX_CHARS", 6000);
  return clip(s.trim(), max);
}

async function mapInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const part = await Promise.all(chunk.map(fn));
    results.push(...part);
  }
  return results;
}

export interface BuildLegacyEvidenceMarkdownOptions {
  /** Consultas semantic_search (eje modelos / API / UI). */
  semanticQueries?: readonly string[];
  /** Incluir párrafo de síntesis vía ask_codebase (solo re-afirma evidencia). */
  includeSynthesis?: boolean;
}

/**
 * Construye Markdown de contexto: búsqueda semántica + rutas extraídas + símbolos por archivo + extractos de archivos prioritarios.
 * Pensado para SDD legacy: la síntesis va después y debe citar solo lo presente en el bloque de evidencia.
 */
export async function buildLegacyEvidenceMarkdown(
  api: TheForgeEvidenceApi,
  projectId: string,
  options?: BuildLegacyEvidenceMarkdownOptions,
): Promise<string> {
  const queries = options?.semanticQueries?.length ? options.semanticQueries : [...DEFAULT_SEMANTIC_QUERIES];
  const semanticLimit = parsePositiveInt("LEGACY_SEMANTIC_SEARCH_LIMIT", 12);
  const maxPaths = parsePositiveInt("LEGACY_EVIDENCE_MAX_PATHS", 35);
  const maxFnPaths = parsePositiveInt("LEGACY_EVIDENCE_FUNCTIONS_PATHS", 20);
  const maxFullFiles = parsePositiveInt("LEGACY_EVIDENCE_FULL_FILE_PATHS", 3);
  const sectionMax = parsePositiveInt("LEGACY_SEMANTIC_SECTION_MAX_CHARS", 6000);
  const fileContentMax = parsePositiveInt("LEGACY_FILE_CONTENT_MAX_CHARS", 4000);

  const semanticChunks = await Promise.all(
    queries.map((q) => api.semanticSearch(q.trim(), projectId, semanticLimit)),
  );

  const mergedSemantic = semanticChunks.filter(Boolean).join("\n\n");
  const extracted = extractCandidatePathsFromMcpText(mergedSemantic);
  const sorted = sortPathsByPriority(extracted);
  const chosen = sorted.slice(0, maxPaths);
  const fnPaths = chosen.slice(0, maxFnPaths);

  const fnBlocks = await mapInBatches(fnPaths, 4, async (path) => {
    const body = await api.getFunctionsInFile(path, projectId, path);
    if (!body?.trim()) return "";
    return `### \`${path}\`\n\n${body.trim()}`;
  });

  const fullFileTargets = chosen.slice(0, maxFullFiles);
  const fileBlocks = await Promise.all(
    fullFileTargets.map(async (path) => {
      const content = await api.getFileContent(path, projectId, undefined, path);
      if (!content?.trim()) return "";
      const clipped = content.length > fileContentMax ? content.slice(0, fileContentMax) + "\n…" : content;
      return `### Extracto: \`${path}\`\n\n\`\`\`\n${clipped}\n\`\`\``;
    }),
  );

  const sections: string[] = [];
  sections.push("# Contexto TheForge — evidencia (índice)\n");
  sections.push(
    "## 1. Búsqueda semántica (grafo)\n\n" +
      queries
        .map((q, i) => `### Query: ${q}\n\n${clip(semanticChunks[i]?.trim() ?? "", sectionMax)}`)
        .join("\n\n---\n\n"),
  );

  if (chosen.length > 0) {
    sections.push("## 2. Rutas candidatas extraídas del índice\n\n" + chosen.map((p) => `- \`${p}\``).join("\n"));
  }

  const fnJoined = fnBlocks.filter(Boolean).join("\n\n---\n\n");
  if (fnJoined) sections.push("## 3. Símbolos por archivo (get_functions_in_file)\n\n" + fnJoined);

  const filesJoined = fileBlocks.filter(Boolean).join("\n\n---\n\n");
  if (filesJoined) sections.push("## 4. Extractos de archivo (prioritarios)\n\n" + filesJoined);

  const evidenceBody = sections.join("\n\n---\n\n");

  if (options?.includeSynthesis === false) return evidenceBody;

  const synthPrompt =
    "Below is EVIDENCE from the indexed graph (semantic search + symbols + optional file excerpts). " +
    "Write a concise section in Spanish titled '## Resumen ejecutivo (solo evidencia)'. " +
    "Use at most 20 bullet points. Each bullet must restate something explicitly present in the evidence (file paths, symbols, endpoints). " +
    "If the evidence does not mention a topic, write '(no consta en el índice)' for that topic — do NOT invent stacks, files, or APIs.\n\n---\n\n" +
    clip(evidenceBody, parsePositiveInt("LEGACY_SYNTHESIS_INPUT_MAX_CHARS", 28000));

  const synthesis = await api.askCodebase(synthPrompt, projectId, {
    twoPhase: true,
    responseMode: "evidence_first",
  });
  if (!synthesis?.trim()) return evidenceBody;

  return evidenceBody + "\n\n---\n\n" + synthesis.trim();
}

/** Cuenta referencias a rutas/código en un MDD para heurística de calidad SDD. */
export function countMddCodePathReferences(mdd: string): number {
  if (!mdd?.trim()) return 0;
  let n = 0;
  const reTick = /`[^`]+\.(?:ts|tsx|js|jsx|prisma|json|ya?ml|vue|svelte|md)`/gi;
  while (reTick.exec(mdd) !== null) n++;
  const reBare = /(?:^|\s)(?:[\w.-]+\/){2,}[\w.-]+\.(?:ts|tsx|js|jsx|prisma|json)/gm;
  while (reBare.exec(mdd) !== null) n++;
  return n;
}
