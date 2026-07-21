/**
 * Contratos de integraciones externas — delega al registro extensible en shared-types.
 */

import { collectExternalIntegrationGapsFromRegistry } from "@theforge/shared-types";

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

  return collectExternalIntegrationGapsFromRegistry({
    scopeCorpus,
    apiMarkdown: params.apiContractsMarkdown ?? "",
    architectureMarkdown: params.architectureMarkdown ?? "",
    infraMarkdown: params.infraMarkdown ?? "",
  });
}
