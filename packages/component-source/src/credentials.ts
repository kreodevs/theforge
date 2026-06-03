export interface ComponentSourceUrlTokenCredentials {
  url: string;
  token?: string;
}

/** Resolves MCP URL and optional bearer token for a user without coupling to persistence. */
export type ComponentSourceCredentialResolver = (
  userId: string,
) => Promise<ComponentSourceUrlTokenCredentials | null>;
