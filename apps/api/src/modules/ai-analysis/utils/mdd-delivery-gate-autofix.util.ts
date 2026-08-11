/**
 * Autofix determinista para blockers del delivery gate (Paso 0 / Mermaid / stubs §3).
 * Evita re-enrutar al SoftwareArchitect cuando la reparación es mecánica.
 */

import type { Paso0DecisionCatalog } from "@theforge/shared-types";
import type { DomainInventory } from "@theforge/shared-types";
import { fixBareMermaidFences } from "../../engine/mdd-quality-audit.util.js";
import { mergeDomainTablesIntoMdd } from "../../engine/compose-section3-from-inventory.util.js";
import { regenerateErDiagramFromSql } from "./mdd-diagram-suggestions.js";
import {
  enforcePaso0CatalogOnMdd,
  collectMissingPaso0CanonicalTables,
  repairAndInjectPaso0Section3ForGate,
  sanitizePaso0SsoContradictionsInMdd,
  sanitizePaso0StranglerFigInMdd,
  areRecoverablePersistGateAutofixBlockers,
  areOnlyStranglerFigPaso0Blockers,
} from "../../engine/mdd-paso0-enforcement.util.js";
import { applyPaso0TailSectionEnrichment } from "../../engine/mdd-paso0-trazabilidad.util.js";
import { applyPreDeliveryGateFixes } from "./mdd-sanitize.js";
import { deduplicateCanonicalMddSections } from "./mdd-sanitize/section-merge.js";
import { preserveValidatedSectionsIfSubstantial } from "./mdd-section-preserve.util.js";

const DETERMINISTIC_BLOCKER_RES: readonly RegExp[] = [
  /flowchart\s+suelto|sin\s+```mermaid/i,
  /CREATE TABLE\s+`outbox`/i,
  /Entidad canónica obligatoria ausente.*`outbox`/i,
  /Entidad canónica obligatoria ausente.*`messages`/i,
  /Entidad canónica obligatoria ausente.*`business_events`/i,
  /Familia de rutas MVP crítica ausente.*ingest/i,
  /Familia de rutas MVP crítica ausente.*Ingesta/i,
  /Familia de rutas MVP recomendada ausente/i,
  /Sección Trazabilidad ausente/i,
  /\[Paso 0 §9\]/i,
  /Ruta API prohibida.*\/auth\//i,
  /Endpoint \(coherence auto\).*prohibid/i,
  /Endpoint \(coherence auto\).*(?:`request`|entidad `request`)/i,
  /Endpoint \(coherence auto\).*requests/i,
  /`\/events`/i,
  /SQL con error de sintaxis|CREATE INDEX embebido|CREATE INDEX duplicados/i,
  /secciones duplicadas|repite headings canónicos/i,
  /Patrones de auth local.*D-003/i,
  /Strangler Fig documentado/i,
  /\[Paso 0 §6\]/i,
  /§6 incompleto o con placeholders/i,
  /JSON corrupto|```json inválido/i,
  /EC-\d+/i,
];

/** True si el blocker puede resolverse sin LLM (stubs, fences, Paso 0 enforcement). */
export function isDeterministicDeliveryGateBlocker(blocker: string): boolean {
  const text = (blocker ?? "").trim();
  if (!text) return false;
  if (/^\[Paso 0/i.test(text)) return true;
  return DETERMINISTIC_BLOCKER_RES.some((re) => re.test(text));
}

/** Cuenta cuántas veces apareció el mismo blocker en intentos previos (circuit breaker). */
export function countRepeatedDeterministicBlockers(
  blockers: string[],
  previousFingerprints: readonly string[] | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of blockers) {
    if (!isDeterministicDeliveryGateBlocker(b)) continue;
    const key = b.replace(/\s+/g, " ").trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (previousFingerprints?.length) {
    for (const fp of previousFingerprints) {
      for (const part of fp.split("||")) {
        if (!part) continue;
        counts.set(part, (counts.get(part) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export function fingerprintDeterministicBlockers(blockers: string[]): string {
  return blockers
    .filter((b) => isDeterministicDeliveryGateBlocker(b))
    .map((b) => b.replace(/\s+/g, " ").trim().toLowerCase())
    .sort()
    .join("||");
}

export type DeterministicGateAutofixResult = {
  markdown: string;
  applied: string[];
};

/**
 * Reparación mecánica pre-loop: Mermaid fences, stubs §3, rutas Paso 0, coherence auto prohibido.
 */
export function applyDeterministicDeliveryGateAutofixes(
  mddMarkdown: string,
  params?: {
    paso0Catalog?: Paso0DecisionCatalog | null;
    inventory?: DomainInventory | null;
  },
): DeterministicGateAutofixResult {
  const applied: string[] = [];
  let markdown = (mddMarkdown ?? "").trim();
  if (!markdown) return { markdown, applied };

  const bareMermaid = fixBareMermaidFences(markdown);
  if (bareMermaid !== markdown) {
    markdown = bareMermaid;
    applied.push("mermaid-fences");
  }

  markdown = applyPreDeliveryGateFixes(markdown);

  if (params?.paso0Catalog) {
    const section3Repair = repairAndInjectPaso0Section3ForGate(markdown, params.paso0Catalog);
    if (section3Repair.applied.length > 0) {
      markdown = section3Repair.markdown;
      applied.push(...section3Repair.applied);
      if (section3Repair.applied.some((a) => a.startsWith("§3-stubs") || a === "§3-sql-repair" || a === "§3-canonical-replace")) {
        const erRegen = regenerateErDiagramFromSql(markdown, { paso0Catalog: params.paso0Catalog });
        if (erRegen && erRegen !== markdown) {
          markdown = erRegen;
          applied.push("§3-er-regen");
        }
      }
    }
    if (params.inventory) {
      const missingBefore = collectMissingPaso0CanonicalTables(markdown, params.paso0Catalog);
      if (missingBefore.length > 0) {
        const merged = mergeDomainTablesIntoMdd(markdown, params.inventory, params.paso0Catalog);
        if (merged.injected.length > 0) {
          markdown = merged.markdown;
          applied.push(`§3-inventory-stubs:${merged.injected.join(",")}`);
        }
      }
    }
    const paso0 = enforcePaso0CatalogOnMdd(markdown, params.paso0Catalog);
    if (paso0.markdown !== markdown) {
      markdown = paso0.markdown;
      if (paso0.strippedTables.length > 0) applied.push(`paso0-strip-§3:${paso0.strippedTables.length}`);
      if (paso0.section4StrippedRoutes.length > 0) {
        applied.push(`paso0-strip-§4:${paso0.section4StrippedRoutes.length}`);
      }
      if (paso0.paso0RoutesInjected.length > 0) {
        applied.push(`paso0-inject-routes:${paso0.paso0RoutesInjected.join(",")}`);
      }
    }
    const strangler = sanitizePaso0StranglerFigInMdd(markdown, params.paso0Catalog);
    if (strangler.markdown !== markdown) {
      markdown = strangler.markdown;
      applied.push("paso0-strangler-sanitize");
    }
    const ssoSanitized = sanitizePaso0SsoContradictionsInMdd(markdown, params.paso0Catalog);
    if (ssoSanitized.markdown !== markdown) {
      markdown = ssoSanitized.markdown;
      applied.push("paso0-sso-sanitize");
    }
    const tail = applyPaso0TailSectionEnrichment(markdown, params.paso0Catalog);
    if (tail.applied.length > 0) {
      markdown = tail.markdown;
      applied.push(...tail.applied.map((a) => `paso0-tail:${a}`));
    }
  }

  return { markdown, applied };
}

export type PersistGateAutofixParams = {
  paso0Catalog?: Paso0DecisionCatalog | null;
  inventory?: DomainInventory | null;
  /** Borrador pre-prepare para restaurar §5/§6/§7 tras reparación mecánica. */
  baseline?: string | null;
  /** Snapshot Clarifier para restaurar §1 sustancial sin truncar a stamp mínimo. */
  clarifierSnapshot?: string | null;
};

/**
 * Autofix persist gate: dedupe canónico §1–§7, §3 SQL/Paso 0 y restore acotado desde baseline.
 * Usar en el loop de MddUpdatePipelineService (máx. 2 reintentos).
 */
export function applyPersistDeliveryGateAutofixes(
  mddMarkdown: string,
  params?: PersistGateAutofixParams,
): DeterministicGateAutofixResult {
  const applied: string[] = [];
  let markdown = (mddMarkdown ?? "").trim();
  if (!markdown) return { markdown, applied };

  const deduped = deduplicateCanonicalMddSections(markdown);
  if (deduped !== markdown) {
    markdown = deduped;
    applied.push("canonical-dedupe");
  }

  const deterministic = applyDeterministicDeliveryGateAutofixes(markdown, params);
  markdown = deterministic.markdown;
  applied.push(...deterministic.applied);

  const baseline = (params?.baseline ?? "").trim();
  if (baseline) {
    const preserved = preserveValidatedSectionsIfSubstantial(baseline, markdown, {
      excludeSections: [3, 4],
      clarifierSnapshot: params?.clarifierSnapshot,
    });
    if (preserved !== markdown) {
      markdown = preserved;
      applied.push("preserve-tail-sections");
    }
    const postPreserveDedupe = deduplicateCanonicalMddSections(markdown);
    if (postPreserveDedupe !== markdown) {
      markdown = postPreserveDedupe;
      applied.push("canonical-dedupe-post-preserve");
    }
    if (params?.paso0Catalog) {
      const paso0Retry = applyDeterministicDeliveryGateAutofixes(markdown, params);
      if (paso0Retry.markdown !== markdown) {
        markdown = paso0Retry.markdown;
        applied.push(...paso0Retry.applied.map((a) => `retry:${a}`));
      }
    }
  }

  return { markdown, applied };
}

export { areRecoverablePersistGateAutofixBlockers, areOnlyStranglerFigPaso0Blockers };

/** True si todos los blockers son deterministas y ya se repitieron ≥ maxAttempts. */
export function shouldCapDeterministicGateLoop(
  blockers: string[],
  attempt: number,
  maxAttempts = 2,
  previousFingerprint?: string,
): boolean {
  const items = blockers.filter((b) => b.trim().length > 0);
  if (items.length === 0) return false;
  if (areOnlyStranglerFigPaso0Blockers(items)) return true;
  if (!items.every((b) => isDeterministicDeliveryGateBlocker(b))) return false;
  const fp = fingerprintDeterministicBlockers(items);
  if (attempt >= maxAttempts) return true;
  return fp.length > 0 && fp === (previousFingerprint ?? "");
}
