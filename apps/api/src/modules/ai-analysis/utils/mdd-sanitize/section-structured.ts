/** Conversión structured JSON → markdown (§6, §7, §3, objetos genéricos). */
import { sqlToErDiagramContent } from "../mdd-diagram-suggestions.js";
import { buildNewFormatManifestFromIdentifiedTerms } from "./infra-manifest.js";

/** Línea que es solo el título de la sección (evitar duplicar "6. Seguridad" en el cuerpo). */
const reSection6TitleOnly = /^\s*(###?\s*)?6\.\s*Seguridad\s*$/i;

/** Detecta subsección por número (6.1, 6.2) o por **Título:** */
const reSection6SubsectionNum = /^\d+\.\d+\s+.+$/;
const reSection6BoldHeading = /^\*\*[^*]+\*\*:\s*$/; // **Autenticación y Autorización:**

const SECTION6_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Formato canónico §6: ## Aspectos Generales + párrafo intro + ### A. / B. / C. con * bullets; Conclusión en blockquote.
 */
function formatSection6AspectosGenerales(lines: string[]): string {
  const normalized = lines
    .map((c) => c.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
    .filter((c) => c && !reSection6TitleOnly.test(c));
  const intro: string[] = [];
  const groups: { title: string; lines: string[] }[] = [];
  let i = 0;
  while (i < normalized.length) {
    const line = normalized[i]!;
    if (reSection6BoldHeading.test(line)) {
      const title = line.replace(/^\*\*|\*\*:\s*$/g, "").trim();
      const groupLines: string[] = [];
      i++;
      while (i < normalized.length && !reSection6BoldHeading.test(normalized[i]!)) {
        groupLines.push(normalized[i]!);
        i++;
      }
      groups.push({ title, lines: groupLines });
    } else {
      intro.push(line);
      i++;
    }
  }
  const out: string[] = [];
  if (intro.length) out.push(intro.join(" ").trim(), "");
  groups.forEach((g, idx) => {
    const letter = SECTION6_LETTERS[idx] ?? String(idx + 1);
    const title = g.title.trim();
    if (/^conclusi[oó]n$/i.test(title)) {
      const text = g.lines.length ? g.lines.join(" ").trim() : "(Pendiente.)";
      out.push("> **Conclusión:** " + text, "");
      return;
    }
    out.push(`### ${letter}. ${title}`);
    out.push("");
    g.lines.forEach((l) => out.push("* " + l));
    out.push("");
  });
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Agrupa líneas de contenido por subsecciones 6.1/6.2 o **X:**; 4 espacios para ítem, 8 para hijos. */
function formatSection6ContentLines(lines: string[]): string {
  const sub = "    - "; // 4 espacios = primer nivel
  const subSub = "        - "; // 8 espacios = bajo subsección
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i]!.trim();
    if (!line) {
      i++;
      continue;
    }
    line = line.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim();
    if (reSection6TitleOnly.test(line)) {
      i++;
      continue;
    }
    const isSubsectionNum = reSection6SubsectionNum.test(line);
    const isBoldHeading = reSection6BoldHeading.test(line);
    if (isSubsectionNum || isBoldHeading) {
      const label = line.endsWith(":") ? line : line + ":";
      out.push(sub + label);
      i++;
      while (i < lines.length) {
        const raw = lines[i]!.trim();
        const next = raw.replace(/^-\s*/, "");
        if (!next) {
          i++;
          continue;
        }
        if (reSection6SubsectionNum.test(next) || reSection6BoldHeading.test(next)) break;
        out.push(subSub + next);
        i++;
      }
    } else {
      out.push(sub + line);
      i++;
    }
  }
  return out.length ? out.join("\n") : sub + "(Pendiente.)";
}

/** Convierte array de items { title, content } a markdown de la sección 6 (Seguridad). Categoría con -; subniveles 4 espacios; bajo 6.1/6.2 etc. 8 espacios. Sin "--" al final. */
export function seguridadItemsToSection6Markdown(
  items: Array<{ title: string; content: string[] }>,
): string {
  if (!items?.length) return "## 6. Seguridad\n\n(Pendiente de definir.)";
  const filtered =
    items.length > 1
      ? items.filter((item) => {
          const t = (item.title ?? "").trim().replace(/^\d+\.\d*\s*/, "");
          return t && t !== "Seguridad" && !/^6\.\s*Seguridad$/i.test(t);
        })
      : items;
  const reLineSeguridad = /^\s*(-\s*)?##\s*6\.\s*Seguridad\s*$/i;
  const parts = filtered.map((item) => {
    let title = (item.title ?? "")
      .replace(/^\d+\.\d*\s*/, "")
      .replace(/^#+\s*/, "")
      .replace(/^\.\s+/, "")
      .trim();
    if (filtered.length === 1 && (!title || title === "Seguridad")) title = "Aspectos generales";
    let lines = Array.isArray(item.content) ? item.content.filter(Boolean) : [String(item.content ?? "").trim()].filter(Boolean);
    lines = lines
      .filter((c) => !reLineSeguridad.test(c.trim()))
      .map((c) => c.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
      .filter((c) => !reSection6TitleOnly.test(c));
    // Un solo ítem "Aspectos generales" → formato canónico: ## Aspectos Generales + intro + ### A./B./C. + * bullets; Conclusión en blockquote
    if (filtered.length === 1 && /^Aspectos\s+generales$/i.test(title)) {
      const body = lines.length ? formatSection6AspectosGenerales(lines) : "(Pendiente de definir.)";
      return `## Aspectos Generales\n\n${body}`;
    }
    const subBullets = lines.length ? formatSection6ContentLines(lines) : "    - (Pendiente.)";
    const label = title.endsWith(":") ? title : title + ":";
    return `- ${label}\n${subBullets}`;
  });
  let body = parts.length ? parts.join("\n\n") : "(Pendiente de definir.)";
  body = body.replace(/\s*--\s*\n*$/, "").replace(/(\n\s*-\s*)+$/, "").trim();
  return "## 6. Seguridad\n\n" + body;
}

/** Convierte objeto integracion (subsections + manifest) a markdown de la sección 7. */
export function integracionToSection7Markdown(integracion: {
  subsections?: Array<{ title: string; content: string | string[] }>;
  manifest?: Record<string, unknown>;
}): string {
  const subs = integracion?.subsections ?? [];
  let body = subs.length
    ? subs
      .map((s) => {
        const c = s.content;
        const text = typeof c === "string" ? c : Array.isArray(c) ? c.join("\n") : "";
        return `### ${s.title}\n\n${text}`;
      })
      .join("\n\n")
    : "(Pendiente de definir.)";
  const manifest =
    integracion?.manifest && typeof integracion.manifest === "object"
      ? integracion.manifest
      : buildNewFormatManifestFromIdentifiedTerms([]);
  body += "\n\n### Manifest de Infraestructura\n\n```json\n" + JSON.stringify(manifest, null, 2) + "\n```";
  return "## 7. Infraestructura\n\n" + body;
}

function extractSqlFromSection3Fallback(markdown: string): string {
  const trimmed = (markdown ?? "").trim();
  const createIdx = trimmed.search(/\bCREATE\s+TABLE\b/i);
  if (createIdx === -1) return "";
  const fromCreate = trimmed.slice(createIdx);
  const nextBlock = fromCreate.search(/\n?\s*```\s*(?:mermaid|sql|TechnicalMetadata|json)/i);
  const chunk = nextBlock >= 0 ? fromCreate.slice(0, nextBlock) : fromCreate;
  return chunk.trim();
}

/** Parsea cuerpo de §3 (markdown con ```sql, ```mermaid, ```TechnicalMetadata) a modeloDatos. Para merge en mddStructured cuando el SA genera §3. Más tolerante: si hay CREATE TABLE pero no ```sql, extrae SQL por heurística. */
export function parseModeloDatosFromSection3Markdown(markdown: string): {
  sql: string;
  diagramaEr?: string;
  technicalMetadata?: string[];
} | null {
  const trimmed = (markdown ?? "").trim();
  if (!trimmed) return null;
  const sqlMatch = trimmed.match(/```sql\s*([\s\S]*?)```/i);
  let sql = sqlMatch?.[1]?.trim() ?? "";
  if (!sql && /CREATE\s+TABLE/i.test(trimmed)) sql = extractSqlFromSection3Fallback(trimmed);
  if (!sql) return null;
  const metaMatch = trimmed.match(/```TechnicalMetadata\s*([\s\S]*?)```/i);
  const metaRaw = metaMatch?.[1]?.trim();
  const technicalMetadata = metaRaw
    ? metaRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => /^\[.*\]$/.test(s))
    : ["[high_security]"];
  // diagramaEr: derivado del SQL (no del bloque mermaid del LLM).
  const diagramaEr = sqlToErDiagramContent(sql) ?? undefined;
  return { sql, diagramaEr, technicalMetadata };
}

export function normalizeTablesToRecord(tables: unknown): Record<string, { columns: Record<string, string> }> | null {
  if (!tables || typeof tables !== "object") return null;
  if (!Array.isArray(tables)) return tables as Record<string, { columns: Record<string, string> }>;

  const record: Record<string, { columns: Record<string, string> }> = {};
  for (const row of tables) {
    const t = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
    const name = typeof t.name === "string" ? t.name : "table";
    const colsRaw = t.columns;
    const cols: Record<string, string> = {};
    if (Array.isArray(colsRaw)) {
      for (const c of colsRaw) {
        const col = c && typeof c === "object" && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
        const colName = typeof col.name === "string" ? col.name : "id";
        const type = typeof col.type === "string" ? col.type : "VARCHAR(255)";
        const parts = [type];
        if (col.primaryKey) parts.push("PRIMARY KEY");
        if (col.unique) parts.push("UNIQUE");
        if (col.notNull !== false) parts.push("NOT NULL");
        cols[colName] = parts.join(" ");
      }
    }
    record[name] = { columns: Object.keys(cols).length ? cols : { id: "UUID PRIMARY KEY DEFAULT gen_random_uuid()" } };
  }
  return Object.keys(record).length ? record : null;
}

/**
 * Convierte cualquier objeto JSON a Markdown estructurado recursivamente.
 * Reemplaza la lógica anterior estricta por una universal.
 */
export function objectSectionToMarkdown(data: unknown, level = 1): string {
  if (data === null || data === undefined) return "";

  // Si es string/number/boolean, devolverlo directo
  if (typeof data !== "object") return String(data).trim();

  // Si es array, convertir a lista de viñetas
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === "object" && item !== null) {
        return `- ${JSON.stringify(item)}`;
      }
      return `- ${String(item)}`;
    }).join("\n");
  }

  const out: string[] = [];
  const entries = Object.entries(data as Record<string, unknown>);

  // Detectar si estamos en la raíz y hay una clave contenedora principal "mddDraft" o "Master Design Document"
  if (level === 1 && entries.length === 1 && (entries[0][0] === "mddDraft" || entries[0][0] === "Master Design Document")) {
    return objectSectionToMarkdown(entries[0][1], level);
  }

  // Detectar wrapper { "Master Design Document": ... } junto con otras claves
  if (level === 1 && entries.some(e => e[0] === "Master Design Document")) {
    const mdd = (data as Record<string, unknown>)["Master Design Document"];
    if (mdd) out.push(objectSectionToMarkdown(mdd, level));
    for (const [key, val] of entries) {
      if (key === "Master Design Document") continue;
      out.push(objectSectionToMarkdown({ [key]: val }, level));
    }
    return out.join("\n\n").trim();
  }

  // Título principal si level=1 y no hay wrapper obvio
  if (level === 1) {
    out.push("# Master Design Document", "");
  }

  for (const [key, val] of entries) {
    if (val === undefined || val === null) continue;

    const headingPrefix = "#".repeat(Math.min(level + 1, 6)); // Start at H2 for keys at level 1

    // Heurísticas de formato para bloques de código
    if (typeof val === "string") {
      const trimmed = val.trim();
      // Si ya tiene bloques de código, imprimir tal cual
      if (trimmed.startsWith("```")) {
        out.push(`${headingPrefix} ${key}`, "", trimmed, "");
        continue;
      }
      // Si parece SQL
      if (key.toLowerCase().includes("sql") || trimmed.includes("CREATE TABLE") || trimmed.includes("SELECT ")) {
        out.push(`${headingPrefix} ${key}`, "", "```sql", trimmed, "```", "");
        continue;
      }
      // Texto normal
      out.push(`${headingPrefix} ${key}`, "", trimmed, "");
      continue;
    }

    if (key === "request" || key === "response" || key === "body" || key === "payload") {
      if (typeof val === "object") {
        out.push(`${headingPrefix} ${key}`, "", "```json", JSON.stringify(val, null, 2), "```", "");
        continue;
      }
    }

    // Si es array
    if (Array.isArray(val)) {
      out.push(`${headingPrefix} ${key}`, "");
      // Si es lista de endpoints (objetos), intentar formatear mejor
      if (val.length > 0 && typeof val[0] === "object" && ((val[0] as any).method || (val[0] as any).path || (val[0] as any).endpoint)) {
        for (const item of val) {
          const method = (item as any).method || (item as any).type || "ITEM";
          const path = (item as any).path || (item as any).endpoint || "";
          const label = path ? `${method} ${path}` : method;
          out.push(objectSectionToMarkdown({ [label]: item }, level + 1));
        }
      } else {
        const list = val.map(item => {
          if (typeof item === "object") return `- ${JSON.stringify(item)}`;
          return `- ${String(item)}`;
        }).join("\n");
        out.push(list, "");
      }
      continue;
    }

    // Si es objeto regular
    out.push(`${headingPrefix} ${key}`, "");
    out.push(objectSectionToMarkdown(val, level + 1), "");
  }

  return out.join("\n").trim();
}

