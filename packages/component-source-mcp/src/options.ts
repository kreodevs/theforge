export interface ComponentSourceLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug?(message: string): void;
}

export const defaultComponentSourceLogger: ComponentSourceLogger = {
  log: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
  debug: (message) => console.debug(message),
};

export interface McpComponentSourceOptions {
  logger?: ComponentSourceLogger;
  clientName?: string;
  clientVersion?: string;
}

/** @deprecated Use McpComponentSourceOptions */
export type OrbitaComponentSourceOptions = McpComponentSourceOptions;
