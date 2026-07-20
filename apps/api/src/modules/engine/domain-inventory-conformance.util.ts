/**
 * Conformance inventario ↔ MDD §3: entidades DBGA faltantes y tablas plataforma sin BRD/DBGA.
 */

import {
  AUTH_ENTITY_FAMILY,
  DBGA_CORE_ENTITIES,
  type DomainInventory,
} from "@theforge/shared-types";
import { extractEntities } from "./conformance.service.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";
import { extractDbgaCanonicalEntities } from "./domain-inventory.util.js";
import {
  isPlatformTableJustified,
  listUnjustifiedPlatformTables,
} from "./platform-table-justify.util.js";

export type DomainInventoryConformanceReport = {
  missingDbgaCoreInMdd: string[];
  platformTablesWithoutJustification: string[];
  gaps: string[];
};

/** Entidades núcleo DBGA ausentes en MDD §3. */
export function checkMissingDbgaCoreEntitiesInMdd(params: {
  dbgaMarkdown?: string | null;
  mddMarkdown: string;
}): string[] {
  const section3 = extractSectionByNumber(params.mddMarkdown ?? "", 3) || params.mddMarkdown || "";
  const mddEntities = extractEntities(section3);
  const dbgaCanonical = extractDbgaCanonicalEntities(params.dbgaMarkdown ?? "");
  const required = new Set([
    ...DBGA_CORE_ENTITIES,
    ...dbgaCanonical.filter((e) => !AUTH_ENTITY_FAMILY.has(e) || e === "users"),
  ]);
  return [...required].filter((e) => !mddEntities.has(e));
}

/** Tablas plataforma en §3 sin ancla en BRD/DBGA/MDD §1 — deben eliminarse o documentarse. */
export function checkPlatformTablesOutsideBrd(params: {
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown: string;
  specMarkdown?: string | null;
  inventory?: DomainInventory | null;
}): string[] {
  return listUnjustifiedPlatformTables(params);
}

export function collectDomainInventoryConformanceGaps(params: {
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown: string;
  specMarkdown?: string | null;
  inventory?: DomainInventory | null;
}): DomainInventoryConformanceReport {
  const missingDbgaCoreInMdd = checkMissingDbgaCoreEntitiesInMdd({
    dbgaMarkdown: params.dbgaMarkdown,
    mddMarkdown: params.mddMarkdown,
  });
  const platformTablesWithoutJustification = checkPlatformTablesOutsideBrd(params);

  const gaps: string[] = [];
  if (missingDbgaCoreInMdd.length > 0) {
    gaps.push(
      `[MDD §3] Entidades DBGA faltantes (${missingDbgaCoreInMdd.length}): ${missingDbgaCoreInMdd.join(", ")} — regenerar §3 o expandir stubs del inventario.`,
    );
  }
  for (const table of platformTablesWithoutJustification) {
    gaps.push(
      `[MDD §3] Tabla plataforma "${table}" sin ancla BRD/DBGA — eliminar de §3 o documentar en Fuera de alcance / decision log.`,
    );
  }

  const inventoryMissing = params.inventory?.suggestedEntities?.filter((e) => {
    const section3 = extractSectionByNumber(params.mddMarkdown ?? "", 3) || params.mddMarkdown || "";
    return !extractEntities(section3).has(e) && !AUTH_ENTITY_FAMILY.has(e);
  }) ?? [];
  if (inventoryMissing.length > 0 && missingDbgaCoreInMdd.length === 0) {
    gaps.push(
      `[Inventario] Entidades sugeridas ausentes en §3: ${inventoryMissing.slice(0, 8).join(", ")}${inventoryMissing.length > 8 ? "…" : ""}`,
    );
  }

  return { missingDbgaCoreInMdd, platformTablesWithoutJustification, gaps };
}

export function formatDomainInventoryConformanceGaps(report: DomainInventoryConformanceReport, limit = 12): string[] {
  return report.gaps.slice(0, limit);
}

// Re-export for tests
export { isPlatformTableJustified };
