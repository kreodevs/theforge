/**
 * Inyecta evidencia estructurada del `codebaseDoc` (Ariadne) en §2–§7 del MDD AS-IS (etapa 1).
 * Evita alucinaciones LLM de stack (Laravel/Vue), resúmenes «N adicionales» y metadata interna de Ariadne.
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

const ARIADNE_RESUMEN_METADATA_RE =
  /Consulta:\s*Documentación de partida|evidence_first|scope\.repoIds|orchestrator\/ingest/i;

/** Servicios/rutas críticos cuyo path indexado se expone como edge case verificable (§5). */
const CRITICAL_EDGE_CASE_RULES: Array<{
  id: string;
  title: string;
  summary: string;
  servicePattern: RegExp;
  routePattern?: RegExp;
}> = [
  {
    id: "dispo-imj",
    title: "Disponibilidad de medios (`obtener-dispo-imj`)",
    summary:
      "Cálculo de disponibilidad IMJ y desbloqueo de medios; reglas de solapamiento/desactivación en servicios indexados, no en texto de negocio.",
    servicePattern: /obtener-dispo-imj|get-medios-with-dispo-imj|enrich-detailpautas-fijos-bitacora-dispo|mediosADesbloquear/i,
    routePattern: /\/obtener-dispo-imj|\/detailpauta\/mediosADesbloquear/i,
  },
  {
    id: "campania-compuesta",
    title: "Alta/edición/renovación campaña con detalles (`*CampaniaWDetalles`)",
    summary:
      "Endpoints custom que persisten campaña y detalle por tipo de medio en una operación compuesta.",
    servicePattern: /createCampaniaWDetalles|updateCampaniaWDetalles|renovarCampaniaWDetalles|createOrUpdateCampDetail/i,
    routePattern: /\/createCampaniaWDetalles|\/updateCampaniaWDetalles|\/renovarCampaniaWDetalles/i,
  },
  {
    id: "pauta-bolsa",
    title: "Cálculo de bolsa de pauta (`calculaBolsa`)",
    summary: "Reglas de bolsa/cotización en pauta; requiere lectura del servicio indexado.",
    servicePattern: /calculaBolsa|calcula-bolsa/i,
    routePattern: /\/pautas\/calculaBolsa|\/calculaBolsa/i,
  },
  {
    id: "lista-precios",
    title: "Listas de precios (`create-or-update-lista-precios`)",
    summary: "Alta/edición masiva de listas de precio por medio; historial en entidad `historial-lista-precio`.",
    servicePattern: /create-or-update-lista-precios|lista-precios-by-ids|crear-o-editar/i,
    routePattern: /\/lista-precios\/crear-o-editar|\/lista-precios\//i,
  },
  {
    id: "search-trade",
    title: "Búsquedas trade table (medios/indoors/rutas)",
    summary: "Endpoints POST de búsqueda avanzada para catálogos comerciales; filtros en servicios `search-*`.",
    servicePattern: /search-medios|search-indoors|search-rutas|filtros-medios/i,
    routePattern: /\/search-medios|\/search-indoors|\/search-rutas|\/medios\/filtros/i,
  },
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

function extractEvidencePaths(chunk: string): string[] {
  const body = extractSubsectionBody(chunk, "Rutas de evidencia");
  if (!body) return [];
  const paths: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^-\s*`([^`]+)`/);
    if (m?.[1]) paths.push(m[1].trim());
  }
  return paths;
}

function pathsMatchAny(paths: string[], pattern: RegExp): string[] {
  return paths.filter((p) => pattern.test(p));
}

function sanitizeResumenForSection2(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (ARIADNE_RESUMEN_METADATA_RE.test(trimmed)) {
    return extractStructuredResumenFromAriadneMetadata(trimmed);
  }
  return trimmed;
}

function extractStructuredResumenFromAriadneMetadata(text: string): string | null {
  const bullets: string[] = [];

  const evidenceMatch = text.match(/Evidencia anclada a (\d+) ruta\(s\) verificada\(s\)/i);
  if (evidenceMatch?.[1]) bullets.push(`${evidenceMatch[1]} rutas de evidencia indexadas`);

  const openApiMatch = text.match(/Contrato OpenAPI priorizado:\s*`([^`]+)`/i);
  if (openApiMatch?.[1]) {
    bullets.push(`OpenAPI priorizado: \`${openApiMatch[1]}\``);
  } else if (/Sin spec OpenAPI indexado/i.test(text)) {
    bullets.push("Sin spec OpenAPI indexado en el repo");
  }

  const entitiesMatch = text.match(/(\d+) entidad\(es\)/i);
  if (entitiesMatch?.[1]) bullets.push(`${entitiesMatch[1]} entidades indexadas`);

  const contractsMatch = text.match(/(\d+) contrato\(s\) API/i);
  if (contractsMatch?.[1]) bullets.push(`${contractsMatch[1]} contratos API indexados`);

  if (bullets.length === 0) return null;
  return bullets.map((b) => `- ${b}`).join("\n");
}

function buildRepoScopedResumenBlock(chunks: Array<{ label: string; body: string }>): string {
  const parts: string[] = [];
  for (const chunk of chunks) {
    const raw = extractSubsectionBody(chunk.body, "Resumen");
    const sanitized = raw ? sanitizeResumenForSection2(raw) : null;
    if (!sanitized) continue;
    parts.push(`### ${chunk.label || "Repositorio"}`, "", sanitized);
  }
  return parts.join("\n\n");
}

function extractServicePathsFromChunk(chunkBody: string): string[] {
  const body = extractSubsectionBody(chunkBody, "Lógica de negocio");
  const paths: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\|\s*[^|]+\|\s*([^|]+)\|/);
    if (!m?.[1]) continue;
    const cell = m[1].trim();
    if (!cell || cell.startsWith("---") || /dependencias/i.test(cell)) continue;
    for (const part of cell.split(/[,;]/)) {
      const p = part.trim().replace(/^`|`$/g, "");
      if (p.includes("/")) paths.push(p);
    }
  }
  return paths;
}

function extractApiRoutesFromChunk(chunkBody: string): string[] {
  const body = extractSubsectionBody(chunkBody, "Contratos API");
  const routes: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|/);
    if (!m?.[1]) continue;
    const route = m[1].trim();
    if (!route.startsWith("/") || route.startsWith("---") || /^\|?\s*ruta/i.test(route)) continue;
    routes.push(route);
  }
  return routes;
}

function buildAsIsSection5EdgeCasesBlock(codebaseDoc: string): string {
  const chunks = splitCodebaseDocByRepo(codebaseDoc);
  const docBlob = codebaseDoc;
  const allServicePaths = chunks.flatMap((c) => extractServicePathsFromChunk(c.body));
  const allRoutes = chunks.flatMap((c) => extractApiRoutesFromChunk(c.body));
  const allEvidencePaths = chunks.flatMap((c) => extractEvidencePaths(c.body));

  const hits: Array<{ title: string; summary: string; paths: string[] }> = [];

  for (const rule of CRITICAL_EDGE_CASE_RULES) {
    const serviceHits = allServicePaths.filter((p) => rule.servicePattern.test(p));
    const routeHits = rule.routePattern
      ? allRoutes.filter((r) => rule.routePattern!.test(r))
      : [];
    const docHit = rule.servicePattern.test(docBlob) || (rule.routePattern?.test(docBlob) ?? false);
    if (serviceHits.length === 0 && routeHits.length === 0 && !docHit) continue;

    const paths = [...new Set([...serviceHits, ...routeHits])].slice(0, 4);
    hits.push({ title: rule.title, summary: rule.summary, paths });
  }

  if (hits.length === 0) {
    return (
      "_Documentar aquí reglas de negocio verificables no inferidas del índice; " +
      "lo no evidenciado va en «Brechas de información»._"
    );
  }

  const lines = hits.map((h) => {
    const pathLine =
      h.paths.length > 0
        ? `\n  - Evidencia: ${h.paths.map((p) => `\`${p}\``).join(", ")}`
        : "";
    return `- **${h.title}** — ${h.summary}${pathLine}`;
  });

  const note =
    allEvidencePaths.length > 0
      ? `\n\n_Edge cases anclados a servicios/rutas del índice (${allEvidencePaths.length} paths de evidencia en doc. partida)._`
      : "";

  return `${lines.join("\n")}${note}`;
}

interface RepoInfraRow {
  repoLabel: string;
  role: string;
  facts: string[];
  gaps: string[];
}

function inferRepoInfraRow(
  chunk: { label: string; body: string },
  repo: LegacyRepoEvidence | undefined,
): RepoInfraRow {
  const paths = extractEvidencePaths(chunk.body);
  const infra = parseInfraFromChunk(chunk.body);
  const kind = repo?.kind ?? "unknown";
  const short = repoShortLabel(chunk.label);
  const facts: string[] = [];
  const gaps: string[] = [];

  if (kind === "strapi") {
    facts.push("Runtime: Node.js (Strapi v4, inferido del índice)");
    if (infra.orm && infra.orm !== "none") facts.push(`ORM: ${infra.orm} (Knex + Bookshelf en Strapi v4)`);
    const dbPaths = pathsMatchAny(paths, /database\.js$/i);
    if (dbPaths.length > 0) {
      facts.push(`Base de datos: PostgreSQL (config indexada: \`${dbPaths[0]}\`)`);
    } else {
      gaps.push("No hay `database.js` en rutas de evidencia; motor de BD no verificado en índice");
    }
    const adminWebpack = pathsMatchAny(paths, /admin\/webpack\.config/i);
    if (adminWebpack.length > 0) {
      facts.push(`Panel admin Strapi: Webpack (\`${adminWebpack[0]}\`) — no confundir con build del frontend cliente`);
    }
  } else if (kind === "frontend") {
    facts.push(inferFrontendStackHints(chunk.body).join(" · "));
    const vitePaths = pathsMatchAny(paths, /vite\.config|vite-env\.d\.ts|node_modules\/vite\//i);
    const webpackPaths = pathsMatchAny(
      paths,
      /webpack\.config(?!\.example)/i,
    ).filter((p) => !/\/admin\//i.test(p));
    if (vitePaths.length > 0) {
      facts.push(`Build frontend: Vite (evidencia: \`${vitePaths[0]}\`)`);
    } else if (webpackPaths.length > 0) {
      facts.push(`Build frontend: Webpack (\`${webpackPaths[0]}\`)`);
    } else {
      gaps.push("Bundler del frontend no identificado en rutas de evidencia");
    }
    if (pathsMatchAny(paths, /tsconfig\.json$/i).length > 0) facts.push("TypeScript: `tsconfig.json` indexado");
    if (pathsMatchAny(paths, /sentry\.config/i).length > 0) {
      facts.push("Observabilidad cliente: Sentry (`sentry.config` indexado)");
    }
  } else if (kind === "nest") {
    facts.push("Runtime: Node.js (NestJS)");
    if (infra.orm && infra.orm !== "none") facts.push(`ORM: ${infra.orm}`);
  }

  const envVars = infra.envVars;
  if (envVars.length > 0) {
    const sample = envVars.slice(0, 6);
    facts.push(
      `Variables de entorno (muestra): ${sample.join(", ")}${envVars.length > sample.length ? "…" : ""}`,
    );
  } else if (pathsMatchAny(paths, /\.env\.example$/i).length === 0) {
    gaps.push("Sin `env_vars` en JSON de infra ni `.env.example` en evidencia");
  }

  const dockerPaths = pathsMatchAny(paths, /docker-compose|Dockerfile/i);
  if (dockerPaths.length > 0) {
    facts.push(`Contenedores: ${dockerPaths.map((p) => `\`${p}\``).join(", ")}`);
  } else {
    gaps.push("Sin Dockerfile/docker-compose en rutas de evidencia");
  }

  const pkgPaths = pathsMatchAny(paths, /package\.json$/i);
  if (pkgPaths.length > 0) facts.push(`Manifiesto: \`${pkgPaths[0]}\` indexado`);

  const role =
    kind === "strapi"
      ? `Backend ${short} (Strapi)`
      : kind === "frontend"
        ? `Frontend ${short}`
        : kind === "nest"
          ? `API ${short} (NestJS)`
          : short;

  return { repoLabel: chunk.label, role, facts, gaps };
}

/** Markdown de infraestructura §7 anclado a `Infraestructura` JSON + rutas de evidencia. */
export function buildAsIsSection7BodyFromCodebaseDoc(codebaseDoc: string): string | null {
  const doc = codebaseDoc.trim();
  if (!doc) return null;

  const evidence = parseLegacyCodebaseDocEvidence(doc);
  const chunks = splitCodebaseDocByRepo(doc);
  if (chunks.length === 0) return null;

  const repoByLabel = new Map(evidence.repos.map((r) => [r.label, r]));
  const rows = chunks.map((c) => inferRepoInfraRow(c, repoByLabel.get(c.label)));

  const tableLines = [
    "| Repositorio | Rol | Detalle (evidencia indexada) |",
    "| --- | --- | --- |",
  ];
  for (const row of rows) {
    const detail = row.facts.length > 0 ? row.facts.join("; ") : "Sin hechos verificables en índice";
    tableLines.push(
      `| \`${escapeMdCell(row.repoLabel || "codebase")}\` | ${escapeMdCell(row.role)} | ${escapeMdCell(detail)} |`,
    );
  }

  const allGaps = [...new Set(rows.flatMap((r) => r.gaps))];
  const gapBlock =
    allGaps.length > 0
      ? allGaps.map((g) => `- ${g}`).join("\n")
      : "- Sin brechas adicionales detectadas en el índice actual.";

  return (
    "_Infraestructura derivada del índice Ariadne (`### Infraestructura`, `### Rutas de evidencia`). " +
    "**Prohibido** atribuir Webpack del panel admin Strapi al frontend cliente ni afirmar ausencia de `database.js` si consta en evidencia._\n\n" +
    "### Configuración actual\n\n" +
    tableLines.join("\n") +
    "\n\n### Brechas de infraestructura\n\n" +
    gapBlock
  );
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

function inferSharedInfraTableRow(
  chunks: Array<{ label: string; body: string }>,
  repos: LegacyRepoEvidence[],
): string | null {
  const repoKindByLabel = new Map(repos.map((r) => [r.label, r.kind]));
  const envVars = new Set<string>();
  const orms = new Set<string>();
  for (const chunk of chunks) {
    const kind = repoKindByLabel.get(chunk.label);
    if (kind === "frontend") continue;
    const infra = parseInfraFromChunk(chunk.body);
    if (infra.orm && infra.orm !== "none") orms.add(infra.orm);
    for (const v of infra.envVars) envVars.add(v);
  }
  for (const chunk of chunks) {
    for (const p of extractEvidencePaths(chunk.body)) {
      const u = p.toUpperCase();
      if (/DATABASE\.JS$/i.test(p)) orms.add("postgresql (config/database.js)");
      if (/POSTGRES/i.test(u)) orms.add("postgresql");
    }
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

  return `| Infraestructura compartida | ${escapeMdCell(techParts.join(" · "))} | _evidencia \`Infraestructura\` + paths_ |`;
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

  const sharedInfra = inferSharedInfraTableRow(chunks, repos);
  if (sharedInfra) tableLines.push(sharedInfra);

  const parts: string[] = [
    "_Stack derivado del índice Ariadne (`codebaseDoc`). **Prohibido** inventar PHP/Laravel/Vue/Inertia u otras tecnologías que no consten en Resumen, Infraestructura o rutas indexadas._",
    "",
    tableLines.join("\n"),
  ];

  const resumenBlocks = buildRepoScopedResumenBlock(chunks);
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
    buildAsIsSection5EdgeCasesBlock(codebaseDoc)
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
 * Sustituye §2–§7 del MDD AS-IS con evidencia del `codebaseDoc` cuando existe.
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

  const section7 = buildAsIsSection7BodyFromCodebaseDoc(doc);
  if (section7) {
    out = replaceMddSectionBody(out, 7, section7);
  }

  return out;
}

export function isLegacyAsIsMddEvidenceInjectEnabled(): boolean {
  const v = process.env.LEGACY_AS_IS_MDD_EVIDENCE_INJECT?.trim().toLowerCase();
  if (v === undefined || v === "") return true;
  return !["0", "false", "off", "no"].includes(v);
}
