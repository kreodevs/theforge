import { normalizeGovernanceTargetAlias } from "@theforge/shared-types";

/** Nombre del cliente detectado en `initialize` ("hermes", "openhands", etc.). */
let clientName = "";

export function setMcpClientName(name: string): void {
  clientName = name;
}

export function getMcpClientName(): string {
  return clientName;
}

/** Resuelve el target de gobernanza: explícito > auto-detectado > "cursor". */
export function resolveGovernanceTarget(explicit?: string): string {
  if (explicit?.trim()) return normalizeGovernanceTargetAlias(explicit);
  return normalizeGovernanceTargetAlias(clientName);
}
