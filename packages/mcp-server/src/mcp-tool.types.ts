export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export type McpHandler = (args: Record<string, unknown>) => Promise<string>;

export interface McpApiClient {
  get: <T = unknown>(path: string) => Promise<T>;
  post: (path: string, body?: unknown) => Promise<unknown>;
  patch: (path: string, body?: unknown) => Promise<unknown>;
  delete: (path: string) => Promise<unknown>;
  fetchAllowStatuses: (
    method: string,
    path: string,
    body: unknown | undefined,
    allowedStatuses: number[],
  ) => Promise<{ status: number; data: unknown }>;
}

export interface McpToolModule {
  tools: McpTool[];
  createHandlers: (api: McpApiClient) => Record<string, McpHandler>;
}
