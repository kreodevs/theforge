/**
 * @fileoverview Nodo auditor — evalúa calidad de documentación y gaps en el pipeline.
 */

/**
 * Contexto enriquecido para el Auditor MDD (LLM): BRD, tablas plataforma, pistas de alucinación.
 * Las pistas orientan al agente; el veredicto final es del LLM, no de reglas heurísticas de score.
 */

import type { MDDStateType } from "../state/index.js";
import { collectDomainInventoryConformanceGaps } from "../../engine/domain-inventory-conformance.util.js";
import { listUnjustifiedPlatformTables } from "../../engine/platform-table-justify.util.js";
import { buildInventoryFromMddState } from "./mdd-domain-prompt.util.js";
import { formatPaso0CatalogSummaryBlock } from "../phase0/paso0-pasted-definitive.util.js";
import { collectMissingPaso0CanonicalTables, enforcePaso0CatalogOnMdd } from "../../engine/mdd-paso0-enforcement.util.js";
import { PLATFORM_ORPHAN_TABLES } from "@theforge/shared-types";

const BRD_EXCERPT_MAX = 6_000;
const DBGA_EXCERPT_MAX = 4_000;
const PASO0_CATALOG_EXCERPT_MAX = 8_000;

function excerpt(text: string | undefined | null, max: number): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[... documento truncado para auditoría ...]`;
}

/** Bloque markdown con BRD/DBGA y checklist de alucinaciones para el prompt del Auditor. */
export function buildMddAuditorDeepContext(state: MDDStateType): string {
  const mdd = (state.mddDraft ?? "").trim();
  const brd = state.brdContent?.trim() || buildInventoryFromMddState(state).brd;
  const dbga = state.dbgaContent?.trim() ?? "";
  if (!mdd) return "";

  const { inventory } = buildInventoryFromMddState(state);

  const platformOrphans = listUnjustifiedPlatformTables({
    brdMarkdown: brd || null,
    dbgaMarkdown: dbga || null,
    mddMarkdown: mdd,
    inventory,
  });

  const inventoryGaps = collectDomainInventoryConformanceGaps({
    brdMarkdown: brd || null,
    dbgaMarkdown: dbga || null,
    mddMarkdown: mdd,
    inventory,
    paso0Catalog: state.paso0DecisionCatalog ?? null,
  });

  const paso0Preview = state.paso0DecisionCatalog
    ? enforcePaso0CatalogOnMdd(mdd, state.paso0DecisionCatalog)
    : null;
  const paso0Missing = state.paso0DecisionCatalog
    ? collectMissingPaso0CanonicalTables(mdd, state.paso0DecisionCatalog)
    : [];

  const parts: string[] = [
    "\n---\n## Contexto de auditoría profunda (verificar con criterio de agente)\n",
    "**Tu veredicto es autoritativo.** Usa las herramientas y este contexto para detectar gaps y alucinaciones.",
    "No apruebes score ≥85 si encuentras tablas inventadas, capacidades BRD omitidas o contratos incoherentes.\n",
  ];

  if (brd) {
    parts.push(
      "### Extracto BRD (fidelidad §1/§4/§5)\n",
      "Comprueba que fórmulas, permisos, umbrales y capacidades de negocio del BRD aparezcan en §1, §4 o §5.",
      "Si el BRD define una regla de negocio y no hay trazabilidad en el MDD, es **critical_gap**.\n",
      excerpt(brd, BRD_EXCERPT_MAX),
    );
  } else {
    parts.push(
      "### BRD\n",
      "No se incluyó BRD en esta corrida. Aun así, revisa §3 por tablas que parezcan plataforma Workshop (chat/orquestación) sin dominio de negocio.\n",
    );
  }

  if (dbga) {
    parts.push("\n### Extracto DBGA\n", excerpt(dbga, DBGA_EXCERPT_MAX));
  }

  if (state.paso0DecisionCatalog) {
    parts.push(
      "\n### Catálogo decisiones Paso 0 (D-ID)\n",
      formatPaso0CatalogSummaryBlock(state.paso0DecisionCatalog, PASO0_CATALOG_EXCERPT_MAX),
      "\n**Verificar:** el MDD no debe introducir tenants/channels/conversations como raíz ni auth local (D-003). Stack D-162 = propuestas.\n",
    );
    if (paso0Missing.length > 0) {
      parts.push(
        "**Entidades canónicas ausentes en §3 (post-enforcement):**",
        paso0Missing.slice(0, 12).map((t) => `- \`${t}\``).join("\n"),
        "",
      );
    }
    if (paso0Preview && paso0Preview.localAuthWarnings.length > 0) {
      parts.push("**Auth local detectada (incompatible D-003):**", ...paso0Preview.localAuthWarnings.map((w) => `- ${w}`), "");
    }
    if (paso0Preview && paso0Preview.retentionWarnings.length > 0) {
      parts.push("**Retención posiblemente no alineada D-098:**", ...paso0Preview.retentionWarnings.map((w) => `- ${w}`), "");
    }
  }

  parts.push(
    "\n### Tablas plataforma (alucinaciones frecuentes)\n",
    `Familia a cuestionar si no hay ancla BRD/DBGA de mensajería, RAG o canal real: ${[...PLATFORM_ORPHAN_TABLES].join(", ")}.`,
    "El chat del Taller/orquestación **no** justifica `messages` ni `conversation_memory` en §3.",
    "Columnas genéricas (`payload_type`, `signal_unique_id`, outbox sin dominio) suelen ser alucinación: repórtalas.\n",
  );

  if (platformOrphans.length > 0) {
    parts.push(
      "**Candidatas a eliminar (sin ancla BRD/DBGA):**",
      platformOrphans.map((t) => `- \`${t}\``).join("\n"),
      "",
    );
  }

  const hintGaps = inventoryGaps.gaps.filter(
    (g) =>
      g.includes("Tabla plataforma") ||
      g.includes("DBGA faltantes") ||
      g.includes("[Inventario]") ||
      g.includes("[Paso 0"),
  );
  if (hintGaps.length > 0) {
    parts.push(
      "### Pistas del inventario (confirmar o refutar en tu auditoría)\n",
      hintGaps.slice(0, 8).map((g) => `- ${g}`).join("\n"),
    );
  }

  return parts.filter(Boolean).join("\n");
}
