/**
 * Cross-artifact SDD conformance checks (Spec, UC, HU, Tasks vs MDD/Blueprint/API).
 */

export interface CrossArtifactCheckResult {
  ok: boolean;
  gaps: string[];
}

const MIN_SUBSTANTIAL = 48;

function substantial(s: string | null | undefined): boolean {
  return typeof s === "string" && s.trim().length >= MIN_SUBSTANTIAL;
}

function normalizeToken(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/^[-*#\d.]+\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function extractHeadings(md: string): string[] {
  const out: string[] = [];
  for (const line of md.split("\n")) {
    const h3 = line.match(/^###\s+(.+)/);
    if (h3?.[1]) out.push(normalizeToken(h3[1]));
    const bold = line.match(/^[-*]\s+\*\*([^*]+)\*\*/);
    if (bold?.[1]) out.push(normalizeToken(bold[1]));
  }
  return out.filter((t) => t.length >= 3);
}

function extractSqlTableNames(mdd: string): Set<string> {
  const names = new Set<string>();
  for (const m of mdd.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-z_][a-z0-9_]*)["`]?/gi)) {
    if (m[1]) names.add(m[1].toLowerCase());
  }
  return names;
}

function extractSpecConcepts(spec: string): string[] {
  const concepts = new Set<string>();
  for (const h of extractHeadings(spec)) concepts.add(h);
  for (const m of spec.matchAll(/\*\*([^*]{3,60})\*\*/g)) {
    concepts.add(normalizeToken(m[1]!));
  }
  return [...concepts].filter((c) => c.length >= 4 && !/^(objetivo|alcance|contexto|resumen)$/i.test(c));
}

function conceptMentioned(concept: string, corpus: string): boolean {
  const c = concept.toLowerCase();
  const words = c.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return false;
  const hits = words.filter((w) => corpus.toLowerCase().includes(w));
  return hits.length >= Math.max(1, Math.ceil(words.length * 0.5));
}

/** Spec entities/capabilities should appear in MDD §1 or §3 SQL tables. */
export function checkSpecVsMdd(spec: string | null | undefined, mdd: string | null | undefined): CrossArtifactCheckResult {
  const specTrim = (spec ?? "").trim();
  const mddTrim = (mdd ?? "").trim();
  if (!substantial(specTrim) || mddTrim.length < 200) return { ok: true, gaps: [] };

  const concepts = extractSpecConcepts(specTrim).slice(0, 12);
  const tables = extractSqlTableNames(mddTrim);
  const mddCorpus = mddTrim.toLowerCase();
  const gaps: string[] = [];

  for (const concept of concepts) {
    const inMdd = conceptMentioned(concept, mddCorpus) || [...tables].some((t) => concept.includes(t) || t.includes(concept.replace(/\s/g, "_")));
    if (!inMdd) gaps.push(`Spec menciona «${concept}» sin reflejo claro en MDD §1/§3`);
  }

  return { ok: gaps.length === 0, gaps: gaps.slice(0, 8) };
}

function extractStoryIds(md: string): Set<string> {
  const ids = new Set<string>();
  for (const m of md.matchAll(/\b(HU|US|UC|CU)[-_]?\d{1,3}\b/gi)) {
    ids.add(m[0]!.toUpperCase().replace(/-/g, "_"));
  }
  return ids;
}

function extractStoryTitles(md: string): string[] {
  return extractHeadings(md).filter((h) => !/^(como|when|given|historia|caso)/i.test(h));
}

/** User stories should trace to use cases (IDs or shared titles). */
export function checkUserStoriesVsUseCases(
  userStories: string | null | undefined,
  useCases: string | null | undefined,
  spec?: string | null,
): CrossArtifactCheckResult {
  if (!substantial(userStories)) return { ok: true, gaps: [] };
  const us = (userStories ?? "").trim();
  const uc = (useCases ?? "").trim();
  const gaps: string[] = [];

  if (!substantial(uc)) {
    gaps.push("Historias de usuario presentes pero Casos de uso ausentes — generar UC antes de implementar");
    return { ok: false, gaps };
  }

  const usIds = extractStoryIds(us);
  const ucIds = extractStoryIds(uc);
  if (usIds.size > 0 && ucIds.size > 0) {
    const orphanUs = [...usIds].filter((id) => {
      const base = id.replace(/^US_?/, "UC_").replace(/^HU_?/, "UC_");
      return !ucIds.has(id) && !ucIds.has(base) && ![...ucIds].some((u) => u.includes(id.slice(-2)));
    });
    if (orphanUs.length > 0) {
      gaps.push(`HU sin caso de uso correspondiente: ${orphanUs.slice(0, 5).join(", ")}`);
    }
  } else {
    const usTitles = extractStoryTitles(us);
    const ucCorpus = uc.toLowerCase();
    const missing = usTitles.filter((t) => t.length > 5 && !conceptMentioned(t, ucCorpus)).slice(0, 5);
    if (missing.length >= 2) {
      gaps.push(`Historias sin traza en Casos de uso: ${missing.join("; ")}`);
    }
  }

  if (spec && substantial(spec)) {
    const specCorpus = spec.toLowerCase();
    const untraced = extractStoryTitles(us)
      .filter((t) => t.length > 8 && !conceptMentioned(t, specCorpus))
      .slice(0, 3);
    if (untraced.length > 0) {
      gaps.push(`HU no alineadas al Spec: ${untraced.join("; ")}`);
    }
  }

  return { ok: gaps.length === 0, gaps };
}

function extractApiRoutes(api: string): Set<string> {
  const routes = new Set<string>();
  for (const m of api.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/{}\-:.]+)/gi)) {
    routes.add(`${m[1]!.toUpperCase()} ${m[2]!.split("{")[0]!.replace(/\/$/, "")}`);
  }
  return routes;
}

function extractBlueprintModules(blueprint: string): string[] {
  return extractHeadings(blueprint).filter((h) => h.length >= 4);
}

/** Tasks should cover blueprint modules and key API routes. */
export function checkTasksCoverage(
  tasks: string | null | undefined,
  blueprint: string | null | undefined,
  apiContracts: string | null | undefined,
): CrossArtifactCheckResult {
  if (!substantial(tasks)) return { ok: true, gaps: [] };
  const tasksLower = (tasks ?? "").trim().toLowerCase();
  const gaps: string[] = [];

  if (substantial(blueprint)) {
    const modules = extractBlueprintModules(blueprint!).slice(0, 10);
    const uncovered = modules.filter((m) => m.length > 4 && !conceptMentioned(m, tasksLower)).slice(0, 5);
    if (uncovered.length >= 2) {
      gaps.push(`Tasks no cubren módulos del Blueprint: ${uncovered.join(", ")}`);
    }
  }

  if (substantial(apiContracts)) {
    const routes = [...extractApiRoutes(apiContracts!)].slice(0, 15);
    const uncoveredRoutes = routes.filter((r) => {
      const pathPart = r.split(" ")[1] ?? "";
      const segment = pathPart.split("/").filter(Boolean)[0] ?? pathPart;
      return segment.length > 2 && !tasksLower.includes(segment.toLowerCase());
    });
    if (uncoveredRoutes.length >= 3) {
      gaps.push(
        `Tasks sin cobertura de endpoints API (${uncoveredRoutes.length}): ${uncoveredRoutes.slice(0, 3).join(", ")}…`,
      );
    }
  }

  return { ok: gaps.length === 0, gaps };
}

export function checkDeliverablePresence(
  label: string,
  content: string | null | undefined,
  required: boolean,
): string | null {
  if (!required) return null;
  if (substantial(content)) return null;
  return `${label} ausente o insuficiente (< ${MIN_SUBSTANTIAL} caracteres)`;
}
