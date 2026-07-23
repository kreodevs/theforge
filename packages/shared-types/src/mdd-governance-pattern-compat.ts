import { listGovernancePatternOptions } from "./mdd-governance-patterns.js";

/** Par incompatibles: si ambos están [X], se conserva `keepId` y se quita el otro. */
export type GovernancePatternIncompatibilityRule = {
  a: string;
  b: string;
  keepId: string;
  reason: string;
};

export type GovernancePatternCorrection = {
  removedId: string;
  removedLabel: string;
  keptId: string;
  keptLabel: string;
  reason: string;
};

export type ResolveGovernancePatternIncompatibilitiesResult = {
  correctedIds: Set<string>;
  corrections: GovernancePatternCorrection[];
};

/**
 * Reglas deterministas de exclusión mutua entre patrones del wizard SSOT.
 * IDs = slug del label (`listGovernancePatternOptions`).
 */
export const GOVERNANCE_PATTERN_INCOMPATIBILITY_RULES: readonly GovernancePatternIncompatibilityRule[] = [
  {
    a: "microservicios",
    b: "monolito-modular",
    keepId: "monolito-modular",
    reason: "No se despliegan a la vez un monolito modular y microservicios independientes como arquitectura global.",
  },
  {
    a: "microservicios",
    b: "serverless-architecture",
    keepId: "microservicios",
    reason: "Serverless (FaaS/BaaS) y microservicios contenedorizados implican modelos operativos distintos.",
  },
  {
    a: "monolito-modular",
    b: "serverless-architecture",
    keepId: "monolito-modular",
    reason: "Un monolito modular es una unidad de despliegue; la arquitectura serverless fragmenta la ejecución en funciones/servicios gestionados.",
  },
  {
    a: "microservicios",
    b: "soa-service-oriented-architecture",
    keepId: "microservicios",
    reason: "SOA con ESB y microservicios autónomos suelen contradecirse; conserva uno como estilo de integración principal.",
  },
  {
    a: "clean-architecture-onion-architecture",
    b: "active-record",
    keepId: "clean-architecture-onion-architecture",
    reason: "Active Record acopla dominio y persistencia; Clean/Onion exige independencia del dominio.",
  },
  {
    a: "event-sourcing",
    b: "active-record",
    keepId: "event-sourcing",
    reason: "Event Sourcing persiste eventos inmutables; Active Record modela filas mutables.",
  },
  {
    a: "cqrs-command-query-responsibility-segregation",
    b: "active-record",
    keepId: "cqrs-command-query-responsibility-segregation",
    reason: "CQRS separa modelos de lectura y escritura; Active Record unifica ambos en el mismo objeto.",
  },
  {
    a: "data-mapper",
    b: "active-record",
    keepId: "data-mapper",
    reason: "Data Mapper y Active Record son estrategias de persistencia excluyentes.",
  },
  {
    a: "repository",
    b: "active-record",
    keepId: "repository",
    reason: "Repository abstrae colecciones de dominio; Active Record mezcla fila SQL y lógica en la misma clase.",
  },
] as const;

const labelById = (): Map<string, string> => {
  const map = new Map<string, string>();
  for (const o of listGovernancePatternOptions()) map.set(o.id, o.label);
  return map;
};

function labelFor(id: string, labels: Map<string, string>): string {
  return labels.get(id) ?? id;
}

/** Quita patrones incompatibles hasta estabilizar la selección. */
export function resolveGovernancePatternIncompatibilities(
  selectedIds: ReadonlySet<string>,
): ResolveGovernancePatternIncompatibilitiesResult {
  const correctedIds = new Set(selectedIds);
  const corrections: GovernancePatternCorrection[] = [];
  const labels = labelById();
  let changed = true;

  while (changed) {
    changed = false;
    for (const rule of GOVERNANCE_PATTERN_INCOMPATIBILITY_RULES) {
      if (!correctedIds.has(rule.a) || !correctedIds.has(rule.b)) continue;
      const removeId = rule.keepId === rule.a ? rule.b : rule.a;
      const keepId = rule.keepId;
      if (!correctedIds.has(removeId)) continue;
      correctedIds.delete(removeId);
      corrections.push({
        removedId: removeId,
        removedLabel: labelFor(removeId, labels),
        keptId: keepId,
        keptLabel: labelFor(keepId, labels),
        reason: rule.reason,
      });
      changed = true;
    }
  }

  return { correctedIds, corrections };
}

export function formatGovernancePatternCorrectionsList(
  corrections: readonly GovernancePatternCorrection[],
): string {
  return corrections
    .map(
      (c) =>
        `• Se desmarcó **${c.removedLabel}** (se mantiene **${c.keptLabel}**): ${c.reason}`,
    )
    .join("\n");
}

export function formatGovernancePatternCorrectionsNotice(
  corrections: readonly GovernancePatternCorrection[],
): string {
  if (corrections.length === 0) return "";
  return (
    "Patrones incompatibles corregidos automáticamente antes de generar el MDD:\n" +
    formatGovernancePatternCorrectionsList(corrections)
  );
}
