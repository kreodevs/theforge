/**
 * Cruza señales del índice Ariadne (MCP) con artefactos SDD en FalkorDB (DB_Entity, API_Endpoint).
 * Sirve para bloquear llamadas a IA cuando hay desalineación grave hasta resolución explícita del usuario.
 */

export type LegacyIndexSignals = {
  /** Bloques devueltos por semantic_search (uno por query). */
  semanticChunks: string[];
  /** Rutas de archivo extraídas del texto del índice. */
  chosenPaths: string[];
  /** Texto unificado para heurísticas de coincidencia (minúsculas). */
  indexBlobLower: string;
};

export type SddStageSnapshot = {
  entityNames: string[];
  endpoints: Array<{ method: string; path: string }>;
};

export type LegacyIndexSddGateReason =
  | "ok"
  | "empty_index_vs_rich_sdd"
  | "low_entity_overlap"
  | "low_endpoint_overlap";

export type LegacyIndexSddGateResult = {
  reason: LegacyIndexSddGateReason;
  /** Si true, no se deben invocar LLM/MCP de síntesis hasta que el usuario resuelva. */
  blocking: boolean;
  summary: string;
  sddEntityCount: number;
  sddEndpointCount: number;
  entityHits: number;
  endpointHits: number;
  missingEntitiesSample: string[];
  missingEndpointsSample: string[];
};

function envInt(name: string, fallback: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envFloat(name: string, fallback: number): number {
  const n = parseFloat(process.env[name] ?? "");
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

/** Mínimo de entidades SDD para considerar el grafo “rico” frente a índice vacío. */
function minEntitiesRich(): number {
  return envInt("LEGACY_SDD_RICH_MIN_ENTITIES", 2);
}

function minEndpointsRich(): number {
  return envInt("LEGACY_SDD_RICH_MIN_ENDPOINTS", 2);
}

/** Umbral de solapamiento (0–1): por debajo = discrepancia grave. */
function minOverlapRatio(): number {
  return envFloat("LEGACY_SDD_INDEX_MIN_OVERLAP_RATIO", 0.28);
}

/** Mínimo de artefactos SDD para exigir solapamiento con el índice (si hay datos en ambos lados). */
function minArtifactsForOverlapCheck(): number {
  return envInt("LEGACY_SDD_MIN_ARTIFACTS_FOR_OVERLAP", 2);
}

function normalizePathForMatch(p: string): string {
  return (p ?? "")
    .trim()
    .toLowerCase()
    .replace(/\{[^}]+\}/g, ":")
    .replace(/\/+/g, "/");
}

function pathMentionedInBlob(path: string, blob: string): boolean {
  const n = normalizePathForMatch(path);
  if (n.length < 2) return false;
  if (blob.includes(n)) return true;
  const parts = n.split("/").filter((x) => x.length > 1);
  const hits = parts.filter((seg) => blob.includes(seg));
  return hits.length >= Math.min(2, Math.ceil(parts.length / 2));
}

function entityMentionedInBlob(name: string, blob: string): boolean {
  const raw = (name ?? "").trim();
  if (raw.length < 2) return false;
  const lower = raw.toLowerCase();
  if (lower.length <= 4) {
    return new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(blob);
  }
  return blob.includes(lower);
}

/**
 * Evalúa si el índice Ariadne y el SDD en Falkor están alineados lo suficiente para pasar a LLM.
 * @param signals - Señales del índice (sin llamadas a IA).
 * @param sdd - Snapshot de Falkor; null si no hay conexión o etapa sin datos.
 * @param hasUsableIndex - true si hay chunks/rutas suficientes (misma heurística que buildLegacyEvidenceMarkdown).
 */
export function evaluateLegacyIndexSddGate(
  signals: LegacyIndexSignals,
  sdd: SddStageSnapshot | null,
  hasUsableIndex: boolean,
): LegacyIndexSddGateResult {
  const empty: LegacyIndexSddGateResult = {
    reason: "ok",
    blocking: false,
    summary: "",
    sddEntityCount: 0,
    sddEndpointCount: 0,
    entityHits: 0,
    endpointHits: 0,
    missingEntitiesSample: [],
    missingEndpointsSample: [],
  };

  if (!sdd) return empty;

  const entityNames = [...new Set(sdd.entityNames.map((e) => (e ?? "").trim()).filter(Boolean))];
  const endpoints = sdd.endpoints.filter((e) => (e.path ?? "").trim().length > 0);
  const sddEntityCount = entityNames.length;
  const sddEndpointCount = endpoints.length;

  const blob = signals.indexBlobLower;
  const richSdd =
    sddEntityCount >= minEntitiesRich() || sddEndpointCount >= minEndpointsRich();

  if (!hasUsableIndex && richSdd) {
    return {
      reason: "empty_index_vs_rich_sdd",
      blocking: true,
      summary:
        "El índice Ariadne no devolvió evidencia útil (semantic_search / rutas), pero el grafo SDD local tiene entidades o endpoints asimilados. " +
        "Confirma el UUID de TheForge, el resync del repo, o resuelve el conflicto antes de generar documentación con IA.",
      sddEntityCount,
      sddEndpointCount,
      entityHits: 0,
      endpointHits: 0,
      missingEntitiesSample: entityNames.slice(0, 8),
      missingEndpointsSample: endpoints.map((e) => `${e.method} ${e.path}`).slice(0, 8),
    };
  }

  if (!hasUsableIndex || (sddEntityCount < minArtifactsForOverlapCheck() && sddEndpointCount < minArtifactsForOverlapCheck())) {
    return empty;
  }

  const entityHits = entityNames.filter((n) => entityMentionedInBlob(n, blob)).length;
  const endpointHits = endpoints.filter((e) => pathMentionedInBlob(e.path, blob)).length;

  const eratio = sddEntityCount > 0 ? entityHits / sddEntityCount : 1;
  const pratio = sddEndpointCount > 0 ? endpointHits / sddEndpointCount : 1;
  const threshold = minOverlapRatio();

  const missingEntitiesSample = entityNames.filter((n) => !entityMentionedInBlob(n, blob)).slice(0, 8);
  const missingEndpointsSample = endpoints
    .filter((e) => !pathMentionedInBlob(e.path, blob))
    .map((e) => `${e.method} ${e.path}`)
    .slice(0, 8);

  if (sddEntityCount >= minArtifactsForOverlapCheck() && eratio < threshold) {
    return {
      reason: "low_entity_overlap",
      blocking: true,
      summary:
        `Solo ${entityHits}/${sddEntityCount} entidades del SDD aparecen en el texto/rutas del índice Ariadne (umbral ${Math.round(threshold * 100)}%). ` +
        "Riesgo: MDD o ingest desactualizado, o índice apunta a otro repositorio.",
      sddEntityCount,
      sddEndpointCount,
      entityHits,
      endpointHits,
      missingEntitiesSample,
      missingEndpointsSample,
    };
  }

  if (sddEndpointCount >= minArtifactsForOverlapCheck() && pratio < threshold) {
    return {
      reason: "low_endpoint_overlap",
      blocking: true,
      summary:
        `Solo ${endpointHits}/${sddEndpointCount} rutas API del SDD se reflejan en el índice (umbral ${Math.round(threshold * 100)}%). ` +
        "Revisa coherencia entre grafo SDD y código indexado.",
      sddEntityCount,
      sddEndpointCount,
      entityHits,
      endpointHits,
      missingEntitiesSample,
      missingEndpointsSample,
    };
  }

  return empty;
}
