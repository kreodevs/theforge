/**
 * Post-procesadores deterministas §5–§10 cuando hay catálogo Paso 0 Workspace Chat.
 */

import {
  catalogMarksStranglerOutOfScope,
  isWorkspaceChatPaso0Catalog,
  listPaso0BusinessRules,
  WORKSPACE_CHAT_CHANGELOG_ROWS,
  WORKSPACE_CHAT_SECTION6_CANONICAL_BODY,
  WORKSPACE_CHAT_SECTION6_HEADINGS,
  WORKSPACE_CHAT_TRAZABILIDAD_EXCLUSIONS,
  WORKSPACE_CHAT_TRAZABILIDAD_GROUPS,
  WORKSPACE_CHAT_TRAZABILIDAD_LIMITS,
  WORKSPACE_CHAT_UI_COMPOSITION_RULES,
  WORKSPACE_CHAT_UI_OUT_OF_SCOPE,
  WORKSPACE_CHAT_UI_SURFACES,
  selectedPatternIdsFromMdd,
  updateMddGovernancePatterns,
  type Paso0DecisionCatalog,
} from "@theforge/shared-types";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

const STRANGLER_PATTERN_ID = "strangler-fig-estrangulamiento";
const STRANGLER_WIZARD_LINE_RE =
  /^(\s*- \[\s*)[xX](\s*\]\s*\*\*Strangler Fig\s*\(Estrangulamiento\):\*\*.*)$/gim;
const IDENTITY_PLATFORM_SCOPES_RE = /\bidentity_platform_scopes\b/gi;
const PASO0_SECTION6_PLACEHOLDER_RE =
  /_\(\s*Completar desde catálogo Paso 0[^)]*\)_/gi;
const PASO0_SECTION6_HEADING_LINE_RE = /^###\s*6\.(\d+)\s+/;

function substantialSectionBody(body: string, minLen = 80): boolean {
  const stripped = (body ?? "")
    .replace(PASO0_SECTION6_PLACEHOLDER_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length >= minLen;
}

/** Elimina bloques placeholder §6.x duplicados y headings 6.x consecutivos idénticos. */
export function dedupePaso0Section6PlaceholderBlocks(body: string): {
  body: string;
  removed: number;
} {
  let removed = 0;
  let out = body ?? "";
  const beforeCollapse = out;
  out = out.replace(
    /(?:_\(\s*Completar desde catálogo Paso 0[^)]*\)_\s*){2,}/gi,
    () => {
      removed += 1;
      return "_(Completar desde catálogo Paso 0 / nodo Seguridad.)_\n\n";
    },
  );
  if (out === beforeCollapse) {
    out = out.replace(PASO0_SECTION6_PLACEHOLDER_RE, (match, offset, full) => {
      const before = full.slice(0, offset);
      const lastHeading = before.match(/###\s*6\.\d+[^\n]*/gi)?.at(-1) ?? "";
      const sectionStart = before.lastIndexOf(lastHeading);
      const sectionSlice = sectionStart >= 0 ? full.slice(sectionStart, offset) : before;
      const priorPlaceholders = (sectionSlice.match(PASO0_SECTION6_PLACEHOLDER_RE) ?? []).length;
      if (priorPlaceholders > 0) {
        removed += 1;
        return "";
      }
      return match;
    });
  }

  const lines = out.split(/\r?\n/);
  const rebuilt: string[] = [];
  let prevHeadingKey = "";
  for (const line of lines) {
    const heading = line.match(PASO0_SECTION6_HEADING_LINE_RE);
    if (heading) {
      const key = line.trim().toLowerCase();
      if (key === prevHeadingKey) {
        removed += 1;
        continue;
      }
      prevHeadingKey = key;
    } else if (line.trim().startsWith("###")) {
      prevHeadingKey = "";
    }
    rebuilt.push(line);
  }
  out = rebuilt.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  const sections = out.split(/(?=^###\s*6\.\d+)/m);
  out = sections
    .map((section) => {
      if (!/^###\s*6\.\d+/m.test(section)) return section;
      let seenPlaceholder = false;
      return section.replace(PASO0_SECTION6_PLACEHOLDER_RE, (match) => {
        if (seenPlaceholder) {
          removed += 1;
          return "";
        }
        seenPlaceholder = true;
        return match;
      });
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { body: out, removed };
}

function removeDuplicateTailSections(
  mdd: string,
  headingRe: RegExp,
  minSubstantial = 80,
): { markdown: string; removed: number } {
  const out = (mdd ?? "").trimEnd();
  const matches = [...out.matchAll(headingRe)];
  if (matches.length <= 1) return { markdown: out, removed: 0 };

  let removed = 0;
  let markdown = out;
  for (let i = matches.length - 1; i >= 1; i--) {
    const start = matches[i]!.index!;
    const tail = markdown.slice(start);
    const headingLine = tail.match(/^\n?##[^\n]*/)?.[0] ?? "";
    const afterHeading = tail.slice(headingLine.length);
    const nextSection = afterHeading.search(/\n---\n|\n##\s+/);
    const end = nextSection >= 0 ? start + headingLine.length + nextSection : markdown.length;
    const body = markdown.slice(start + headingLine.length, end).trim();
    const keep = substantialSectionBody(body, minSubstantial);
    const prevStart = matches[i - 1]!.index!;
    const prevTail = markdown.slice(prevStart);
    const prevHeadingLine = prevTail.match(/^\n?##[^\n]*/)?.[0] ?? "";
    const prevAfter = prevTail.slice(prevHeadingLine.length);
    const prevNext = prevAfter.search(/\n---\n|\n##\s+/);
    const prevEnd = prevNext >= 0 ? prevStart + prevHeadingLine.length + prevNext : markdown.length;
    const prevBody = markdown.slice(prevStart + prevHeadingLine.length, prevEnd).trim();
    const prevKeep = substantialSectionBody(prevBody, minSubstantial);

    if (!keep || (prevKeep && prevBody.length >= body.length)) {
      markdown = markdown.slice(0, start) + markdown.slice(end);
      removed += 1;
    }
  }
  return { markdown: markdown.trimEnd() + "\n", removed };
}

/** Dedupe §9, §10 y UI/UX en cola del documento (conserva el bloque más sustancial). */
export function deduplicatePaso0TailSections(mddMarkdown: string): {
  markdown: string;
  removed: string[];
} {
  const removed: string[] = [];
  let markdown = mddMarkdown ?? "";

  const ui = removeDuplicateTailSections(
    markdown,
    /\n##\s+UI\/UX\s+Design\s+Intent\b/gi,
    120,
  );
  if (ui.removed > 0) {
    markdown = ui.markdown;
    removed.push(`ui-ux:${ui.removed}`);
  }

  const s9 = removeDuplicateTailSections(markdown, /\n##\s*9\.\s*Trazabilidad\b/gi, 80);
  if (s9.removed > 0) {
    markdown = s9.markdown;
    removed.push(`§9:${s9.removed}`);
  }

  const s10 = removeDuplicateTailSections(
    markdown,
    /\n##\s*10\.\s*Registro de cambios\b/gi,
    60,
  );
  if (s10.removed > 0) {
    markdown = s10.markdown;
    removed.push(`§10:${s10.removed}`);
  }

  return { markdown, removed };
}

function replaceSectionBody(draft: string, sectionNum: number, newBody: string): string {
  const section = extractSectionByNumber(draft, sectionNum);
  if (!section) return draft;
  const heading = section.match(/^##[^\n]+/)?.[0] ?? "";
  const rebuilt = `${heading}\n\n${newBody.trim()}\n`;
  return draft.replace(section, rebuilt);
}

function appendTailSection(mdd: string, heading: string, body: string): string {
  const trimmed = (mdd ?? "").trimEnd();
  if (new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "im").test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}\n\n---\n\n## ${heading}\n\n${body.trim()}\n`;
}

function replaceOrAppendTailSection(
  mdd: string,
  headingPattern: RegExp,
  heading: string,
  body: string,
): string {
  const trimmed = (mdd ?? "").trimEnd();
  const match = trimmed.match(headingPattern);
  if (!match?.index) {
    return appendTailSection(trimmed, heading, body);
  }
  const start = match.index;
  const after = trimmed.slice(start + match[0]!.length);
  const nextSection = after.search(/\n---\n|\n##\s+(?:9\.|10\.|Registro de cambios|UI\/UX)/i);
  const end = nextSection === -1 ? trimmed.length : start + match[0]!.length + nextSection;
  const replacement = `## ${heading}\n\n${body.trim()}\n`;
  return `${trimmed.slice(0, start)}${replacement}${trimmed.slice(end)}`.trimEnd() + "\n";
}

/** Cobertura de un grupo D-ID: cuántos IDs aparecen en el corpus MDD. */
export function scorePaso0DecisionGroupCoverage(
  decisionIds: readonly string[],
  mddCorpus: string,
): { covered: number; total: number; status: "ok" | "partial" | "missing" } {
  const corpus = mddCorpus ?? "";
  const covered = decisionIds.filter((id) => new RegExp(`\\b${id}\\b`).test(corpus)).length;
  const total = decisionIds.length;
  if (covered === 0) return { covered, total, status: "missing" };
  if (covered < total) return { covered, total, status: "partial" };
  return { covered, total, status: "ok" };
}

/** Construye markdown §9 Trazabilidad desde catálogo + cobertura en MDD. */
export function buildPaso0Section9Trazabilidad(
  catalog: Paso0DecisionCatalog,
  mddMarkdown: string,
): string {
  if (!isWorkspaceChatPaso0Catalog(catalog)) {
    const ids = catalog.decisions.map((d) => d.id).sort();
    const corpus = mddMarkdown ?? "";
    const rows = ids.map((id) => {
      const hit = new RegExp(`\\b${id}\\b`).test(corpus) ? "✓" : "—";
      return `| ${id} | ${hit} | catálogo Paso 0 |`;
    });
    return (
      `### 9.1 Cobertura de decisiones vigentes\n\n` +
      `| D-ID | En MDD | Notas |\n|---|---|---|\n` +
      rows.join("\n") +
      `\n\n### 9.2 Exclusiones verificables\n\n${WORKSPACE_CHAT_TRAZABILIDAD_EXCLUSIONS}\n`
    );
  }

  const corpus = mddMarkdown ?? "";
  const groupRows = WORKSPACE_CHAT_TRAZABILIDAD_GROUPS.map((g) => {
    const ids = g.decisionIds.join(", ");
    const cov = scorePaso0DecisionGroupCoverage(g.decisionIds, corpus);
    const status =
      cov.status === "ok" ? "✓" : cov.status === "partial" ? `~${cov.covered}/${cov.total}` : "—";
    return `| ${ids} | ${g.materialization} | ${status} |`;
  });

  const catalogIds = new Set(catalog.decisions.map((d) => d.id));
  const missingFromMdd = [...catalogIds]
    .filter((id) => !new RegExp(`\\b${id}\\b`).test(corpus))
    .slice(0, 12);

  const lines: string[] = [
    "### 9.1 Cobertura de decisiones vigentes",
    "",
    "| Grupo | Dónde se materializa en este MDD | Cobertura |",
    "|---|---|---|",
    ...groupRows,
    "",
  ];

  if (missingFromMdd.length > 0) {
    lines.push(
      `> **Brecha:** ${missingFromMdd.length} D-ID del catálogo no referenciados aún en el MDD: ${missingFromMdd.join(", ")}${missingFromMdd.length >= 12 ? "…" : ""}.`,
      "",
    );
  }

  lines.push(
    "### 9.2 Exclusiones verificables",
    "",
    WORKSPACE_CHAT_TRAZABILIDAD_EXCLUSIONS,
    "",
    "### 9.3 Límites declarados",
    "",
    ...WORKSPACE_CHAT_TRAZABILIDAD_LIMITS.map((l, i) => `${i + 1}. ${l}`),
    "",
  );

  return lines.join("\n");
}

/** Inyecta o reemplaza §9 Trazabilidad en el MDD. */
export function ensurePaso0Section9InMdd(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: boolean } {
  const body = buildPaso0Section9Trazabilidad(catalog, mddMarkdown);
  const markdown = replaceOrAppendTailSection(
    mddMarkdown,
    /^##\s*9\.\s*Trazabilidad\b/im,
    "9. Trazabilidad",
    body,
  );
  return { markdown, applied: markdown !== mddMarkdown };
}

/** §10 changelog mínimo cuando falta o es trivial. */
export function ensurePaso0Section10ChangelogInMdd(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: boolean } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) return { markdown: mddMarkdown, applied: false };

  const existing = mddMarkdown.match(/^##\s*10\.\s*Registro de cambios[\s\S]*?(?=\n---\n|$)/im)?.[0] ?? "";
  const hasSubstantial =
    existing.length > 120 && /\|\s*2\.0\s*\|/i.test(existing) && /trazabilidad|paso\s*0|d-id/i.test(existing);
  if (hasSubstantial) return { markdown: mddMarkdown, applied: false };

  const rows = WORKSPACE_CHAT_CHANGELOG_ROWS.map(
    (r) => `| **${r.version}** | **${r.date}** | **${r.change}** |`,
  );
  const body =
    `| Versión | Fecha | Cambio |\n|---|---|---|\n` +
    `| 1.0 | — | Versión inicial generada desde BRD. |\n` +
    rows.join("\n") +
    `\n`;

  const markdown = replaceOrAppendTailSection(
    mddMarkdown,
    /^##\s*10\.\s*Registro de cambios\b/im,
    "10. Registro de cambios",
    body,
  );
  return { markdown, applied: markdown !== mddMarkdown };
}

/** Inyecta filas RN-XX con D-ID cuando faltan en §5. */
export function injectMissingPaso0BusinessRulesIntoSection5(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; injected: string[] } {
  const section5 = extractSectionByNumber(mddMarkdown, 5);
  if (!section5) return { markdown: mddMarkdown, injected: [] };

  const body = section5.replace(/^##[^\n]+\n?/, "").trim();
  const rules = listPaso0BusinessRules(catalog);
  const missing = rules.filter((rn) => !new RegExp(`\\b${rn.id}\\b`).test(body));
  if (missing.length === 0) return { markdown: mddMarkdown, injected: [] };

  const rows = missing.map((rn) => {
    const ids = rn.decisionIds?.join(", ") ?? "—";
    const gwt = (rn.givenWhenThen ?? rn.title).slice(0, 200);
    return `| ${rn.id} | ${rn.title} | ${gwt} | ${ids} |`;
  });
  const block =
    `\n\n### Reglas de negocio Paso 0 (auto)\n\n` +
    `| ID | Título | Given/When/Then | D-ID |\n` +
    `|:--:|---|---|---|\n` +
    rows.join("\n") +
    `\n`;

  return {
    markdown: replaceSectionBody(mddMarkdown, 5, body.trimEnd() + block),
    injected: missing.map((r) => r.id),
  };
}

/** Añade columna D-ID a filas RN existentes sin cita. */
export function enrichPaso0Section5DecisionIdCitations(
  section5Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; enriched: string[] } {
  const enriched: string[] = [];
  const rules = listPaso0BusinessRules(catalog);
  const byId = new Map(rules.map((r) => [r.id, r]));
  const lines = (section5Body ?? "").split(/\r?\n/);
  const out = lines.map((line) => {
    const rnMatch = line.match(/^\|\s*(RN-\d{2})\s*\|/);
    if (!rnMatch?.[1]) return line;
    const rnId = rnMatch[1];
    const rule = byId.get(rnId);
    if (!rule?.decisionIds?.length) return line;
    if (/\bD-\d{3}\b/.test(line)) return line;
    enriched.push(rnId);
    const ids = rule.decisionIds.join(", ");
    if (line.trimEnd().endsWith("|")) return `${line.trimEnd().slice(0, -1)} ${ids} |`;
    return `${line} <!-- D-ID: ${ids} -->`;
  });
  return { body: out.join("\n"), enriched };
}

/** Sustituye `identity_platform_scopes` inventado → `platform_scopes` + app scopes (D-082). */
export function sanitizePaso0Section6PlatformScopes(body: string): { body: string; warnings: string[] } {
  const warnings: string[] = [];
  if (!IDENTITY_PLATFORM_SCOPES_RE.test(body ?? "") && !/\bidentity platform scopes\b/i.test(body ?? "")) {
    return { body: body ?? "", warnings };
  }
  const next = (body ?? "")
    .replace(IDENTITY_PLATFORM_SCOPES_RE, "platform_scopes")
    .replace(/\bidentity platform scopes\b/gi, "platform_scopes")
    .replace(
      /\bplatform_scopes\s+de\s+identidad\b/gi,
      "platform_scopes (sistema) y scopes de aplicación (app scopes)",
    );
  warnings.push("§6: identity_platform_scopes → platform_scopes + app scopes");
  return { body: next, warnings };
}

/** Garantiza headings §6.1–§6.8 (inserta esqueleto si faltan). */
export function ensurePaso0Section6CanonicalHeadings(body: string): { body: string; injected: string[] } {
  const injected: string[] = [];
  let out = body ?? "";
  for (const h of WORKSPACE_CHAT_SECTION6_HEADINGS) {
    const re = new RegExp(`###\\s*${h.num.replace(".", "\\.")}\\s+`, "i");
    if (re.test(out)) continue;
    injected.push(h.num);
    out =
      `${out.trimEnd()}\n\n### ${h.num} ${h.title}\n\n` +
      `_(Completar desde catálogo Paso 0 / nodo Seguridad.)_\n`;
  }
  return { body: out.replace(/\n{3,}/g, "\n\n").trim(), injected };
}

/** True si §6 ya contiene cuerpo canónico EXPECTED-MDD (evita re-hidratar / falsos blockers). */
export function paso0Section6IsCanonical(body: string): boolean {
  const text = body ?? "";
  if (!/\| Regla \| D-ID \|/.test(text)) return false;
  if (!/###\s*6\.8\s+Transporte/i.test(text)) return false;
  if ((text.match(/###\s*6\.8\s+Transporte/gi)?.length ?? 0) !== 1) return false;
  if (!/\bD-150\b/.test(text) || !/\bD-091\b/.test(text)) return false;
  return true;
}

/** True si §6 necesita hidratación con contenido canónico EXPECTED-MDD. */
export function paso0Section6NeedsHydration(body: string): boolean {
  if (paso0Section6IsCanonical(body)) return false;
  const stripped = (body ?? "")
    .replace(PASO0_SECTION6_PLACEHOLDER_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  if (PASO0_SECTION6_PLACEHOLDER_RE.test(body ?? "")) return true;
  if (stripped.length < 800) return true;
  if (!/\| Regla \| D-ID \|/.test(body ?? "")) return true;
  if (!/###\s*6\.8\s+Transporte/i.test(body ?? "")) return true;
  const section68Count = (body ?? "").match(/###\s*6\.8\s+Transporte/gi)?.length ?? 0;
  if (section68Count > 1) return true;
  const section62 = (body ?? "").match(/###\s*6\.2[\s\S]*?(?=###\s*6\.3|$)/i)?.[0] ?? "";
  if (/```/.test(section62) && !/application_id del token/.test(section62)) return true;
  if (/\|\s*Regla\s*\|[\s\S]*?```/.test(section62)) return true;
  return false;
}

/** Sustituye §6 placeholder o incompleto por cuerpo canónico (EXPECTED-MDD §6.1–§6.8). */
export function hydratePaso0WorkspaceChatSection6(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: boolean } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) {
    return { markdown: mddMarkdown, applied: false };
  }
  const section6 = extractSectionByNumber(mddMarkdown, 6);
  if (!section6) return { markdown: mddMarkdown, applied: false };

  let body = section6.replace(/^##[^\n]+\n?/, "").trim();
  const scopes = sanitizePaso0Section6PlatformScopes(body);
  body = scopes.body;
  if (!paso0Section6NeedsHydration(body)) {
    return { markdown: mddMarkdown, applied: false };
  }
  return {
    markdown: replaceSectionBody(mddMarkdown, 6, WORKSPACE_CHAT_SECTION6_CANONICAL_BODY),
    applied: true,
  };
}

/** Post-procesa §6: scopes + headings canónicos + hidratación. */
export function restructurePaso0Section6(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: string[] } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) return { markdown: mddMarkdown, applied: [] };

  const section6 = extractSectionByNumber(mddMarkdown, 6);
  if (!section6) return { markdown: mddMarkdown, applied: [] };

  let body = section6.replace(/^##[^\n]+\n?/, "").trim();
  const applied: string[] = [];
  const scopes = sanitizePaso0Section6PlatformScopes(body);
  if (scopes.body !== body) {
    body = scopes.body;
    applied.push("§6-platform-scopes");
  }
  const headings = ensurePaso0Section6CanonicalHeadings(body);
  if (headings.injected.length > 0) {
    body = headings.body;
    applied.push(`§6-headings:${headings.injected.join(",")}`);
  }
  const dedupedPlaceholders = dedupePaso0Section6PlaceholderBlocks(body);
  if (dedupedPlaceholders.removed > 0) {
    body = dedupedPlaceholders.body;
    applied.push(`§6-placeholder-dedupe:${dedupedPlaceholders.removed}`);
  }

  let markdown = mddMarkdown;
  if (body !== section6.replace(/^##[^\n]+\n?/, "").trim() || applied.length > 0) {
    markdown = replaceSectionBody(mddMarkdown, 6, body);
  }

  const hydrated = hydratePaso0WorkspaceChatSection6(markdown, catalog);
  if (hydrated.applied) {
    markdown = hydrated.markdown;
    applied.push("§6-hydrate-canonical");
  }

  if (applied.length === 0) return { markdown: mddMarkdown, applied: [] };
  return { markdown, applied };
}

/** Construye §8 UI/UX Design Intent específico Workspace Chat (EXPECTED-MDD §8). */
export function buildWorkspaceChatUiUxDesignIntentSection(): string {
  const surfaceRows = WORKSPACE_CHAT_UI_SURFACES.map(
    (s) => `| ${s.surface} | ${s.scope} | ${s.rule} | ${s.decisionIds} |`,
  );
  const compositionRows = WORKSPACE_CHAT_UI_COMPOSITION_RULES.map(
    (r) => `| ${r.rule} | ${r.decisionIds} |`,
  );

  return (
    `## UI/UX Design Intent\n\n` +
    `### 8.1 Superficies\n\n` +
    `| Superficie | Alcance | Regla vinculante | D-ID |\n|---|---|---|---|\n` +
    surfaceRows.join("\n") +
    `\n\n### 8.2 Reglas de composición vinculantes\n\n` +
    `| Regla | D-ID |\n|---|---|\n` +
    compositionRows.join("\n") +
    `\n\n### 8.3 Fuera de alcance de la UI\n\n${WORKSPACE_CHAT_UI_OUT_OF_SCOPE}\n`
  );
}

/** Garantiza §8 UI/UX antes de §9; dedupe si quedó duplicado. */
export function ensurePaso0Section8UiUxInMdd(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: boolean } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) {
    return { markdown: mddMarkdown, applied: false };
  }
  const trimmed = (mddMarkdown ?? "").trimEnd();
  const hasUiUx = /^##\s*UI\/UX\s+Design\s+Intent\b/im.test(trimmed);
  if (hasUiUx) {
    const deduped = deduplicatePaso0TailSections(trimmed);
    return { markdown: deduped.markdown, applied: deduped.removed.length > 0 };
  }

  const section = buildWorkspaceChatUiUxDesignIntentSection();
  const s9Match = trimmed.match(/\n##\s*9\.\s*Trazabilidad\b/i);
  let markdown: string;
  if (s9Match?.index != null) {
    markdown = `${trimmed.slice(0, s9Match.index)}\n\n${section}\n${trimmed.slice(s9Match.index)}`;
  } else {
    markdown = `${trimmed}\n\n${section}`;
  }
  const deduped = deduplicatePaso0TailSections(markdown);
  return { markdown: deduped.markdown, applied: true };
}

/** Reemplaza §8 genérico por plantilla Workspace Chat cuando aplica Paso 0. */
export function hydratePaso0WorkspaceChatUiUxSection(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: boolean } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) return { markdown: mddMarkdown, applied: false };

  const genericHits = (mddMarkdown.match(/\bid,\s*name,\s*status\b/g) ?? []).length;
  const hasDomainSection =
    /###\s*8\.1\s+Superficies/i.test(mddMarkdown) ||
    (/Componente embebido/i.test(mddMarkdown) && /Cliente móvil/i.test(mddMarkdown));
  if (hasDomainSection && genericHits < 2) return { markdown: mddMarkdown, applied: false };

  let core = mddMarkdown
    .replace(/\n##\s*UI\/UX\s+Design\s+Intent[\s\S]*?(?=\n---\n|\n##\s*9\.|\n##\s*10\.|$)/i, "")
    .trimEnd();
  core = core
    .replace(/\n#{2,3}\s*(?:UI\/UX\s+)?Design\s+Intent[\s\S]*?(?=\n##\s+[1-9]|$)/gi, "")
    .trimEnd();
  const section = buildWorkspaceChatUiUxDesignIntentSection();
  return { markdown: `${core}\n\n${section}`, applied: true };
}

/** Deselecciona Strangler Fig en wizard SSOT cuando D-121 lo descarta. */
export function deselectStranglerFigInGovernanceWizard(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; warnings: string[] } {
  if (!catalogMarksStranglerOutOfScope(catalog)) {
    return { markdown: mddMarkdown ?? "", warnings: [] };
  }

  let markdown = mddMarkdown ?? "";
  let changed = false;

  const directDeselect = markdown.replace(STRANGLER_WIZARD_LINE_RE, "$1 $2");
  if (directDeselect !== markdown) {
    markdown = directDeselect;
    changed = true;
  }

  const ids = selectedPatternIdsFromMdd(markdown);
  if (ids.has(STRANGLER_PATTERN_ID)) {
    const next = new Set(ids);
    next.delete(STRANGLER_PATTERN_ID);
    const updated = updateMddGovernancePatterns(markdown, next);
    if (updated !== markdown) {
      markdown = updated;
      changed = true;
    }
  }

  if (!changed) {
    return { markdown: mddMarkdown ?? "", warnings: [] };
  }
  return {
    markdown,
    warnings: ["wizard: Strangler Fig deseleccionado (D-121 — corte por campaña)"],
  };
}

/** Pipeline tail §5–§10 para catálogo Paso 0. */
export function applyPaso0TailSectionEnrichment(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: string[] } {
  const applied: string[] = [];
  let markdown = mddMarkdown ?? "";

  const rn = injectMissingPaso0BusinessRulesIntoSection5(markdown, catalog);
  if (rn.injected.length > 0) {
    markdown = rn.markdown;
    applied.push(`§5-rn:${rn.injected.join(",")}`);
  }

  const section5 = extractSectionByNumber(markdown, 5);
  if (section5) {
    const body5 = section5.replace(/^##[^\n]+\n?/, "").trim();
    const cites = enrichPaso0Section5DecisionIdCitations(body5, catalog);
    if (cites.enriched.length > 0) {
      markdown = replaceSectionBody(markdown, 5, cites.body);
      applied.push(`§5-d-id:${cites.enriched.length}`);
    }
  }

  const s6 = restructurePaso0Section6(markdown, catalog);
  if (s6.applied.length > 0) {
    markdown = s6.markdown;
    applied.push(...s6.applied);
  }

  const ui = ensurePaso0Section8UiUxInMdd(markdown, catalog);
  if (ui.applied) {
    markdown = ui.markdown;
    applied.push("§8-workspace-chat");
  }

  const s9 = ensurePaso0Section9InMdd(markdown, catalog);
  if (s9.applied) {
    markdown = s9.markdown;
    applied.push("§9-trazabilidad");
  }

  const s10 = ensurePaso0Section10ChangelogInMdd(markdown, catalog);
  if (s10.applied) {
    markdown = s10.markdown;
    applied.push("§10-changelog");
  }

  const strangler = deselectStranglerFigInGovernanceWizard(markdown, catalog);
  if (strangler.warnings.length > 0) {
    markdown = strangler.markdown;
    applied.push("wizard-strangler-deselect");
  }

  const tailDedupe = deduplicatePaso0TailSections(markdown);
  if (tailDedupe.removed.length > 0) {
    markdown = tailDedupe.markdown;
    applied.push(`tail-dedupe:${tailDedupe.removed.join(",")}`);
  }

  return { markdown, applied };
}

/** Blocker gate: §9 ausente con catálogo Paso 0 pegado. */
export function detectMissingPaso0Section9Blocker(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): string[] {
  if (!isWorkspaceChatPaso0Catalog(catalog)) return [];
  if (/^##\s*9\.\s*Trazabilidad\b/im.test(mddMarkdown ?? "")) return [];
  return ["[Paso 0 §9] Sección Trazabilidad ausente — auto-generar desde catálogo D-ID antes de persistir."];
}

/** Cuenta D-IDs referenciados vs catálogo (métrica trazabilidad). */
export function countPaso0DecisionIdCoverage(
  catalog: Paso0DecisionCatalog,
  mddMarkdown: string,
): { referenced: number; total: number; ratio: number } {
  const total = catalog.decisions.length;
  if (total === 0) return { referenced: 0, total: 0, ratio: 1 };
  const corpus = mddMarkdown ?? "";
  const referenced = catalog.decisions.filter((d) => new RegExp(`\\b${d.id}\\b`).test(corpus)).length;
  return { referenced, total, ratio: referenced / total };
}
