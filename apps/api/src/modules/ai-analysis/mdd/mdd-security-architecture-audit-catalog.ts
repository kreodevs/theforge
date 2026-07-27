/** Catálogo A–G del prompt security-architecture-auditor-prompt.md (88 verificaciones). */

export const SECURITY_ARCHITECTURE_AUDIT_FAMILY_SIZES: Record<string, number> = {
  A: 10,
  B: 14,
  C: 14,
  D: 14,
  E: 16,
  F: 12,
  G: 8,
};

export const SECURITY_ARCHITECTURE_AUDIT_FAMILIES = Object.keys(
  SECURITY_ARCHITECTURE_AUDIT_FAMILY_SIZES,
) as Array<keyof typeof SECURITY_ARCHITECTURE_AUDIT_FAMILY_SIZES>;

function buildCatalogIds(): string[] {
  const ids: string[] = [];
  for (const [family, count] of Object.entries(SECURITY_ARCHITECTURE_AUDIT_FAMILY_SIZES)) {
    for (let i = 1; i <= count; i += 1) {
      ids.push(`${family}${String(i).padStart(2, "0")}`);
    }
  }
  return ids;
}

export const SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS = buildCatalogIds();

export const SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE =
  SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.length;

/**
 * MDD que cabe en 1 shot con perfil `auditor` (~131k tokens salida; ~100k chars ≈ 25k tokens input).
 * KMS ~79k debe ir 1-shot; chunk solo si el documento excede ventana segura.
 */
export const MDD_SECURITY_AUDIT_SINGLE_SHOT_MAX_CHARS = 100_000;

/** Mínimo de verificaciones contabilizadas (ejecutadas + no_evaluado) para aceptar el informe. */
export const SECURITY_ARCHITECTURE_AUDIT_MIN_ACCOUNTED_RATIO = 0.85;

/** MDD «grande» para gate de profundidad analítica (p. ej. KMS ~79k). */
export const MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_CHARS = 30_000;

/** Hallazgos mínimos esperados en MDD grande antes de marcar cobertura analítica baja. */
export const MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_HALLAZGOS = 5;

/** Concurrencia máxima en multi-pase por familia (solo con deepAudit). */
export const MDD_SECURITY_AUDIT_FAMILY_PASS_CONCURRENCY = 3;

export function getCatalogIdsForFamily(family: string): string[] {
  const prefix = family.trim().toUpperCase();
  return SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.filter((id) => id.startsWith(prefix));
}
