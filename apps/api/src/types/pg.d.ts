declare module "pg" {
  export interface PoolClient {
    query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<{ rows: T[] }>;
    release(): void;
  }

  export class Pool {
    constructor(config: { connectionString?: string; max?: number });
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
