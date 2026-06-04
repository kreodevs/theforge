export interface ComponentSourceHttpCredentials {
  transport: "http";
  url: string;
  token?: string;
}

export interface ComponentSourceStdioCredentials {
  transport: "stdio";
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export type ComponentSourceCredentials =
  | ComponentSourceHttpCredentials
  | ComponentSourceStdioCredentials;

/** @deprecated Use ComponentSourceHttpCredentials — kept for gradual migration. */
export interface ComponentSourceUrlTokenCredentials {
  url: string;
  token?: string;
}

export function isHttpCredentials(
  credentials: ComponentSourceCredentials,
): credentials is ComponentSourceHttpCredentials {
  return credentials.transport === "http";
}

export function isStdioCredentials(
  credentials: ComponentSourceCredentials,
): credentials is ComponentSourceStdioCredentials {
  return credentials.transport === "stdio";
}

/** Resolves MCP credentials (HTTP URL or stdio spawn) for a user/profile. */
export type ComponentSourceCredentialResolver = (
  userId: string,
) => Promise<ComponentSourceCredentials | null>;
