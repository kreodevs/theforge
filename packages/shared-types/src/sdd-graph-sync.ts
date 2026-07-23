/** Estado del grafo SDD local (FalkorDB) respecto al MDD de la etapa activa. */
export type SddGraphSyncState = "synced" | "empty" | "stale" | "unavailable";

export const SDD_GRAPH_SYNC_STATE_LABELS: Record<SddGraphSyncState, string> = {
  synced: "Sincronizado",
  empty: "Vacío",
  stale: "Desactualizado",
  unavailable: "No disponible",
};

export type SddGraphSyncStatus = {
  state: SddGraphSyncState;
  /** Entidades (`DB_Entity`) en Falkor para la etapa. */
  entityCount: number;
  /** Endpoints (`API_Endpoint`) en Falkor para la etapa. */
  endpointCount: number;
  /** Tablas detectadas en §3 del MDD (SQL). */
  expectedEntities: number;
  /** Endpoints detectados en §4 del MDD. */
  expectedEndpoints: number;
  /** Resultado de `evaluateSddDependencyHealth` (CONSUMES bidireccional). */
  isCoherent: boolean;
  orphanEntityCount: number;
  orphanEndpointCount: number;
  lastSyncedAt: number | null;
  message: string;
};

export type ResolveSddGraphSyncInput = {
  falkorAvailable: boolean;
  expectedEntities: number;
  expectedEndpoints: number;
  graphEntities: number;
  graphEndpoints: number;
  isCoherent: boolean | null;
  orphanEntityCount?: number;
  orphanEndpointCount?: number;
  mddChangedSinceSync?: boolean;
};

const countTolerance = (expected: number, actual: number): boolean =>
  Math.abs(expected - actual) <= (expected > 10 ? 2 : 1);

/** Resuelve estado UI/API a partir de expectativas MDD vs snapshot Falkor. */
export function resolveSddGraphSyncState(input: ResolveSddGraphSyncInput): SddGraphSyncStatus {
  const {
    falkorAvailable,
    expectedEntities,
    expectedEndpoints,
    graphEntities,
    graphEndpoints,
    isCoherent,
    orphanEntityCount = 0,
    orphanEndpointCount = 0,
    mddChangedSinceSync = false,
  } = input;

  if (!falkorAvailable) {
    return {
      state: "unavailable",
      entityCount: graphEntities,
      endpointCount: graphEndpoints,
      expectedEntities,
      expectedEndpoints,
      isCoherent: false,
      orphanEntityCount,
      orphanEndpointCount,
      lastSyncedAt: null,
      message: "FalkorDB no disponible; el grafo SDD no se puede consultar.",
    };
  }

  const indexable = expectedEntities > 0 || expectedEndpoints > 0;
  if (!indexable && graphEntities === 0 && graphEndpoints === 0) {
    return {
      state: "empty",
      entityCount: 0,
      endpointCount: 0,
      expectedEntities: 0,
      expectedEndpoints: 0,
      isCoherent: false,
      orphanEntityCount: 0,
      orphanEndpointCount: 0,
      lastSyncedAt: null,
      message:
        "El MDD no expone tablas SQL ni contratos API indexables (p. ej. legacy Strapi); el grafo §3/§4 queda vacío.",
    };
  }

  const entitiesMatch = countTolerance(expectedEntities, graphEntities);
  const endpointsMatch = countTolerance(expectedEndpoints, graphEndpoints);
  const coherent = isCoherent === true;
  const synced =
    !mddChangedSinceSync &&
    entitiesMatch &&
    endpointsMatch &&
    coherent &&
    graphEntities > 0 &&
    graphEndpoints > 0;

  if (synced) {
    return {
      state: "synced",
      entityCount: graphEntities,
      endpointCount: graphEndpoints,
      expectedEntities,
      expectedEndpoints,
      isCoherent: true,
      orphanEntityCount,
      orphanEndpointCount,
      lastSyncedAt: null,
      message: "Grafo SDD alineado con §3/§4 del MDD.",
    };
  }

  let message = "Grafo SDD desactualizado respecto al MDD.";
  if (graphEntities === 0 && graphEndpoints === 0 && indexable) {
    message = "Aún no se ha sincronizado el MDD al grafo SDD (o la sync falló).";
  } else if (mddChangedSinceSync) {
    message = "El MDD cambió después de la última sincronización al grafo.";
  } else if (!entitiesMatch || !endpointsMatch) {
    message = "Los conteos §3/§4 del MDD no coinciden con el grafo Falkor.";
  } else if (isCoherent === false) {
    message = "Hay endpoints o entidades huérfanas en el grafo (relaciones CONSUMES incompletas).";
  }

  return {
    state: "stale",
    entityCount: graphEntities,
    endpointCount: graphEndpoints,
    expectedEntities,
    expectedEndpoints,
    isCoherent: coherent,
    orphanEntityCount,
    orphanEndpointCount,
    lastSyncedAt: null,
    message,
  };
}

/** Huella ligera del MDD para detectar cambios post-sync sin hash completo. */
export function mddGraphFingerprint(mddMarkdown: string): string {
  const body = (mddMarkdown ?? "").trim();
  const len = body.length;
  const tables = (body.match(/\bCREATE\s+TABLE\b/gi) ?? []).length;
  const endpoints = (body.match(/\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|/gi) ?? []).length;
  const h3ep = (body.match(/###\s+(GET|POST|PUT|PATCH|DELETE)\s+\S+/gi) ?? []).length;
  return `${len}:${tables}:${Math.max(endpoints, h3ep)}`;
}
