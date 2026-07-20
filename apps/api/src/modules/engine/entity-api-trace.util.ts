/**
 * Trazabilidad explícita: entidad DBGA/inventario → tabla MDD §3 → endpoint API.
 */

import type { DomainInventory } from "@theforge/shared-types";
import { extractHttpEndpointsFromMarkdown } from "../ui-mcp/api-contract-endpoints.util.js";
import { extractEntities } from "./conformance.service.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

export type EntityApiTraceRow = {
  entity: string;
  inMdd: boolean;
  inInventory: boolean;
  endpointHint?: string;
  matchedEndpoints: string[];
  gap?: string;
};

export type EntityApiTraceReport = {
  rows: EntityApiTraceRow[];
  gaps: string[];
  coverageRatio: number;
};

function entitySlugInPath(entity: string, path: string): boolean {
  const slug = entity.replace(/_/g, "-");
  const underscored = entity.replace(/-/g, "_");
  const lower = path.toLowerCase();
  return lower.includes(slug) || lower.includes(underscored) || lower.includes(entity);
}

function endpointsForEntity(
  entity: string,
  endpoints: Array<{ method: string; path: string }>,
  endpointHint?: string,
): string[] {
  const matched = endpoints
    .filter((ep) => entitySlugInPath(entity, ep.path))
    .map((ep) => `${ep.method} ${ep.path}`);
  if (matched.length > 0) return matched;
  if (endpointHint?.trim()) {
    const hintNorm = endpointHint.replace(/\s+/g, " ").trim();
    const hintMatch = endpoints.find(
      (ep) => `${ep.method} ${ep.path}`.toLowerCase() === hintNorm.toLowerCase(),
    );
    if (hintMatch) return [`${hintMatch.method} ${hintMatch.path}`];
  }
  return [];
}

/** Matriz entidad → §3 → API para audit_documents y W4. */
export function buildEntityApiTraceReport(params: {
  mddMarkdown: string;
  inventory?: DomainInventory | null;
  apiContractsMarkdown?: string | null;
}): EntityApiTraceReport {
  const section3 = extractSectionByNumber(params.mddMarkdown ?? "", 3) || params.mddMarkdown || "";
  const mddEntities = extractEntities(section3);
  const inventoryEntities = new Set<string>([
    ...(params.inventory?.suggestedEntities ?? []),
    ...(params.inventory?.crudMatrix ?? []).map((r) => r.entity),
  ]);
  const allEntities = new Set([...mddEntities, ...inventoryEntities]);
  const endpoints = extractHttpEndpointsFromMarkdown(params.apiContractsMarkdown ?? "");
  const crudByEntity = new Map(
    (params.inventory?.crudMatrix ?? []).map((r) => [r.entity.toLowerCase(), r]),
  );

  const rows: EntityApiTraceRow[] = [];
  const gaps: string[] = [];

  for (const entity of [...allEntities].sort()) {
    const inMdd = mddEntities.has(entity);
    const inInventory = inventoryEntities.has(entity);
    const crud = crudByEntity.get(entity.toLowerCase());
    const matchedEndpoints = endpointsForEntity(entity, endpoints, crud?.endpointHint);
    let gap: string | undefined;

    if (inInventory && !inMdd) {
      gap = "entidad inventario/DBGA ausente en MDD §3";
    } else if (inMdd && matchedEndpoints.length === 0 && !crud?.infraOnly) {
      gap = "tabla §3 sin endpoint API trazable";
    }

    if (gap) gaps.push(`${entity}: ${gap}`);

    rows.push({
      entity,
      inMdd,
      inInventory,
      endpointHint: crud?.endpointHint,
      matchedEndpoints,
      gap,
    });
  }

  const domainRows = rows.filter((r) => !r.gap || r.inMdd);
  const withApi = domainRows.filter((r) => r.inMdd && (r.matchedEndpoints.length > 0 || crudByEntity.get(r.entity.toLowerCase())?.infraOnly));
  const coverageRatio =
    domainRows.filter((r) => r.inMdd).length === 0
      ? 1
      : withApi.length / domainRows.filter((r) => r.inMdd).length;

  return { rows, gaps, coverageRatio };
}

export function formatEntityApiTraceGaps(report: EntityApiTraceReport, limit = 12): string[] {
  return report.gaps.slice(0, limit).map((g) => `[Trazabilidad] ${g}`);
}
