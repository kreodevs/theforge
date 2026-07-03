/** Vista pública de una instancia de MCP gráfico (sin token en claro). */
export interface UiMcpInstanceSummary {
  id: string;
  displayName: string;
  url: string;
  hasToken: boolean;
  enabled: boolean;
  isActive: boolean;
  teamVisible: boolean;
  compatible: boolean;
  adapterId: string | null;
  contractVersion: string | null;
  libraryName: string | null;
  libraryVersion: string | null;
  lastCheckedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertUiMcpInstanceBody {
  displayName: string;
  url: string;
  token?: string | null;
  enabled?: boolean;
  teamVisible?: boolean;
}

/** Resultado de detección de compatibilidad (endpoint /test y /detect). */
export interface UiMcpCompatibilityResult {
  compatible: boolean;
  contractVersion?: string;
  libraryName?: string;
  libraryVersion?: string;
  missingTools: string[];
  error?: string;
  adapterId?: string | null;
  nativeCompatible?: boolean;
}
