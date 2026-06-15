/**
 * Inyecta evidencia estructurada del `codebaseDoc` (Ariadne) en §2–§5 del MDD AS-IS (etapa 1).
 * Evita alucinaciones LLM de stack (Laravel/Vue) y resúmenes «N adicionales» en entidades/API/servicios.
 */

import {
  parseLegacyCodebaseDocEvidence,
  type LegacyRepoEvidence,
} from "./legacy-component-diagram.util.js";

const REPO_HEADER_RE = /^##\s+Repositorio:\s*(.+?)(?:\s*\(|$)/gim;

const ENTITY_SUMMARY_PATTERNS = [
  /Otras entidades significativas[^\n]*/gi,
  /\(\d+\+\s*adicionales?\)/gi,
  /y\s+\d+\+\s*entidades?\s+m[aá]s[^\n]*/gi,
  /(?:^|\n)(?:[-*]\s*)?(?:Entidades?\s+)?(?:adicionales?|restantes?)\s*:\s*[^\n]+\n(?:[-*]\s*[^\n]+\n)*/gi,
];

const SERVICE_SUMMARY_PATTERNS = [
  /\(Además,\s*servicios[^\n]*\)/gi,
  /Además,\s*servicios para cada[^\n]*/gi,
  /servicios para cada Content Type restante[^\n]*/gi,
  /(?:^|\n)\(Además,[^\)]+\)/gi,
  /(?:^|\n)(?:[-*]\s*)?Servicios?\s+(?:adicionales?|restantes?)[^\n]*/gi,
];

function extractSubsectionBody(chunk: string, heading: string): string {
  const re = new RegExp(`###\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|\\n##\\s+|$)`, "i");
  const m = chunk.match(re);
  if (!m?.[1]) return "";
  return m[1].trim();
}

function splitCodebaseDocByRepo(codebaseDoc: string): Array<{ label: string; body: string }> {
  const doc = codebaseDoc.trim();
  if (!doc) return [];

  const headers: Array<{ label: string; start: number }> = [];
  let m: RegExpExecArray | null;
  REPO_HEADER_RE.lastIndex = 0;
  while ((m = REPO_HEADER_RE.exec(doc)) !== null) {
    headers.push({ label: m[1].trim(), start: m.index });
  }

  if (headers.length === 0) {
    return [{ label: "", body: doc }];
  }

  const chunks: Array<{ label: string; body: string }> = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!;
    const end = headers[i + 1]?.start ?? doc.length;
    chunks.push({ label: h.label, body: doc.slice(h.start, end).trim() });
  }
  return chunks;
}

function escapeMdCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function parseInfraFromChunk(chunk: string): { orm?: string; envVars: string[] } {
  const body = extractSubsectionBody(chunk, "Infraestructura");
  if (!body) return { envVars: [] };
  const jsonMatch = body.match(/```json\s*([\s\S]*?)```/i);
  if (!jsonMatch?.[1]) return { envVars: [] };
  try {
    const o = JSON.parse(jsonMatch[1].trim()) as { orm?: string; env_vars?: string[] };
    return {
      orm: typeof o.orm === "string" && o.orm.trim() ? o.orm.trim() : undefined,
      envVars: Array.isArray(o.env_vars)
        ? o.env_vars.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : [],
    };
  } catch {
    return { envVars: [] };
  }
}

function repoShortLabel(label: string): string {
  const parts = label.split("/").filter(Boolean);
  return (parts[parts.length - 1] ?? label) || "codebase";
}

function componentNameForRepo(repo: LegacyRepoEvidence): string {
  const short = repoShortLabel(repo.label);
  if (repo.kind === "frontend") return `Frontend ${short}`;
  if (repo.kind === "strapi") return `Backend ${short} (Strapi)`;
  if (repo.kind === "nest") return `API ${short} (NestJS)`;
  return `Repositorio ${short}`;
}

function inferFrontendStackHints(chunkBody: string): string[] {
  const hints: string[] = [];
  const blob = chunkBody.toLowerCase();
  if (/react|src\/models|src\/api|frontend:/i.test(chunkBody)) hints.push("React SPA");
  if (/vite\.config|@vite\//.test(blob)) hints.push("Vite");
  if (/react-router/.test(blob)) hints.push("React Router");
  if (/tanstack\/react-query|react-query/.test(blob)) hints.push("TanStack Query");
  return hints.length ? hints : ["SPA cliente (frontend indexado)"];
}

function describeRepoTechnology(repo: LegacyRepoEvidence, chunkBody: string): string {
  const infra = parseInfraFromChunk(chunkBody);
  const orm = repo.orm ?? infra.orm;
  const parts: string[] = [];

  if (repo.kind === "strapi") {
    parts.push("Strapi CMS");
    if (repo.entityCount > 0) parts.push(`${repo.entityCount} content-type(s)`);
    if (repo.apiRouteCount > 0) parts.push(`${repo.apiRouteCount} rutas REST`);
    if (orm && orm !== "none") parts.push(`persistencia: ${orm}`);
  } else if (repo.kind === "frontend") {
    parts.push(inferFrontendStackHints(chunkBody).join(" · "));
    if (repo.apiRouteCount > 0) parts.push(`${repo.apiRouteCount} clientes API`);
  } else if (repo.kind === "nest") {
    parts.push("NestJS");
    if (repo.apiRouteCount > 0) parts.push(`${repo.apiRouteCount} endpoints`);
    if (orm && orm !== "none") parts.push(`ORM: ${orm}`);
  } else if (repo.entityCount > 0 || repo.apiRouteCount > 0) {
    parts.push(`${repo.entityCount} entidades · ${repo.apiRouteCount} rutas API`);
  } else {
    parts.push("Rol/stack no inferido en índice");
  }
  return parts.join(" · ");
}

function inferSharedInfraTableRow(chunks: Array<{ body: string }>): string | null {
  const envVars = new Set<string>();
  const orms = new Set<string>();
  for (const chunk of chunks) {
    const infra = parseInfraFromChunk(chunk.body);
    if (infra.orm && infra.orm !== "none") orms.add(infra.orm);
    for (const v of infra.envVars) envVars.add(v);
  }
  if (envVars.size === 0 && orms.size === 0) return null;

  const techParts: string[] = [];
  if (orms.size > 0) techParts.push([...orms].join(", "));

  const services: string[] = [];
  for (const v of envVars) {
    const u = v.toUpperCase();
    if (u.includes("REDIS")) services.push("Redis");
    if (u.includes("MYSQL") || u === "DATABASE_URL" || u.includes("POSTGRES")) {
      services.push(u.includes("POSTGRES") ? "PostgreSQL" : "MySQL/PostgreSQL");
    }
    if (u.includes("HORIZON") || u.includes("QUEUE")) services.push("Colas (env indexada)");
  }
  const uniqueServices = [...new Set(services)];
  if (uniqueServices.length > 0) techParts.push(uniqueServices.join(", "));

  const envSample = [...envVars].slice(0, 6);
  if (envSample.length > 0) {
    techParts.push(
      `env: ${envSample.join(", ")}${envVars.size > envSample.length ? "…" : ""}`,
    );
  }

  return `| Infraestructura compartida | ${escapeMdCell(techParts.join(" · "))} | _\`### Infraestructura\` doc. partida_ |`;
}

function detectPatternsFromEvidence(doc: string): string[] {
  const patterns: string[] = [];
  const lower = doc.toLowerCase();
  if (lower.includes("app/repositories/") || lower.includes("/repositories/")) {
    patterns.push("Repository pattern (`app/Repositories/` o equivalente indexado)");
  }
  if (lower.includes("app/services/") || lower.includes("src/api/") || /strapi:[a-z0-9_-]+/i.test(doc)) {
    patterns.push("Service layer (Strapi services, `app/Services/` o `src/api` frontend)");
  }
  if (lower.includes("swagger") || lower.includes("openapi")) {
    patterns.push("API REST documentada (OpenAPI/Swagger en índice)");
  }
  if (/\|\s*[^\|]+\s*\|\s*strapi\s*\|/i.test(doc)) {
    patterns.push("API REST Strapi (content-types + routes indexados)");
  }
  return patterns;
}

function extractComponentDiagramSubsection(section2Body: string): string {
  const m = section2Body.match(
    /###\s+Diagrama de Componentes[\s\S]*?(?=\n###\s+(?!Diagrama)|\n##\s+|$)/i,
  );
  return m?.[0]?.trim() ?? "";
}

/** Markdown de stack §2 anclado al índice (sin Laravel/Vue inventados). */
export function buildAsIsSection2BodyFromCodebaseDoc(codebaseDoc: string): string | null {
  const doc = codebaseDoc.trim();
  if (!doc) return null;

  const evidence = parseLegacyCodebaseDocEvidence(doc);
  const chunks = splitCodebaseDocByRepo(doc);
  const repos = evidence.repos.filter(
    (r) =>
      r.kind !== "unknown" ||
      r.entityCount > 0 ||
      r.apiRouteCount > 0 ||
      r.serviceLabels.length > 0,
  );
  if (repos.length === 0) return null;

  const chunkByLabel = new Map(chunks.map((c) => [c.label, c.body]));
  const tableLines = [
    "| Componente | Tecnología | Repositorio / Ruta |",
    "| --- | --- | --- |",
  ];

  for (const repo of repos) {
    const chunkBody =
      chunkByLabel.get(repo.label) ?? (repo.label === "codebase" ? doc : chunks[0]?.body ?? "");
    const repoPath = repo.label.replace(/`/g, "\\`") || "codebase";
    tableLines.push(
      `| ${escapeMdCell(componentNameForRepo(repo))} | ${escapeMdCell(describeRepoTechnology(repo, chunkBody))} | \`${repoPath}\` |`,
    );
  }

  const sharedInfra = inferSharedInfraTableRow(chunks);
  if (sharedInfra) tableLines.push(sharedInfra);

  const parts: string[] = [
    "_Stack derivado del índice Ariadne (`codebaseDoc`). **Prohibido** inventar PHP/Laravel/Vue/Inertia u otras tecnologías que no consten en Resumen, Infraestructura o rutas indexadas._",
    "",
    tableLines.join("\n"),
  ];

  const resumenBlocks = buildRepoScopedBlock(chunks, "Resumen", "");
  if (resumenBlocks.trim()) {
    parts.push("", "### Resumen por repositorio", "", resumenBlocks);
  }

  const patterns = detectPatternsFromEvidence(doc);
  if (patterns.length > 0) {
    parts.push("", "### Patrones (evidencia indexada)", "", patterns.map((p) => `- ${p}`).join("\n"));
  }

  return parts.join("\n");
}

function buildRepoScopedBlock(
  chunks: Array<{ label: string; body: string }>,
  subsectionHeading: string,
  emptyFallback: string,
): string {
  const parts: string[] = [];
  for (const chunk of chunks) {
    const table = extractSubsectionBody(chunk.body, subsectionHeading);
    if (!table) continue;
    if (chunk.label) {
      parts.push(`### ${chunk.label}`, "", table);
    } else {
      parts.push(`### ${subsectionHeading}`, "", table);
    }
  }
  if (parts.length === 0) return emptyFallback;
  return parts.join("\n\n");
}

/** Markdown de inventario de entidades listo para §3 (desde codebaseDoc). */
export function buildAsIsSection3BodyFromCodebaseDoc(codebaseDoc: string): string | null {
  const chunks = splitCodebaseDocByRepo(codebaseDoc);
  const block = buildRepoScopedBlock(
    chunks,
    "Entidades y modelo de datos",
    "",
  );
  if (!block.trim()) {
    const single = extractSubsectionBody(codebaseDoc, "Entidades y modelo de datos");
    if (!single.trim()) return null;
    return `### Entidades y modelo de datos\n\n${single}`;
  }
  return (
    "_Inventario indexado (Ariadne). **Prohibido** resumir entidades en listas separadas por comas o bloques «N adicionales»; " +
    "cada entidad debe aparecer en la tabla con origen y atributos de muestra._\n\n" +
    block
  );
}

/** Markdown de contratos API listo para §4 (desde codebaseDoc). */
export function buildAsIsSection4BodyFromCodebaseDoc(codebaseDoc: string): string | null {
  const chunks = splitCodebaseDocByRepo(codebaseDoc);
  const block = buildRepoScopedBlock(chunks, "Contratos API", "");
  if (!block.trim()) {
    const single = extractSubsectionBody(codebaseDoc, "Contratos API");
    if (!single.trim()) return null;
    return `### Contratos API\n\n${single}`;
  }
  return (
    "_Contratos REST/indexados por repo. No omitir rutas por resumen; usar tablas completas de la doc. de partida._\n\n" +
    block
  );
}

/** Markdown de servicios / lógica de negocio listo para §5 (desde codebaseDoc). */
export function buildAsIsSection5BodyFromCodebaseDoc(codebaseDoc: string): string | null {
  const chunks = splitCodebaseDocByRepo(codebaseDoc);
  const block = buildRepoScopedBlock(chunks, "Lógica de negocio", "");
  if (!block.trim()) {
    const single = extractSubsectionBody(codebaseDoc, "Lógica de negocio");
    if (!single.trim()) return null;
    return `### Lógica de negocio\n\n${single}`;
  }
  return (
    "_Servicios indexados (Strapi/Nest/frontend). Una fila por servicio con paths de dependencia; " +
    "no omitir content-types en listas comprimidas por comas._\n\n" +
    block +
    "\n\n### Reglas y edge cases\n\n" +
    "_Documentar aquí reglas de negocio verificables no inferidas del índice; lo no evidenciado va en «Brechas de información»._"
  );
}

function findMddSectionBounds(mdd: string, sectionNum: number): { start: number; bodyStart: number; end: number } | null {
  const headerRe = new RegExp(`^##\\s*${sectionNum}\\.\\s*[^\\n]*`, "gim");
  const headerMatch = headerRe.exec(mdd);
  if (!headerMatch) return null;

  const start = headerMatch.index;
  const bodyStart = start + headerMatch[0].length;
  const nextRe = new RegExp(`^##\\s*${sectionNum + 1}\\.\\s*`, "gim");
  nextRe.lastIndex = bodyStart;
  const nextMatch = nextRe.exec(mdd);
  const end = nextMatch ? nextMatch.index : mdd.length;
  return { start, bodyStart, end };
}

function replaceMddSectionBody(mdd: string, sectionNum: number, newBody: string): string {
  const bounds = findMddSectionBounds(mdd, sectionNum);
  if (!bounds) return mdd;
  const before = mdd.slice(0, bounds.bodyStart);
  const after = mdd.slice(bounds.end);
  const body = newBody.trim() ? `\n\n${newBody.trim()}\n\n` : "\n\n";
  return before + body + after;
}

/** Elimina patrones típicos de resumen de entidades que el LLM añade pese a tener tablas. */
export function stripEntitySummaryPlaceholders(section3: string): string {
  let out = section3;
  for (const re of ENTITY_SUMMARY_PATTERNS) {
    out = out.replace(re, "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Elimina resúmenes LLM de servicios (listas «Además, servicios para…»). */
export function stripServiceSummaryPlaceholders(section5: string): string {
  let out = section5;
  for (const re of SERVICE_SUMMARY_PATTERNS) {
    out = out.replace(re, "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Sustituye §2–§5 del MDD AS-IS con evidencia del `codebaseDoc` cuando existe.
 * Idempotente: re-ejecutar mantiene el mismo inventario (no duplica bloques).
 * Preserva `### Diagrama de Componentes` ya inyectado en §2.
 */
export function injectAsIsCodebaseEvidenceIntoMdd(mddContent: string, codebaseDoc: string): string {
  const mdd = mddContent.trim();
  const doc = codebaseDoc.trim();
  if (!mdd || !doc) return mddContent;

  let out = mdd;

  const section2 = buildAsIsSection2BodyFromCodebaseDoc(doc);
  if (section2) {
    const bounds2 = findMddSectionBounds(out, 2);
    const diagram =
      bounds2 != null
        ? extractComponentDiagramSubsection(out.slice(bounds2.bodyStart, bounds2.end))
        : "";
    out = replaceMddSectionBody(out, 2, diagram ? `${section2}\n\n${diagram}` : section2);
  }

  const section3 = buildAsIsSection3BodyFromCodebaseDoc(doc);
  if (section3) {
    out = replaceMddSectionBody(out, 3, section3);
  } else {
    const bounds = findMddSectionBounds(out, 3);
    if (bounds) {
      const currentBody = out.slice(bounds.bodyStart, bounds.end);
      const cleaned = stripEntitySummaryPlaceholders(currentBody);
      if (cleaned !== currentBody.trim()) {
        out = out.slice(0, bounds.bodyStart) + `\n\n${cleaned}\n\n` + out.slice(bounds.end);
      }
    }
  }

  const section4 = buildAsIsSection4BodyFromCodebaseDoc(doc);
  if (section4) {
    out = replaceMddSectionBody(out, 4, section4);
  }

  const section5 = buildAsIsSection5BodyFromCodebaseDoc(doc);
  if (section5) {
    out = replaceMddSectionBody(out, 5, section5);
  } else {
    const bounds = findMddSectionBounds(out, 5);
    if (bounds) {
      const currentBody = out.slice(bounds.bodyStart, bounds.end);
      const cleaned = stripServiceSummaryPlaceholders(currentBody);
      if (cleaned !== currentBody.trim()) {
        out = out.slice(0, bounds.bodyStart) + `\n\n${cleaned}\n\n` + out.slice(bounds.end);
      }
    }
  }

  return out;
}

export function isLegacyAsIsMddEvidenceInjectEnabled(): boolean {
  const v = process.env.LEGACY_AS_IS_MDD_EVIDENCE_INJECT?.trim().toLowerCase();
  if (v === undefined || v === "") return true;
  return !["0", "false", "off", "no"].includes(v);
}
