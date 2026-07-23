/** Proyecto de referencia HIGH para estimar coste IA con modelo top (OpenRouter tier premium). */
export const HIGH_MDD_IA_REFERENCE = {
  entities: 15,
  screens: 10,
  endpoints: 20,
  baseOverheadTokens: 200_000,
  tokensPerEntity: 50_000,
  tokensPerScreen: 80_000,
  tokensPerEndpoint: 20_000,
  /** ~4× coste blended estándar (modelos tipo claude-opus / gpt-4.1). */
  topModelCostPerTokenUsd: 0.000012,
  mxnPerUsd: 20,
} as const;

/** Tokens estimados del pipeline MDD completo HIGH (referencia). */
export function estimateHighMddPipelineTokens(
  overrides?: Partial<Pick<typeof HIGH_MDD_IA_REFERENCE, "entities" | "screens" | "endpoints">>,
): number {
  const r = { ...HIGH_MDD_IA_REFERENCE, ...overrides };
  return (
    r.baseOverheadTokens +
    r.entities * r.tokensPerEntity +
    r.screens * r.tokensPerScreen +
    r.endpoints * r.tokensPerEndpoint
  );
}

/** Coste de referencia en MXN para generación MDD HIGH con modelo top configurado. */
export function estimateHighMddTopModelCostMxn(
  overrides?: Partial<Pick<typeof HIGH_MDD_IA_REFERENCE, "entities" | "screens" | "endpoints">>,
): number {
  const tokens = estimateHighMddPipelineTokens(overrides);
  const { topModelCostPerTokenUsd, mxnPerUsd } = HIGH_MDD_IA_REFERENCE;
  return Math.round(tokens * topModelCostPerTokenUsd * mxnPerUsd);
}

const MXN_FORMAT = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

/** Leyenda para el formulario de proveedor IA (modelo top HIGH). */
export function highMddTopModelCostHintEs(): string {
  const mxn = estimateHighMddTopModelCostMxn();
  const { entities } = HIGH_MDD_IA_REFERENCE;
  return `Referencia: proyecto HIGH (~${entities} entidades), generación MDD completa con modelo top: ${MXN_FORMAT.format(mxn)} MXN (API tokens; no incluye nómina de desarrollo). Vacío = mismo que modelo de chat.`;
}
