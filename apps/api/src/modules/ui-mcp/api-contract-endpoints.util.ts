/**
 * Extrae endpoints HTTP documentados en api-contracts.md (tablas, backticks, headings).
 */

export interface HttpEndpointRef {
  method: string;
  path: string;
}

const METHOD = "GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD";

/** Normaliza path (sin query, trailing slash opcional). */
export function normalizeApiPath(path: string): string {
  const trimmed = path.trim().replace(/\s+/g, "");
  const noQuery = trimmed.split("?")[0] ?? trimmed;
  if (noQuery.length > 1 && noQuery.endsWith("/")) return noQuery.slice(0, -1);
  return noQuery;
}

/** Lista endpoints únicos encontrados en markdown de contratos. */
export function extractHttpEndpointsFromMarkdown(markdown: string): HttpEndpointRef[] {
  const text = (markdown ?? "").trim();
  if (!text) return [];

  const seen = new Set<string>();
  const out: HttpEndpointRef[] = [];

  const push = (method: string, path: string) => {
    const m = method.toUpperCase();
    const p = normalizeApiPath(path);
    if (!p.startsWith("/")) return;
    const key = `${m} ${p}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ method: m, path: p });
  };

  const tableRow = new RegExp(
    `\\|\\s*(${METHOD})\\s*\\|\\s*(\`[^\`]+\`|/[^\\|\\s]+)\\s*\\|`,
    "gi",
  );
  for (const match of text.matchAll(tableRow)) {
    const pathRaw = (match[2] ?? "").replace(/`/g, "").trim();
    push(match[1] ?? "GET", pathRaw);
  }

  const inline = new RegExp(`\\b(${METHOD})\\s+(\`/[^\`]+\`|/[^\\s\`\\|,]+)`, "gi");
  for (const match of text.matchAll(inline)) {
    const pathRaw = (match[2] ?? "").replace(/`/g, "").trim();
    push(match[1] ?? "GET", pathRaw);
  }

  return out;
}

/** Endpoints cuyo path menciona el token de entidad/pantalla. */
export function matchEndpointsForEntity(
  entityOrSlug: string,
  endpoints: HttpEndpointRef[],
): HttpEndpointRef[] {
  const tokens = [
    entityOrSlug.toLowerCase(),
    entityOrSlug.toLowerCase().replace(/_/g, "-"),
    entityOrSlug.toLowerCase().replace(/-/g, "_"),
  ].filter((t, i, arr) => t.length >= 3 && arr.indexOf(t) === i);

  return endpoints.filter((ep) => {
    const p = ep.path.toLowerCase();
    return tokens.some((t) => p.includes(t));
  });
}

export function formatEndpointList(endpoints: HttpEndpointRef[], max = 3): string {
  if (endpoints.length === 0) return "—";
  return endpoints
    .slice(0, max)
    .map((e) => `${e.method} ${e.path}`)
    .join(", ");
}

/** Endpoints típicos de auth/login cuando no hay match por entidad. */
export function inferAuthEndpoints(endpoints: HttpEndpointRef[]): HttpEndpointRef[] {
  return endpoints.filter((e) => /\/auth|\/login|\/otp|\/session/i.test(e.path));
}
