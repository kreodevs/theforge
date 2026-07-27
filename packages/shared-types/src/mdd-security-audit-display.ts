/** Justificación server-side para IDs omitidos por el modelo (relleno conservador). */
export const SERVER_FILLED_NO_EVALUADO_JUSTIFICATION =
  "Sin hallazgo explícito ni justificación del modelo — pendiente de re-auditoría";

/** Etiqueta UI para entradas `no_evaluado` rellenadas por el servidor (no confundir con N/A del modelo). */
export const SERVER_FILLED_NO_EVALUADO_UI_LABEL = "No revisado por el modelo";

const CATALOG_ID_RE = /^([A-G]\d{2})\b/i;

export function extractCatalogIdFromNoEvaluadoEntry(entry: string): string | null {
  const match = entry.trim().match(CATALOG_ID_RE);
  return match?.[1]?.toUpperCase() ?? null;
}

export function isServerFilledNoEvaluadoEntry(entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;
  return trimmed.includes(SERVER_FILLED_NO_EVALUADO_JUSTIFICATION);
}

/** Formatea `ID — razón` para UI; el fill server-side usa etiqueta amigable. */
export function formatNoEvaluadoEntryForDisplay(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return trimmed;
  const match = trimmed.match(/^([A-G]\d{2})\s*[—–-]\s*(.+)$/i);
  if (!match?.[1] || !match[2]) return trimmed;
  const id = match[1].toUpperCase();
  const reason = match[2].trim();
  if (reason === SERVER_FILLED_NO_EVALUADO_JUSTIFICATION) {
    return `${id} — ${SERVER_FILLED_NO_EVALUADO_UI_LABEL}`;
  }
  return `${id} — ${reason}`;
}

export interface SecurityAuditCoberturaUiBreakdown {
  ejecutadas: number;
  pasa: number;
  falla: number;
  noRevisado: number;
  noAplica: number;
}

/** Desglose UI: separa relleno server (`noRevisado`) de N/A con justificación del modelo. */
export function computeSecurityAuditCoberturaUiBreakdown(input: {
  hallazgos?: Array<{ verificacion?: string }>;
  no_evaluado?: string[];
  cobertura?: { ejecutadas?: number; pasa?: number; falla?: number; no_aplica?: number };
}): SecurityAuditCoberturaUiBreakdown {
  const cobertura = input.cobertura ?? {};
  const fallaIds = new Set<string>();
  for (const h of input.hallazgos ?? []) {
    const ver = h.verificacion?.trim().toUpperCase();
    if (ver && CATALOG_ID_RE.test(ver)) fallaIds.add(ver);
  }

  let noRevisado = 0;
  let noAplicaModelo = 0;
  for (const entry of input.no_evaluado ?? []) {
    const id = extractCatalogIdFromNoEvaluadoEntry(entry);
    if (!id || fallaIds.has(id)) continue;
    if (isServerFilledNoEvaluadoEntry(entry)) noRevisado += 1;
    else noAplicaModelo += 1;
  }

  return {
    ejecutadas: cobertura.ejecutadas ?? 0,
    pasa: cobertura.pasa ?? 0,
    falla: cobertura.falla ?? 0,
    noRevisado,
    noAplica: noAplicaModelo,
  };
}

export function formatSecurityAuditCoberturaUiLine(breakdown: SecurityAuditCoberturaUiBreakdown): string {
  return [
    `${breakdown.ejecutadas} ejecutadas`,
    `${breakdown.pasa} pasa`,
    `${breakdown.falla} falla`,
    `${breakdown.noRevisado} no revisado`,
    `${breakdown.noAplica} N/A`,
  ].join(" · ");
}

/** Warning API cuando el modelo devolvió pocos hallazgos en MDD extenso. */
export const SECURITY_AUDIT_LOW_COVERAGE_WARNING = "cobertura_analitica_baja";

/** Ratio no_revisado/ejecutadas por encima del cual la UI muestra alerta de cobertura baja. */
export const SECURITY_AUDIT_LOW_COVERAGE_NO_REVISADO_RATIO = 0.7;

export function isSecurityAuditLowAnalyticalCoverage(input: {
  warnings?: string[];
  coberturaUi?: SecurityAuditCoberturaUiBreakdown | null;
}): boolean {
  if (input.warnings?.includes(SECURITY_AUDIT_LOW_COVERAGE_WARNING)) return true;
  const ui = input.coberturaUi;
  if (!ui || ui.ejecutadas <= 0) return false;
  return ui.noRevisado / ui.ejecutadas > SECURITY_AUDIT_LOW_COVERAGE_NO_REVISADO_RATIO;
}
