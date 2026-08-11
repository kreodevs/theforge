/**
 * @fileoverview Composición de preámbulo BRD To-Be para MDD.
 */

import { peelDocumentBodyForPersist, formatPaso0CatalogGuardBlock, formatPaso0ArchitectMandatoryBlock, catalogRequiresStackAsProposal, type Paso0DecisionCatalog } from "@theforge/shared-types";
import { formatPaso0CatalogSummaryBlock } from "../phase0/paso0-pasted-definitive.util.js";

/**
 * Composición de preámbulo BRD para anteponer al Benchmark/MDD si hay BRD presente.
 */

function composePaso0CatalogPreamble(catalog: Paso0DecisionCatalog): string {
  const summary = formatPaso0CatalogSummaryBlock(catalog, 16_000);
  const guard = formatPaso0CatalogGuardBlock(catalog, 6_000);
  const architect = formatPaso0ArchitectMandatoryBlock(catalog, 4_000);
  const stackNote = catalogRequiresStackAsProposal(catalog)
    ? "D-162 y filas Propuesta: §2 Arquitectura y §7 Infraestructura documentan stack como **PROPUESTA**, no requisito fijo."
    : "";
  return (
    "## Contexto — Paso 0 definitivo (decisiones D-ID)\n\n" +
    summary +
    "\n\n---\n\n" +
    architect +
    "\n\n---\n\n" +
    guard +
    "\n\n---\n\n" +
    "**Instrucción:** El MDD debe respetar fidelidad a las decisiones D-ID del Paso 0 pegado; " +
    "no inventes entidades, tablas ni capacidades fuera del catálogo. " +
    "Genera §3 con todas las tablas canónicas y §4 con familias MVP (ingest/events, attachments, break-glass, ws, migration). " +
    "Usa solo el lenguaje ubicuo §5.1 (Application, Context, Topic, Membership, etc.). " +
    (stackNote ? `${stackNote}\n\n` : "")
  );
}

/** Bloque markdown para anteponer al Benchmark/MDD si hay BRD o catálogo Paso 0 pegado. */
export function composeBrdPreamble(
  brdContent: string | null | undefined,
  paso0Catalog?: Paso0DecisionCatalog | null,
): string {
  const brd = peelDocumentBodyForPersist((brdContent ?? "").trim());
  if (brd.length >= 40) {
    return (
      "## Contexto — BRD (negocio, KPIs, alcance)\n\n" +
      brd.slice(0, 24_000) +
      "\n\n---\n\n" +
      "**Instrucción:** El MDD debe trazarse al BRD; no contradigas el BRD salvo que el Benchmark aporte matices explícitos.\n\n"
    );
  }
  if (paso0Catalog && paso0Catalog.decisions.length > 0) {
    return composePaso0CatalogPreamble(paso0Catalog);
  }
  return "";
}
