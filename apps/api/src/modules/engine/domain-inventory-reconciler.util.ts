/**
 * Reconciliador de inventario de dominio + stubs §4 para entidades sin endpoint API.
 */

import type { DomainInventory } from "@theforge/shared-types";
import { mergeDomainTablesIntoMdd, mergeDbgaCoreGapsIntoMdd } from "./compose-section3-from-inventory.util.js";
import {
  injectMissingJourneyEndpointsIntoMddSection4,
} from "./mdd-journey-section4.util.js";
import { buildEntityApiTraceReport } from "./entity-api-trace.util.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";
import { checkMddJourneySection4Gaps } from "./mdd-journey-section4.util.js";

function replaceSectionBody(md: string, sectionNum: number, newSectionBody: string): string {
  const re = /^##\s*(\d+)\.\s*[^\n]*/gim;
  const matches: { num: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    matches.push({ num: parseInt(m[1]!, 10), index: m.index });
  }
  const idx = matches.findIndex((x) => x.num === sectionNum);
  if (idx === -1) return `${md.trim()}\n\n${newSectionBody.trim()}\n`;
  const start = matches[idx]!.index;
  const end = matches[idx + 1]?.index ?? md.length;
  return `${md.slice(0, start)}${newSectionBody.trim()}\n${md.slice(end)}`.trim();
}

export type DomainInventoryReconcileResult = {
  markdown: string;
  section3Injected: string[];
  section4Injected: string[];
  remainingTraceGaps: string[];
};

/** Fusiona inventario/DBGA en §3 e inyecta endpoints §4 faltantes para trazabilidad entity→API. */
export function reconcileDomainInventoryIntoMdd(
  mddMarkdown: string,
  params: {
    brdMarkdown?: string | null;
    dbgaMarkdown?: string | null;
    inventory?: DomainInventory | null;
  },
): DomainInventoryReconcileResult {
  let markdown = mddMarkdown ?? "";
  const section3Injected: string[] = [];

  const dbgaCore = mergeDbgaCoreGapsIntoMdd(markdown, {
    dbgaMarkdown: params.dbgaMarkdown,
    brdMarkdown: params.brdMarkdown,
  });
  markdown = dbgaCore.markdown;
  section3Injected.push(...dbgaCore.injected);

  if (params.inventory) {
    const domain = mergeDomainTablesIntoMdd(markdown, params.inventory);
    markdown = domain.markdown;
    section3Injected.push(...domain.injected);
  }

  const section4Report = checkMddJourneySection4Gaps({
    mddMarkdown: markdown,
    inventory: params.inventory ?? undefined,
  });
  const section4Repair = injectMissingJourneyEndpointsIntoMddSection4(
    markdown,
    section4Report.missing,
  );
  markdown = section4Repair.markdown;

  const trace = buildEntityApiTraceReport({
    mddMarkdown: markdown,
    inventory: params.inventory,
    apiContractsMarkdown: null,
  });

  const remainingTraceGaps = trace.gaps.slice(0, 12);

  return {
    markdown,
    section3Injected,
    section4Injected: section4Repair.injected,
    remainingTraceGaps,
  };
}

/** Stubs mínimos §4 para entidades §3 sin endpoint (pre-generación API). */
export function buildEntityApiStubBlock(entity: string): string {
  const base = entity.replace(/_/g, "-");
  return [
    `### ${entity} (auto-stub trazabilidad)`,
    `- GET /api/v1/${base}`,
    `- POST /api/v1/${base}`,
    `- GET /api/v1/${base}/:id`,
    `- PUT /api/v1/${base}/:id`,
    `- DELETE /api/v1/${base}/:id`,
  ].join("\n");
}

export function injectEntityApiStubsIntoMddSection4(
  mddMarkdown: string,
  entities: string[],
): { markdown: string; injected: string[] } {
  if (entities.length === 0) return { markdown: mddMarkdown, injected: [] };
  let s4 = extractSectionByNumber(mddMarkdown, 4) || "## 4. Contratos de API\n";
  const injected: string[] = [];
  for (const entity of entities.slice(0, 8)) {
    const block = buildEntityApiStubBlock(entity);
    if (s4.includes(`/api/v1/${entity.replace(/_/g, "-")}`)) continue;
    s4 = `${s4.trim()}\n\n${block}\n`;
    injected.push(entity);
  }
  if (injected.length === 0) return { markdown: mddMarkdown, injected: [] };
  return {
    markdown: replaceSectionBody(mddMarkdown, 4, s4),
    injected,
  };
}
