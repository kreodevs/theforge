/**
 * DocAccuracyScore + TaskAccuracyScore (PLAN-CASCADE-90-ACCURACY).
 */

import {
  AUTH_ENTITY_FAMILY,
  CASCADE_ACCURACY_THRESHOLD,
  type AccuracyComponentScore,
  type CascadeAccuracyReport,
  type DocAccuracyResult,
  type DomainInventory,
  type TaskAccuracyResult,
} from "@theforge/shared-types";
import { buildDomainInventory, detectAuthOnlySkew } from "./domain-inventory.util.js";
import { extractEntities } from "./conformance.service.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

export interface CascadeAccuracyInput {
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown?: string | null;
  specMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
  logicFlowsMarkdown?: string | null;
  uiScreensMarkdown?: string | null;
  tasksMarkdown?: string | null;
  useCasesMarkdown?: string | null;
  userStoriesMarkdown?: string | null;
  inventory?: DomainInventory;
  hardGateEnabled?: boolean;
  /** Cuando false (p. ej. sin `hasUxTeam`), pantallas vacías no penalizan C4. Default true. */
  uiScreensRequired?: boolean;
}

function weightedScore(components: AccuracyComponentScore[]): number {
  const totalWeight = components.reduce((s, c) => s + c.weight, 0) || 1;
  const raw = components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function corpus(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join("\n").toLowerCase();
}

function capabilityAnchored(
  capTitle: string,
  capBody: string,
  haystack: string,
  aliasHints: string[] = [],
): boolean {
  const raw = `${capTitle} ${capBody} ${aliasHints.join(" ")}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const tokens = raw
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 4)
    .slice(0, 16);
  if (tokens.length === 0) return haystack.includes(capTitle.toLowerCase().slice(0, 20));
  let hits = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) hits += 1;
    // stem: conversations ↔ conversation
    if (t.endsWith("s") && haystack.includes(t.slice(0, -1))) hits += 1;
    if (!t.endsWith("s") && haystack.includes(`${t}s`)) hits += 1;
  }
  return hits >= Math.min(2, Math.max(1, Math.ceil(tokens.length / 4)));
}

/** Entity / capability alias bag for C1 matching. */
export function domainAliasHints(inventory: DomainInventory): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of inventory.suggestedEntities) {
    const parts = e.split("_").filter((p) => p.length >= 3);
    map.set(e, parts);
  }
  for (const cap of inventory.capabilities) {
    const aliases = inventory.suggestedEntities
      .filter((e) => {
        const bag = `${cap.title} ${cap.body}`.toLowerCase();
        return e.split("_").some((p) => p.length >= 4 && bag.includes(p));
      })
      .slice(0, 6);
    map.set(cap.id, aliases);
  }
  return map;
}

export function computeDocAccuracy(input: CascadeAccuracyInput): DocAccuracyResult {
  const inventory =
    input.inventory ??
    buildDomainInventory({
      brdMarkdown: input.brdMarkdown,
      dbgaMarkdown: input.dbgaMarkdown,
      mddMarkdown: input.mddMarkdown,
      mddEntities: extractEntities(extractSectionByNumber(input.mddMarkdown ?? "", 3) || input.mddMarkdown || ""),
    });

  const mddSection3 = extractSectionByNumber(input.mddMarkdown ?? "", 3);
  const mddEntities = extractEntities(mddSection3 || input.mddMarkdown || "");
  const haystack = corpus(
    input.mddMarkdown,
    input.specMarkdown,
    input.apiContractsMarkdown,
    input.logicFlowsMarkdown,
    input.uiScreensMarkdown,
  );

  const caps = inventory.capabilities;
  const domainCaps = caps.filter((c) => !c.isAuthRelated);
  const capsToScore = domainCaps.length > 0 ? domainCaps : caps;

  const aliases = domainAliasHints(inventory);

  // C1 Capability coverage (30)
  const c1Gaps: string[] = [];
  let c1Hits = 0;
  for (const cap of capsToScore) {
    const hints = aliases.get(cap.id) ?? [];
    if (capabilityAnchored(cap.title, cap.body, haystack, hints)) c1Hits += 1;
    else c1Gaps.push(`Capacidad sin ancla en docs: ${cap.title}`);
  }
  const c1Score =
    capsToScore.length === 0 ? 100 : Math.round((c1Hits / capsToScore.length) * 100);

  // C2 Process coverage (20)
  const flows = (input.logicFlowsMarkdown ?? "").toLowerCase();
  const c2Gaps: string[] = [];
  let c2Hits = 0;
  const critical = inventory.processes.filter((p) => p.critical);
  for (const proc of critical) {
    const token = proc.name.toLowerCase().split(/\s+/).find((w) => w.length > 5) ?? proc.name.toLowerCase();
    if (flows.includes(token) || haystack.includes(token)) c2Hits += 1;
    else c2Gaps.push(`Proceso crítico ausente en Logic Flows: ${proc.name}`);
  }
  const c2Score = critical.length === 0 ? 50 : Math.round((c2Hits / critical.length) * 100);

  // C3 CRUD matrix fidelity (15)
  const api = (input.apiContractsMarkdown ?? "").toLowerCase();
  const c3Gaps: string[] = [];
  const mvpRows = inventory.crudMatrix.filter((r) => r.mvp && !r.infraOnly);
  let c3Hits = 0;
  for (const row of mvpRows) {
    const inMdd = mddEntities.has(row.entity);
    const inApi = api.includes(row.entity.replace(/_/g, "-")) || api.includes(row.entity);
    if (inMdd && (inApi || AUTH_ENTITY_FAMILY.has(row.entity))) c3Hits += 1;
    else if (inMdd) c3Hits += 0.5;
    else c3Gaps.push(`CRUD sin entidad/API: ${row.entity}`);
  }
  const c3Score = mvpRows.length === 0 ? 40 : Math.round((c3Hits / mvpRows.length) * 100);

  // C4 Screen fidelity (15)
  const screens = input.uiScreensMarkdown ?? "";
  const uiScreensRequired = input.uiScreensRequired !== false;
  const c4Gaps: string[] = [];
  let c4Score = 40;
  if (!screens.trim()) {
    if (!uiScreensRequired) {
      c4Score = 50;
    } else {
      c4Gaps.push("uiScreens ausente");
      c4Score = 0;
    }
  } else {
    const wordCount = screens.trim().split(/\s+/).length;
    const hasChat = /chat|convers|whatsapp|composer|mensaje/i.test(screens);
    const hasTableOnly = (screens.match(/`Table`/g) ?? []).length >= 3 && !hasChat;
    const hasRoutes = (screens.match(/\/[a-z0-9\-]+/gi) ?? []).length >= 3;
    const outside = /fuera de alcance v1/i.test(screens);
    c4Score = 20;
    if (wordCount >= 800) c4Score += 25;
    else if (wordCount >= 400) c4Score += 10;
    if (hasRoutes) c4Score += 20;
    if (hasChat) c4Score += 20;
    if (hasTableOnly) {
      c4Score -= 25;
      c4Gaps.push("Pantallas degeneradas a Table (sin pantallas complejas)");
    }
    if (outside && domainCaps.length >= 3) {
      c4Score -= 15;
      c4Gaps.push("Admin/CRUD marcado fuera de alcance pese a capacidades de dominio");
    }
    c4Score = Math.max(0, Math.min(100, c4Score));
  }

  // C5 Cross-artifact (10) — lightweight
  const c5Gaps: string[] = [];
  let c5Score = 100;
  if (!(input.specMarkdown ?? "").trim()) {
    c5Gaps.push("Spec ausente");
    c5Score -= 40;
  }
  if (!(input.apiContractsMarkdown ?? "").trim()) {
    c5Gaps.push("API contracts ausente");
    c5Score -= 30;
  }
  if (/^##\s+[0-9]+\.\s*$/m.test(input.specMarkdown ?? "")) {
    c5Gaps.push("Spec journeys con headings vacíos");
    c5Score -= 20;
  }

  // C6 Scope drift / auth skew (10)
  const skew = detectAuthOnlySkew(mddEntities, caps);
  const c6Gaps: string[] = [];
  let c6Score = 100;
  if (skew.skewed) {
    c6Gaps.push(
      `MDD §3 solo auth (${[...mddEntities].join(", ")}) con ${skew.domainCapabilityCount} capacidades de dominio en BRD`,
    );
    c6Score = 10;
  }

  const components: AccuracyComponentScore[] = [
    { id: "C1_capability", weight: 30, score: c1Score, gaps: c1Gaps.slice(0, 12) },
    { id: "C2_process", weight: 20, score: c2Score, gaps: c2Gaps.slice(0, 12) },
    { id: "C3_crud", weight: 15, score: c3Score, gaps: c3Gaps.slice(0, 12) },
    { id: "C4_screens", weight: 15, score: c4Score, gaps: c4Gaps.slice(0, 8) },
    { id: "C5_cross", weight: 10, score: Math.max(0, c5Score), gaps: c5Gaps },
    { id: "C6_drift", weight: 10, score: c6Score, gaps: c6Gaps },
  ];

  const score = weightedScore(components);
  const blockers = [
    ...c6Gaps,
    ...(c1Score < 50 ? c1Gaps.slice(0, 5) : []),
  ];

  return {
    score,
    ok: score >= CASCADE_ACCURACY_THRESHOLD && blockers.filter((b) => /solo auth/i.test(b)).length === 0,
    components,
    blockers,
  };
}

export function computeTaskAccuracy(input: CascadeAccuracyInput): TaskAccuracyResult {
  const inventory =
    input.inventory ??
    buildDomainInventory({
      brdMarkdown: input.brdMarkdown,
      dbgaMarkdown: input.dbgaMarkdown,
      mddMarkdown: input.mddMarkdown,
      mddEntities: extractEntities(extractSectionByNumber(input.mddMarkdown ?? "", 3) || input.mddMarkdown || ""),
    });

  const tasks = (input.tasksMarkdown ?? "").toLowerCase();
  const caps = inventory.capabilities.filter((c) => !c.isAuthRelated);
  const capsToScore = caps.length > 0 ? caps : inventory.capabilities;

  // T1 Capability→task (35)
  const t1Gaps: string[] = [];
  let t1Hits = 0;
  const taskAliases = domainAliasHints(inventory);
  for (const cap of capsToScore) {
    const hints = taskAliases.get(cap.id) ?? [];
    if (capabilityAnchored(cap.title, cap.body, tasks, hints)) t1Hits += 1;
    else t1Gaps.push(`Sin task para capacidad: ${cap.title}`);
  }
  const t1Score =
    capsToScore.length === 0 ? (tasks.trim() ? 70 : 0) : Math.round((t1Hits / capsToScore.length) * 100);

  // T2 CRUD coverage (25)
  const t2Gaps: string[] = [];
  const mvp = inventory.crudMatrix.filter((r) => r.mvp && !r.infraOnly);
  let t2Hits = 0;
  for (const row of mvp) {
    if (tasks.includes(row.entity) || tasks.includes(row.entity.replace(/_/g, "-"))) t2Hits += 1;
    else t2Gaps.push(`Tasks no mencionan entidad ${row.entity}`);
  }
  const t2Score = mvp.length === 0 ? 50 : Math.round((t2Hits / mvp.length) * 100);

  // T3 Process→task (20)
  const t3Gaps: string[] = [];
  let t3Hits = 0;
  for (const proc of inventory.processes.filter((p) => p.critical)) {
    const token = proc.name.toLowerCase().split(/\s+/).find((w) => w.length > 5);
    if (token && tasks.includes(token)) t3Hits += 1;
    else t3Gaps.push(`Tasks no cubren proceso: ${proc.name}`);
  }
  const crit = inventory.processes.filter((p) => p.critical);
  const t3Score = crit.length === 0 ? 50 : Math.round((t3Hits / crit.length) * 100);

  // T4 Path fidelity (10)
  const hasPaths = /archivo:|`[a-z0-9_\-./]+`|src\//i.test(input.tasksMarkdown ?? "");
  const t4Score = !tasks.trim() ? 0 : hasPaths ? 90 : 40;
  const t4Gaps = hasPaths ? [] : ["Tasks sin rutas de archivo explícitas"];

  // T5 Auth skew (10)
  const authMentions = (tasks.match(/\b(ldap|mfa|totp|login|rbac|refresh.?token)\b/g) ?? []).length;
  const domainMentions = (tasks.match(/\b(whatsapp|wasender|bitrix|mcp|convers|mensaje|agente|bit[aá]cora|embedding)\b/g) ?? [])
    .length;
  let t5Score = 100;
  const t5Gaps: string[] = [];
  if (caps.length >= 3 && tasks.trim()) {
    const ratio = domainMentions / Math.max(1, domainMentions + authMentions);
    if (ratio < 0.3) {
      t5Score = Math.round(ratio * 100);
      t5Gaps.push(`Sesgo auth en Tasks (ratio dominio=${ratio.toFixed(2)})`);
    } else {
      t5Score = Math.min(100, Math.round(50 + ratio * 50));
    }
  }

  const components: AccuracyComponentScore[] = [
    { id: "T1_capability", weight: 35, score: t1Score, gaps: t1Gaps.slice(0, 12) },
    { id: "T2_crud", weight: 25, score: t2Score, gaps: t2Gaps.slice(0, 12) },
    { id: "T3_process", weight: 20, score: t3Score, gaps: t3Gaps.slice(0, 12) },
    { id: "T4_paths", weight: 10, score: t4Score, gaps: t4Gaps },
    { id: "T5_skew", weight: 10, score: t5Score, gaps: t5Gaps },
  ];

  const score = weightedScore(components);
  return {
    score,
    ok: score >= CASCADE_ACCURACY_THRESHOLD,
    components,
    blockers: [...t5Gaps, ...t1Gaps.slice(0, 3)],
  };
}

export function computeCascadeAccuracy(input: CascadeAccuracyInput): CascadeAccuracyReport {
  const hardGateEnabled =
    input.hardGateEnabled ??
    (typeof process !== "undefined" && process.env.REQUIRE_DOC_ACCURACY_90 === "true");
  const inventory =
    input.inventory ??
    buildDomainInventory({
      brdMarkdown: input.brdMarkdown,
      dbgaMarkdown: input.dbgaMarkdown,
      mddMarkdown: input.mddMarkdown,
      mddEntities: extractEntities(extractSectionByNumber(input.mddMarkdown ?? "", 3) || input.mddMarkdown || ""),
    });
  const withInv = { ...input, inventory };
  const doc = computeDocAccuracy(withInv);
  const tasks = computeTaskAccuracy(withInv);
  const codegenReady = doc.ok && tasks.ok;
  const hardGateBlocked = hardGateEnabled && !codegenReady;
  return {
    doc,
    tasks,
    codegenReady,
    hardGateEnabled,
    hardGateBlocked,
  };
}

/** Domain blockers for MDD delivery gate. */
export function domainDeliveryGateFindings(input: {
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown: string;
}): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const mddEntities = extractEntities(
    extractSectionByNumber(input.mddMarkdown, 3) || input.mddMarkdown,
  );
  const inventory = buildDomainInventory({
    brdMarkdown: input.brdMarkdown,
    dbgaMarkdown: input.dbgaMarkdown,
    mddMarkdown: input.mddMarkdown,
    mddEntities,
  });

  const skew = detectAuthOnlySkew(mddEntities, inventory.capabilities);
  if (skew.skewed) {
    blockers.push(
      `domain-auth-only-skew: MDD §3 solo contiene entidades de auth mientras el BRD declara ${skew.domainCapabilityCount} capacidades de dominio. Ampliar §3 con entidades de negocio (ver BRD §3 / DBGA).`,
    );
  }

  const businessSuggested = inventory.suggestedEntities.filter((e) => !AUTH_ENTITY_FAMILY.has(e));
  if (businessSuggested.length >= 4 && inventory.capabilities.filter((c) => !c.isAuthRelated).length >= 3) {
    const missing = businessSuggested.filter((e) => !mddEntities.has(e));
    const coverage = (businessSuggested.length - missing.length) / businessSuggested.length;
    if (coverage < 0.35) {
      blockers.push(
        `domain-entities-missing-vs-brd: cobertura de entidades de negocio en §3 = ${Math.round(coverage * 100)}% (faltan p.ej. ${missing.slice(0, 6).join(", ")}).`,
      );
    } else if (coverage < 0.7) {
      warnings.push(
        `Cobertura entidades de negocio en §3 = ${Math.round(coverage * 100)}% (objetivo ≥70%). Faltan: ${missing.slice(0, 8).join(", ")}`,
      );
    }
  }

  return { blockers, warnings };
}
