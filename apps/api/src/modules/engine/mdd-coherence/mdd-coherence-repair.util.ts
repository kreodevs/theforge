/**
 * Reparación determinista de gaps §3↔§4 (endpoints mínimos para entidades huérfanas de negocio).
 */

import type { DomainInventory, Paso0DecisionCatalog } from "@theforge/shared-types";
import {
  PASO0_FORBIDDEN_ENTITY_TABLES,
  PASO0_INVENTED_PLATFORM_TABLES,
  PASO0_SSO_ALLOWED_AUTH_ROUTE_SEGMENTS,
  apiPathMatchesPaso0ForbiddenSegment,
  listPaso0ForbiddenApiRouteSegmentsForCatalog,
} from "@theforge/shared-types";
import {
  injectMissingJourneyEndpointsIntoMddSection4,
  type JourneyEndpointRequirement,
} from "../mdd-journey-section4.util.js";
import { findMddCoherenceOrphans } from "./mdd-coherence.util.js";
import { isExemptEntityTable, buildInfraOnlyEntitySet, FK_ONLY_CHILD_TABLES } from "./mdd-coherence-exemptions.util.js";

export type MddCoherenceRepairResult = {
  markdown: string;
  injected: string[];
};

/** Inyecta filas §4 GET mínimas para tablas de negocio sin endpoint enlazado. */
export function repairMddCoherenceSection4Gaps(
  mddMarkdown: string,
  options?: { inventory?: DomainInventory | null; paso0Catalog?: Paso0DecisionCatalog | null },
): MddCoherenceRepairResult {
  const infraOnly = buildInfraOnlyEntitySet(options?.inventory);
  const { orphanEntityBareNames } = findMddCoherenceOrphans(mddMarkdown, {
    inventory: options?.inventory,
  });

  const paso0SkipEntities = new Set<string>();
  const paso0ForbiddenRouteSegments = options?.paso0Catalog
    ? listPaso0ForbiddenApiRouteSegmentsForCatalog(options.paso0Catalog)
    : null;
  if (options?.paso0Catalog) {
    for (const table of PASO0_FORBIDDEN_ENTITY_TABLES) paso0SkipEntities.add(table.toLowerCase());
    for (const table of PASO0_INVENTED_PLATFORM_TABLES) paso0SkipEntities.add(table.toLowerCase());
  }

  const isPaso0ForbiddenCoherenceEntity = (bare: string, path: string): boolean => {
    if (!options?.paso0Catalog) return false;
    const normalized = bare.toLowerCase();
    if (paso0SkipEntities.has(normalized)) return true;
    const slugFromPath = path
      .match(/\/api\/v1\/([^/`{]+)/i)?.[1]
      ?.replace(/-/g, "_")
      .toLowerCase();
    if (slugFromPath && paso0SkipEntities.has(slugFromPath)) return true;
    return Boolean(
      paso0ForbiddenRouteSegments &&
        apiPathMatchesPaso0ForbiddenSegment(path, paso0ForbiddenRouteSegments, {
          allowSegments: PASO0_SSO_ALLOWED_AUTH_ROUTE_SEGMENTS,
        }),
    );
  };

  const missing: JourneyEndpointRequirement[] = [];
  for (const bare of orphanEntityBareNames) {
    const base = bare.replace(/_/g, "-");
    const path = `/api/v1/${base}`;
    if (isPaso0ForbiddenCoherenceEntity(bare, path)) continue;
    if (isExemptEntityTable(bare, infraOnly)) continue;
    if (FK_ONLY_CHILD_TABLES.has(bare.toLowerCase())) continue;
    missing.push({
      id: `coherence-${bare}-list`,
      label: `${bare} (coherence auto)`,
      method: "GET",
      path,
      triggerEntity: bare,
    });
  }

  if (missing.length === 0) {
    return { markdown: mddMarkdown, injected: [] };
  }

  const { markdown, injected } = injectMissingJourneyEndpointsIntoMddSection4(mddMarkdown, missing);
  return { markdown, injected };
}
