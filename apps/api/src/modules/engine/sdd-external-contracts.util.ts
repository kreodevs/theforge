/**
 * Contratos de integraciones externas (WebSocket gateway, Banxico, Polygon) cuando DBGA/BRD las mantienen en alcance.
 */

const INTEGRATION_SIGNALS: Array<{
  id: string;
  scopeRe: RegExp;
  apiRe: RegExp;
  archRe: RegExp;
  infraRe: RegExp;
}> = [
  {
    id: "websocket_gateway",
    scopeRe: /\b(websocket|ws\s+gateway|gateway\s+websocket|tiempo\s+real|real[- ]time\s+feed)\b/i,
    apiRe: /\b(wss?:\/\/|websocket|\/ws\b|socket\.io)\b/i,
    archRe: /\b(websocket|gateway\s+ws|real[- ]time)\b/i,
    infraRe: /\b(websocket|nginx\s+proxy.*upgrade|sticky\s+session)\b/i,
  },
  {
    id: "banxico",
    scopeRe: /\b(banxico|tipo\s+de\s+cambio\s+oficial|fix\s+mxn|series\s+banxico)\b/i,
    apiRe: /\b(banxico|\/exchange[- ]?rates|tipo\s+cambio)\b/i,
    archRe: /\b(banxico|fix\s+mxn)\b/i,
    infraRe: /\b(banxico|cron.*tipo\s+cambio)\b/i,
  },
  {
    id: "polygon",
    scopeRe: /\b(polygon\.io|polygon\s+api|market\s+data\s+polygon)\b/i,
    apiRe: /\b(polygon|\/market[- ]?data|\/quotes)\b/i,
    archRe: /\b(polygon)\b/i,
    infraRe: /\b(polygon|market\s+data\s+provider)\b/i,
  },
];

function inScope(corpus: string, re: RegExp): boolean {
  return re.test(corpus);
}

/** Gaps cuando BRD/DBGA declara integración pero falta en API/Architecture/Infra. */
export function collectExternalIntegrationContractGaps(params: {
  dbgaMarkdown?: string | null;
  brdMarkdown?: string | null;
  mddMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
  architectureMarkdown?: string | null;
  infraMarkdown?: string | null;
}): string[] {
  const scopeCorpus = [
    params.dbgaMarkdown,
    params.brdMarkdown,
    params.mddMarkdown,
  ]
    .filter(Boolean)
    .join("\n");
  if (scopeCorpus.length < 200) return [];

  const api = params.apiContractsMarkdown ?? "";
  const arch = params.architectureMarkdown ?? "";
  const infra = params.infraMarkdown ?? "";
  const gaps: string[] = [];

  for (const sig of INTEGRATION_SIGNALS) {
    if (!inScope(scopeCorpus, sig.scopeRe)) continue;
    const missing: string[] = [];
    if (!inScope(api, sig.apiRe)) missing.push("API contracts");
    if (!inScope(arch, sig.archRe)) missing.push("Architecture");
    if (!inScope(infra, sig.infraRe)) missing.push("Infra");
    if (missing.length > 0) {
      gaps.push(
        `[Integración ${sig.id}] En alcance DBGA/BRD pero falta en: ${missing.join(", ")}`,
      );
    }
  }

  return gaps;
}
