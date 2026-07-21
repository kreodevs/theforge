/**
 * Readiness SDD para greenfield LOW/MEDIUM (sin MDD canónico como constitución).
 */

import type { ComplexityLevel } from "@theforge/database";
import { ComplexityLevel as ComplexityLevelEnum } from "@theforge/database";
import {
  checkDeliverablePresence,
  checkTasksCoverage,
  checkUserStoriesVsUseCases,
  type CrossArtifactCheckResult,
} from "./sdd-cross-artifact.util.js";
import { checkBrdDecisionLogClosure } from "./brd-decision-log.util.js";
import type { ProjectDeliverableSource } from "../projects/conformance-gaps.util.js";

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
    const h2 = line.match(/^##\s+(.+)/);
    if (h2?.[1]) out.push(normalizeToken(h2[1]));
    const bold = line.match(/^[-*]\s+\*\*([^*]+)\*\*/);
    if (bold?.[1]) out.push(normalizeToken(bold[1]));
  }
  return out.filter((t) => t.length >= 3);
}

function conceptMentioned(concept: string, corpus: string): boolean {
  const words = concept.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return corpus.toLowerCase().includes(concept.toLowerCase());
  const hits = words.filter((w) => corpus.toLowerCase().includes(w));
  return hits.length >= Math.max(1, Math.ceil(words.length * 0.5));
}

function extractStoryIds(md: string): string[] {
  const ids: string[] = [];
  for (const m of md.matchAll(/\b(HU|US)[-_]?\d{1,3}\b/gi)) {
    ids.push(m[0]!.toUpperCase().replace(/-/g, "_"));
  }
  return ids;
}

function extractApiRouteSegments(api: string): string[] {
  const segments = new Set<string>();
  for (const m of api.matchAll(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/{}\-:.]+)/gi)) {
    const path = m[1] ?? "";
    for (const part of path.split("/").filter(Boolean)) {
      if (part.length > 2 && !part.startsWith("{")) segments.add(part.toLowerCase());
    }
  }
  return [...segments];
}

function extractSpecConcepts(spec: string): string[] {
  const concepts = new Set<string>();
  for (const h of extractHeadings(spec)) concepts.add(h);
  for (const m of spec.matchAll(/\*\*([^*]{3,60})\*\*/g)) {
    concepts.add(normalizeToken(m[1]!));
  }
  return [...concepts].filter(
    (c) => c.length >= 4 && !/^(objetivo|alcance|contexto|resumen)$/i.test(c),
  );
}

/** Cada HU/US debe reflejarse en tasks.md (ID o título). */
export function checkUserStoriesVsTasks(
  userStories: string | null | undefined,
  tasks: string | null | undefined,
): CrossArtifactCheckResult {
  if (!substantial(userStories) || !substantial(tasks)) {
    return { ok: true, gaps: [] };
  }
  const us = userStories!.trim();
  const tasksLower = tasks!.trim().toLowerCase();
  const gaps: string[] = [];

  const ids = extractStoryIds(us);
  for (const id of ids) {
    const slug = id.toLowerCase().replace(/_/g, "-");
    if (!tasksLower.includes(id.toLowerCase()) && !tasksLower.includes(slug)) {
      gaps.push(`[HU↔Tasks] ${id} sin task trazable`);
    }
  }

  const titles = extractHeadings(us)
    .filter((t) => t.length > 8 && !/^(como|when|given|historia)/i.test(t))
    .slice(0, 10);
  const untraced = titles.filter((t) => !conceptMentioned(t, tasksLower)).slice(0, 5);
  if (untraced.length >= 2) {
    gaps.push(`[HU↔Tasks] Historias sin cobertura en tasks: ${untraced.join("; ")}`);
  }

  return { ok: gaps.length === 0, gaps };
}

/** Conceptos del Spec deben aparecer en contratos API (rutas o descripción). */
export function checkSpecVsApi(
  spec: string | null | undefined,
  apiContracts: string | null | undefined,
): CrossArtifactCheckResult {
  if (!substantial(spec) || !substantial(apiContracts)) {
    return { ok: true, gaps: [] };
  }
  const concepts = extractSpecConcepts(spec!).slice(0, 10);
  const apiLower = apiContracts!.toLowerCase();
  const segments = new Set(extractApiRouteSegments(apiContracts!));
  const gaps: string[] = [];

  for (const concept of concepts) {
    const slug = concept.replace(/\s+/g, "-");
    const underscored = concept.replace(/\s+/g, "_");
    const inApi =
      conceptMentioned(concept, apiLower) ||
      segments.has(slug) ||
      segments.has(underscored) ||
      [...segments].some((s) => concept.includes(s) || s.includes(concept.replace(/\s/g, "")));
    if (!inApi) {
      gaps.push(`[Spec↔API] «${concept}» del Spec sin endpoint trazable`);
    }
  }

  return { ok: gaps.length === 0, gaps: gaps.slice(0, 8) };
}

/** Spec debe reflejarse en guía UX o flujos (al menos uno sustancial). */
export function checkSpecInUxOrFlows(
  spec: string | null | undefined,
  uxUiGuide: string | null | undefined,
  logicFlows: string | null | undefined,
): CrossArtifactCheckResult {
  if (!substantial(spec)) return { ok: true, gaps: [] };
  const ux = (uxUiGuide ?? "").trim();
  const lf = (logicFlows ?? "").trim();
  const gaps: string[] = [];

  if (!substantial(ux) && !substantial(lf)) {
    gaps.push("[Spec↔UX] Spec presente pero faltan Guía UX y Flujos de lógica");
    return { ok: false, gaps };
  }

  const concepts = extractSpecConcepts(spec!).slice(0, 8);
  const corpus = `${ux}\n${lf}`.toLowerCase();
  const missing = concepts.filter((c) => !conceptMentioned(c, corpus)).slice(0, 4);
  if (missing.length >= 2) {
    gaps.push(`[Spec↔UX] Capacidades del Spec ausentes en UX/Flujos: ${missing.join("; ")}`);
  }

  return { ok: gaps.length === 0, gaps };
}

export type LowMediumConformanceSummary = {
  ok: boolean;
  userStoriesOk: boolean;
  tasksOk: boolean;
  specOk: boolean;
  apiOk: boolean;
  uxOrFlowsOk: boolean;
  gapCount: number;
};

/** Gaps de readiness para greenfield LOW o MEDIUM. */
export function collectLowMediumReadinessGaps(
  complexity: Extract<ComplexityLevel, "LOW" | "MEDIUM">,
  source: ProjectDeliverableSource,
): string[] {
  const gaps: string[] = [];

  if (complexity === ComplexityLevelEnum.LOW) {
    const huGap = checkDeliverablePresence("Historias de usuario", source.userStoriesContent, true);
    if (huGap) gaps.push(`[Entregables] ${huGap}`);
    const tasksGap = checkDeliverablePresence("Tasks", source.tasksContent, true);
    if (tasksGap) gaps.push(`[Entregables] ${tasksGap}`);

    gaps.push(
      ...checkUserStoriesVsTasks(source.userStoriesContent, source.tasksContent).gaps,
    );
    gaps.push(
      ...checkUserStoriesVsUseCases(
        source.userStoriesContent,
        source.useCasesContent,
        source.specContent,
      ).gaps.map((g) => (g.startsWith("[") ? g : `[HU↔UC] ${g}`)),
    );

    if (substantial(source.specContent)) {
      gaps.push(
        ...checkTasksCoverage(source.tasksContent, null, null).gaps,
      );
    }
  } else {
    const specGap = checkDeliverablePresence("Spec", source.specContent, true);
    if (specGap) gaps.push(`[Entregables] ${specGap}`);
    const apiGap = checkDeliverablePresence("Contratos API", source.apiContractsContent, true);
    if (apiGap) gaps.push(`[Entregables] ${apiGap}`);
    const tasksGap = checkDeliverablePresence("Tasks", source.tasksContent, true);
    if (tasksGap) gaps.push(`[Entregables] ${tasksGap}`);

    const hasUx = substantial(source.uxUiGuideContent);
    const hasLf = substantial(source.logicFlowsContent);
    if (!hasUx && !hasLf) {
      gaps.push("[Entregables] Guía UX o Flujos de lógica ausentes (< 48 caracteres)");
    }

    gaps.push(...checkSpecVsApi(source.specContent, source.apiContractsContent).gaps);
    gaps.push(
      ...checkSpecInUxOrFlows(
        source.specContent,
        source.uxUiGuideContent,
        source.logicFlowsContent,
      ).gaps,
    );
    gaps.push(
      ...checkTasksCoverage(source.tasksContent, null, source.apiContractsContent).gaps,
    );
    gaps.push(
      ...checkUserStoriesVsUseCases(
        source.userStoriesContent,
        source.useCasesContent,
        source.specContent,
      ).gaps,
    );
  }

  if (source.brdContent?.trim()) {
    const brdLog = checkBrdDecisionLogClosure(source.brdContent);
    gaps.push(...brdLog.blockers.map((g) => `[BRD decision log] ${g}`));
    gaps.push(...brdLog.warnings.map((g) => `[BRD decision log] ${g}`));
  }

  return gaps;
}

export function buildLowMediumConformanceSummary(
  complexity: Extract<ComplexityLevel, "LOW" | "MEDIUM">,
  source: ProjectDeliverableSource,
): LowMediumConformanceSummary {
  const gaps = collectLowMediumReadinessGaps(complexity, source);
  const nonBrdGaps = gaps.filter((g) => !g.startsWith("[BRD decision log]"));

  return {
    ok: nonBrdGaps.length === 0,
    userStoriesOk: substantial(source.userStoriesContent),
    tasksOk: substantial(source.tasksContent),
    specOk: substantial(source.specContent),
    apiOk: substantial(source.apiContractsContent),
    uxOrFlowsOk:
      substantial(source.uxUiGuideContent) || substantial(source.logicFlowsContent),
    gapCount: gaps.length,
  };
}

/** Filtra gaps LOW/MEDIUM relevantes para un paso de cascada. */
export function lowMediumGapsForCascadeStep(
  complexity: Extract<ComplexityLevel, "LOW" | "MEDIUM">,
  step: string,
  source: ProjectDeliverableSource,
): string[] {
  const all = collectLowMediumReadinessGaps(complexity, source);
  const stepPatterns: Record<string, RegExp[]> = {
    user_stories: [/^\[Entregables\].*Historias/i, /^\[HU↔/i],
    tasks: [/^\[Entregables\].*Tasks/i, /^\[HU↔Tasks\]/i, /^\[Tasks\]/i, /^\[Spec↔API\]/i, /^\[Spec↔UX\]/i],
    spec: [/^\[Entregables\].*Spec/i, /^\[Spec↔/i, /^\[HU↔UC\]/i],
    api_contracts: [/^\[Entregables\].*API/i, /^\[Spec↔API\]/i, /^\[Tasks\]/i],
    ux_ui_guide: [/^\[Entregables\].*UX/i, /^\[Spec↔UX\]/i],
    logic_flows: [/^\[Entregables\].*Flujos/i, /^\[Spec↔UX\]/i],
  };
  const patterns = stepPatterns[step];
  if (!patterns) return all.filter((g) => !g.startsWith("[BRD decision log]")).slice(0, 12);
  return all.filter((g) => patterns.some((re) => re.test(g))).slice(0, 16);
}
