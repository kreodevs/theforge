/**
 * Checklist de cobertura inyectado en generadores greenfield (paridad con legacy AS-IS).
 */

import { extractEntities, extractMddSection4Endpoints } from "./conformance.service.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

export interface SddCoverageChecklistInput {
  mddMarkdown: string;
  phase0Summary?: string | null;
  phase0GapsJson?: string | null;
  blueprintMarkdown?: string | null;
  /** Etiqueta del artefacto destino (Architecture, Tasks, …). */
  artifactLabel?: string;
}

export interface OpenResearchGap {
  id: string;
  description: string;
  artifacts?: string[];
}

function extractApiRouteRows(section4: string, max = 80): string[] {
  const routes: string[] = [];
  for (const line of section4.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes(":---")) continue;
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;
    const routeCell = cells.find((c) => c.startsWith("/") || /^GET|POST|PUT|PATCH|DELETE/i.test(c));
    if (routeCell) routes.push(routeCell.replace(/\s+/g, " ").slice(0, 120));
    else if (cells[0]?.startsWith("/")) routes.push(cells[0].slice(0, 120));
    if (routes.length >= max) break;
  }
  return routes;
}

/** Servicios core nombrados en MDD §2 (Engine, Service, Gateway, Orchestrator). */
export function extractMddCoreServices(mddMarkdown: string): string[] {
  const section2 = extractSectionByNumber(mddMarkdown, 2);
  const services = new Set<string>();
  const coreParen = section2.match(/Core\s*\(([^)]+)\)/i);
  if (coreParen?.[1]) {
    for (const part of coreParen[1].split(",")) {
      const t = part.trim();
      if (t.length > 2) services.add(t);
    }
  }
  for (const m of section2.matchAll(
    /\b([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]+)*\s+(?:Engine|Service|Gateway|Orchestrator))\b/g,
  )) {
    if (m[1]) services.add(m[1].trim());
  }
  return [...services].sort();
}

export interface MddColumnSpec {
  table: string;
  column: string;
  unique: boolean;
  notNull: boolean;
}

/** Columnas relevantes de CREATE TABLE en MDD §3. */
export function extractMddTableColumns(mddMarkdown: string): MddColumnSpec[] {
  const section3 = extractSectionByNumber(mddMarkdown, 3);
  const out: MddColumnSpec[] = [];
  const sqlCorpus = section3.replace(/```[a-z]*\n?/gi, "\n");
  for (const block of sqlCorpus.split(/create\s+table/gi).slice(1)) {
    const tableMatch = block.match(/^\s*["`]?([a-z_][a-z0-9_]*)["`]?\s*\(/i);
    const table = tableMatch?.[1]?.toLowerCase() ?? "unknown";
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith(");") || trimmed === ")") break;
      const colMatch = trimmed.match(/^([a-z_][a-z0-9_]*)\s+/i);
      if (!colMatch?.[1]) continue;
      const column = colMatch[1].toLowerCase();
      if (/^(id|created_at|updated_at)$/.test(column)) continue;
      const upper = trimmed.toUpperCase();
      out.push({
        table,
        column,
        unique: upper.includes("UNIQUE"),
        notNull: upper.includes("NOT NULL"),
      });
    }
  }
  return out.filter((c) => c.unique || c.notNull);
}

/** Mandatorios M* en research / phase0. */
export function extractResearchMandatories(research: string): string[] {
  const items: string[] = [];
  for (const m of research.matchAll(/\*\*M(\d+):\*\*\s*([^\n]+)/g)) {
    items.push(`M${m[1]}: ${m[2]!.trim()}`);
  }
  return items;
}

/** Open gaps machine-readable o bullets de «Análisis de Gaps». */
export function extractOpenResearchGaps(research: string): OpenResearchGap[] {
  const gaps: OpenResearchGap[] = [];
  for (const m of research.matchAll(
    /-\s*\[OPEN-GAP\]\s*id=([^|\n]+)\s*\|\s*artefacto=([^|\n]+)\s*\|\s*descripción=([^\n]+)/gi,
  )) {
    gaps.push({
      id: m[1]!.trim(),
      description: m[3]!.trim(),
      artifacts: m[2]!.split(",").map((a) => a.trim()),
    });
  }
  const gapSection = research.match(
    /##\s*4\.\s*Análisis de Gaps[\s\S]*?(?=##\s*5\.|$)/i,
  )?.[0];
  if (gapSection) {
    for (const m of gapSection.matchAll(/^-\s+\*\*([^*]+):\*\*\s*([^\n]+)/gm)) {
      const desc = m[2]!.trim();
      if (/no se especifica|falta|gap|sin detalle/i.test(desc)) {
        gaps.push({ id: m[1]!.trim().slice(0, 40), description: desc });
      }
    }
    for (const m of gapSection.matchAll(/^-\s+([^*\n][^\n]{20,})/gm)) {
      const desc = m[1]!.trim();
      if (/no se especifica|falta|gap|sin detalle|no se detalla/i.test(desc)) {
        gaps.push({ id: desc.slice(0, 32), description: desc });
      }
    }
  }
  const seen = new Set<string>();
  return gaps.filter((g) => {
    const key = g.id + g.description.slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Fases numeradas del blueprint §7. */
export function extractBlueprintPhases(blueprint: string): string[] {
  const phases: string[] = [];
  const section7 = blueprint.match(/###\s*7\.[\s\S]*?(?=###\s*8\.|$)/i)?.[0] ?? blueprint;
  for (const m of section7.matchAll(/\d+\.\s+\*\*Fase\s+(\d+):\*\*\s*([^\n]+)/gi)) {
    phases.push(`Fase ${m[1]}: ${m[2]!.trim()}`);
  }
  return [...new Set(phases)];
}

function parsePhase0GapDescriptions(phase0GapsJson: string | null | undefined): string[] {
  if (!phase0GapsJson?.trim()) return [];
  try {
    const parsed = JSON.parse(phase0GapsJson) as { gaps?: Array<{ descripcion?: string; titulo?: string }> };
    const gaps = Array.isArray(parsed) ? parsed : parsed.gaps;
    if (!Array.isArray(gaps)) return [];
    return gaps
      .map((g) => (g.descripcion ?? g.titulo ?? "").trim())
      .filter((d) => d.length > 8);
  } catch {
    return [];
  }
}

/**
 * Genera bloque CHECKLIST DE COBERTURA OBLIGATORIA para inyectar en user prompts greenfield.
 */
export function buildGreenfieldCoverageChecklist(input: SddCoverageChecklistInput): string {
  const mdd = input.mddMarkdown.trim();
  if (!mdd) return "";

  const artifact = input.artifactLabel?.trim() || "entregable";
  const s3 = extractSectionByNumber(mdd, 3);
  const s4 = extractSectionByNumber(mdd, 4);
  const s5 = extractSectionByNumber(mdd, 5);
  const entities = [...extractEntities(s3)].sort();
  const routes = extractApiRouteRows(s4);
  const endpoints = extractMddSection4Endpoints(mdd);
  const services = extractMddCoreServices(mdd);
  const columns = extractMddTableColumns(mdd);
  const research = (input.phase0Summary ?? "").trim();
  const mandatories = extractResearchMandatories(research);
  const openGaps: OpenResearchGap[] = [
    ...extractOpenResearchGaps(research),
    ...parsePhase0GapDescriptions(input.phase0GapsJson).map((d) => ({
      id: d.slice(0, 32),
      description: d,
    })),
  ];
  const phases = input.blueprintMarkdown?.trim()
    ? extractBlueprintPhases(input.blueprintMarkdown)
    : [];

  const lines: string[] = [
    `**CHECKLIST DE COBERTURA OBLIGATORIA (${artifact} — greenfield):**`,
    "",
    "Recorre **cada** ítem `- [ ]` antes de cerrar el documento.",
    "",
  ];

  if (services.length) {
    lines.push("**Servicios / módulos core MDD §2:**");
    for (const s of services) lines.push(`- [ ] ${s}`);
    lines.push("");
  }

  if (entities.length) {
    lines.push("**Entidades §3:**");
    for (const e of entities.slice(0, 60)) lines.push(`- [ ] ${e}`);
    if (entities.length > 60) lines.push(`- [ ] … y ${entities.length - 60} entidades más`);
    lines.push("");
  }

  const criticalCols = columns.filter((c) => c.unique || c.notNull);
  if (criticalCols.length && /task/i.test(artifact)) {
    lines.push("**Columnas §3 → migración + entity/DTO (Tasks):**");
    for (const c of criticalCols.slice(0, 40)) {
      const flags = [c.unique ? "UNIQUE" : "", c.notNull ? "NOT NULL" : ""].filter(Boolean).join(", ");
      lines.push(`- [ ] ${c.table}.${c.column} (${flags})`);
    }
    lines.push("");
  }

  const routeList = routes.length ? routes : endpoints.map((e) => `${e.method} ${e.path}`);
  if (routeList.length) {
    lines.push("**Endpoints §4:**");
    for (const r of routeList.slice(0, 50)) lines.push(`- [ ] ${r}`);
    if (routeList.length > 50) lines.push(`- [ ] … y ${routeList.length - 50} rutas más`);
    lines.push("");
  }

  if (s5.length > 80) {
    lines.push("**Flujos / reglas §5 (cada flujo Mermaid o regla nombrada):**");
    for (const m of s5.matchAll(/^#{2,4}\s+(.+)/gm)) {
      const title = m[1]!.replace(/\*\*/g, "").trim();
      if (title.length > 4 && !/^modelo|^seguridad|^infra/i.test(title)) {
        lines.push(`- [ ] ${title}`);
      }
    }
    lines.push("");
  }

  if (mandatories.length) {
    lines.push("**Mandatorios research (M*):**");
    for (const m of mandatories) lines.push(`- [ ] ${m}`);
    lines.push("");
  }

  if (openGaps.length) {
    lines.push("**Open gaps research / Phase0 → tarea o spec en este artefacto:**");
    for (const g of openGaps.slice(0, 15)) {
      const arts = g.artifacts?.length ? ` [${g.artifacts.join(", ")}]` : "";
      lines.push(`- [ ] ${g.id}: ${g.description}${arts}`);
    }
    lines.push("");
  }

  if (phases.length && /task/i.test(artifact)) {
    lines.push("**Fases blueprint §7 → sección ## Fase N en Tasks:**");
    for (const p of phases) lines.push(`- [ ] ${p}`);
    lines.push("");
  }

  if (/rabbitmq|event|ingestion|alpha/i.test(mdd + (input.blueprintMarkdown ?? ""))) {
    lines.push("**Eventos (RabbitMQ / EDA):**");
    lines.push("- [ ] Contrato evento + payload JSON entre servicios acoplados");
    lines.push("- [ ] Publisher y consumer documentados (Tasks si aplica)");
    lines.push("");
  }

  return lines.join("\n");
}

export function appendCoverageChecklistToPrompt(prompt: string, checklist: string): string {
  const t = checklist.trim();
  if (!t) return prompt;
  return `${prompt.trimEnd()}\n\n---\n\n${t}\n`;
}
