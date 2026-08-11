/**
 * Reparación determinista MDD SSOT pre-gate: §3 DBGA core, UAT, §4 journeys, tablas plataforma.
 */

import type { DomainInventory } from "@theforge/shared-types";
import type { Paso0DecisionCatalog } from "@theforge/shared-types";
import {
  checkBrdMddUatConformance,
  injectMissingUatScenariosIntoMdd,
} from "./brd-mdd-uat-conformance.util.js";
import {
  checkMddJourneySection4Gaps,
  injectMissingJourneyEndpointsIntoMddSection4,
} from "./mdd-journey-section4.util.js";
import { annotateJustifiedPlatformTablesInMdd } from "./platform-table-justify.util.js";
import { stripUnjustifiedPlatformTablesFromMdd } from "./mdd-platform-table-strip.util.js";
import { rebuildDomainInventoryPreferringBrd } from "./domain-inventory-persist.util.js";
import {
  mergeDbgaCoreGapsIntoMdd,
  mergeDomainTablesIntoMdd,
} from "./compose-section3-from-inventory.util.js";
import { collectDomainInventoryConformanceGaps } from "./domain-inventory-conformance.util.js";
import { enforcePaso0CatalogOnMdd, collectMissingPaso0CanonicalTables, repairAndInjectPaso0Section3ForGate } from "./mdd-paso0-enforcement.util.js";
import { repairMddCoherenceSection4Gaps } from "./mdd-coherence/mdd-coherence-repair.util.js";
import { fixSecurityManifestCoherence } from "../ai-analysis/utils/mdd-sanitize/security-manifest.js";
import {
  ensureSecurityLockoutInSection6,
  ensureSecurityTableStubsFromSection6,
} from "../ai-analysis/utils/mdd-sanitize/cross-consistency.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

const PASO0_MISSING_SKIP_THRESHOLD = 10;
const SECTION4_SHRINK_SKIP_RATIO = 0.5;

function section4BodyLen(markdown: string): number {
  const section4 = extractSectionByNumber(markdown, 4) ?? "";
  return section4.replace(/^##[^\n]+\n?/, "").trim().length;
}

/** Evita SSOT repair destructivo cuando el borrador ya pierde mucho Paso 0 o §4. */
export function shouldSkipDestructiveSsotRepair(
  baselineMarkdown: string,
  paso0Catalog?: Paso0DecisionCatalog | null,
): { skip: boolean; reason?: string } {
  if (!paso0Catalog) return { skip: false };
  const missing = collectMissingPaso0CanonicalTables(baselineMarkdown, paso0Catalog);
  if (missing.length > PASO0_MISSING_SKIP_THRESHOLD) {
    return {
      skip: true,
      reason: `paso0Missing=${missing.length} (>${PASO0_MISSING_SKIP_THRESHOLD})`,
    };
  }
  return { skip: false };
}

function restoreSection4IfRegressed(baseline: string, candidate: string): string {
  const before = section4BodyLen(baseline);
  const after = section4BodyLen(candidate);
  if (before < 800 || after >= before * SECTION4_SHRINK_SKIP_RATIO) return candidate;
  const section4 = extractSectionByNumber(baseline, 4);
  if (!section4) return candidate;
  const body = section4.replace(/^##[^\n]+\n?/, "").trim();
  const heading = section4.match(/^##[^\n]+/)?.[0] ?? "## 4. Contratos de API";
  const rebuilt = `${heading}\n\n${body.trim()}\n`;
  console.warn(
    `[MDD:SSOT] §4 restaurada tras repair regresivo (len ${after}→${before}, ratio=${(after / before).toFixed(2)})`,
  );
  return candidate.replace(section4, rebuilt);
}

export type MddSsotRepairResult = {
  markdown: string;
  section3Injected: string[];
  uatInjected: string[];
  section4Injected: string[];
  platformAnnotated: string[];
  platformStripped: string[];
  paso0Stripped: string[];
  paso0StrippedRoutes: string[];
  paso0MissingCanonical: string[];
  paso0Gaps: string[];
  remainingGaps: string[];
};

export function reconcileMddSsotBeforeDeliveryGate(
  mddMarkdown: string,
  params: {
    brdMarkdown?: string | null;
    dbgaMarkdown?: string | null;
    specMarkdown?: string | null;
    inventory?: DomainInventory | null;
    paso0Catalog?: Paso0DecisionCatalog | null;
  },
): MddSsotRepairResult {
  const baselineMarkdown = mddMarkdown ?? "";
  const destructiveGuard = shouldSkipDestructiveSsotRepair(baselineMarkdown, params.paso0Catalog);
  const skipDestructiveStrip = destructiveGuard.skip;
  if (skipDestructiveStrip) {
    console.warn(`[MDD:SSOT] strip plataforma omitido — ${destructiveGuard.reason}`);
  }

  const inventory =
    params.inventory ??
    (params.brdMarkdown?.trim() || params.dbgaMarkdown?.trim() || params.paso0Catalog
      ? rebuildDomainInventoryPreferringBrd({
          brdMarkdown: params.brdMarkdown,
          dbgaMarkdown: params.dbgaMarkdown,
          mddMarkdown,
          paso0Catalog: params.paso0Catalog,
        })
      : null);

  let markdown = mddMarkdown ?? "";
  const section3Injected: string[] = [];
  const paso0Stripped: string[] = [];
  const paso0StrippedRoutes: string[] = [];
  const paso0MissingCanonical: string[] = [];
  let paso0Gaps: string[] = [];

  const accumulatePaso0Enforcement = (
    result: ReturnType<typeof enforcePaso0CatalogOnMdd>,
  ): void => {
    for (const table of result.strippedTables) {
      if (!paso0Stripped.includes(table)) paso0Stripped.push(table);
    }
    for (const route of result.section4StrippedRoutes) {
      if (!paso0StrippedRoutes.includes(route)) paso0StrippedRoutes.push(route);
    }
    for (const entity of result.missingCanonical) {
      if (!paso0MissingCanonical.includes(entity)) paso0MissingCanonical.push(entity);
    }
    paso0Gaps = [...paso0Gaps, ...result.gaps];
  };

  if (params.paso0Catalog) {
    const section3Repair = repairAndInjectPaso0Section3ForGate(markdown, params.paso0Catalog);
    if (section3Repair.applied.length > 0) {
      markdown = section3Repair.markdown;
    }
    const paso0First = enforcePaso0CatalogOnMdd(markdown, params.paso0Catalog);
    markdown = paso0First.markdown;
    accumulatePaso0Enforcement(paso0First);
  }

  if (!params.paso0Catalog) {
    const dbgaCore = mergeDbgaCoreGapsIntoMdd(markdown, {
      dbgaMarkdown: params.dbgaMarkdown,
      brdMarkdown: params.brdMarkdown,
    });
    markdown = dbgaCore.markdown;
    section3Injected.push(...dbgaCore.injected);
  }

  if (inventory) {
    const domain = mergeDomainTablesIntoMdd(markdown, inventory, params.paso0Catalog);
    markdown = domain.markdown;
    section3Injected.push(...domain.injected);
  }

  const strippedFirst = skipDestructiveStrip
    ? { markdown, stripped: [] as string[] }
    : stripUnjustifiedPlatformTablesFromMdd(markdown, {
        brdMarkdown: params.brdMarkdown,
        dbgaMarkdown: params.dbgaMarkdown,
        specMarkdown: params.specMarkdown,
        inventory: inventory ?? undefined,
        paso0Catalog: params.paso0Catalog,
      });
  markdown = strippedFirst.markdown;
  const platformStripped: string[] = [...strippedFirst.stripped];

  const platform = skipDestructiveStrip
    ? { markdown, annotated: [] as string[] }
    : annotateJustifiedPlatformTablesInMdd(markdown, {
    brdMarkdown: params.brdMarkdown,
    dbgaMarkdown: params.dbgaMarkdown,
    specMarkdown: params.specMarkdown,
    inventory: inventory ?? undefined,
    paso0Catalog: params.paso0Catalog,
  });
  markdown = platform.markdown;

  const uatReport = checkBrdMddUatConformance({
    brdMarkdown: params.brdMarkdown,
    mddMarkdown: markdown,
  });
  const uatRepair = injectMissingUatScenariosIntoMdd(markdown, uatReport.missingInMdd);
  markdown = uatRepair.markdown;

  const section4Report = checkMddJourneySection4Gaps({
    mddMarkdown: markdown,
    inventory: inventory ?? undefined,
    brdMarkdown: params.brdMarkdown,
    dbgaMarkdown: params.dbgaMarkdown,
  });
  const section4Repair = injectMissingJourneyEndpointsIntoMddSection4(
    markdown,
    section4Report.missing,
  );
  markdown = section4Repair.markdown;
  const section4Injected: string[] = [...section4Repair.injected];

  const finalStrip = skipDestructiveStrip
    ? { markdown, stripped: [] as string[] }
    : stripUnjustifiedPlatformTablesFromMdd(markdown, {
        brdMarkdown: params.brdMarkdown,
        dbgaMarkdown: params.dbgaMarkdown,
        specMarkdown: params.specMarkdown,
        inventory: inventory ?? undefined,
        paso0Catalog: params.paso0Catalog,
      });
  markdown = finalStrip.markdown;
  for (const table of finalStrip.stripped) {
    if (!platformStripped.includes(table)) platformStripped.push(table);
  }

  if (params.paso0Catalog) {
    const coherence = skipDestructiveStrip
      ? { markdown, injected: [] as string[] }
      : repairMddCoherenceSection4Gaps(markdown, {
          inventory: inventory ?? undefined,
          paso0Catalog: params.paso0Catalog,
        });
    if (coherence.injected.length > 0) {
      markdown = coherence.markdown;
      section4Injected.push(...coherence.injected);
    }

    const paso0Final = enforcePaso0CatalogOnMdd(markdown, params.paso0Catalog);
    markdown = paso0Final.markdown;
    accumulatePaso0Enforcement(paso0Final);

    markdown = fixSecurityManifestCoherence(markdown, { paso0Catalog: params.paso0Catalog });
    markdown = ensureSecurityTableStubsFromSection6(markdown, {
      paso0Catalog: params.paso0Catalog,
    });
    markdown = ensureSecurityLockoutInSection6(markdown, {
      paso0Catalog: params.paso0Catalog,
    });
  }

  const invAfter = collectDomainInventoryConformanceGaps({
    brdMarkdown: params.brdMarkdown,
    dbgaMarkdown: params.dbgaMarkdown,
    mddMarkdown: markdown,
    specMarkdown: params.specMarkdown,
    inventory: inventory ?? undefined,
    paso0Catalog: params.paso0Catalog,
  });
  const uatAfter = checkBrdMddUatConformance({
    brdMarkdown: params.brdMarkdown,
    mddMarkdown: markdown,
  });
  const section4After = checkMddJourneySection4Gaps({
    mddMarkdown: markdown,
    inventory: inventory ?? undefined,
    brdMarkdown: params.brdMarkdown,
    dbgaMarkdown: params.dbgaMarkdown,
  });

  markdown = restoreSection4IfRegressed(baselineMarkdown, markdown);

  if (params.paso0Catalog) {
    const stubFinal = repairAndInjectPaso0Section3ForGate(markdown, params.paso0Catalog);
    if (stubFinal.applied.length > 0) {
      markdown = stubFinal.markdown;
    }
    const paso0PostStub = enforcePaso0CatalogOnMdd(markdown, params.paso0Catalog);
    markdown = paso0PostStub.markdown;
    accumulatePaso0Enforcement(paso0PostStub);
  }

  return {
    markdown,
    section3Injected,
    uatInjected: uatRepair.injected,
    section4Injected,
    platformAnnotated: platform.annotated,
    platformStripped,
    paso0Stripped,
    paso0StrippedRoutes,
    paso0MissingCanonical,
    paso0Gaps: [...new Set(paso0Gaps)],
    remainingGaps: [...invAfter.gaps, ...uatAfter.gaps, ...section4After.gaps, ...paso0Gaps],
  };
}

export function collectMddSsotGateGaps(params: {
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown: string;
  inventory?: DomainInventory | null;
}): string[] {
  const uat = checkBrdMddUatConformance(params);
  const section4 = checkMddJourneySection4Gaps({
    mddMarkdown: params.mddMarkdown,
    inventory: params.inventory,
    brdMarkdown: params.brdMarkdown,
    dbgaMarkdown: params.dbgaMarkdown,
  });
  return [...uat.gaps, ...section4.gaps];
}
