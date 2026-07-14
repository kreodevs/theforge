import type { Logger } from "@nestjs/common";

/**
 * Contexto de inyección de dependencias proporcionado por el core
 * a cada plugin durante su inicialización.
 *
 * El plugin NO tiene acceso directo al contenedor de NestJS completo.
 * Solo puede resolver servicios que el core decide exponer.
 */
export interface PluginContext {
  /**
   * Resuelve un servicio del core por su token.
   * @param token Token de DI (string | symbol | class reference)
   * @returns Instancia del servicio
   * @throws Si el servicio no existe o no está expuesto
   */
  getService<T>(token: string | symbol | (new (...args: unknown[]) => T)): T;

  /** Logger con prefijo del plugin para trazabilidad */
  logger: Logger;

  /** Configuración del core (sin secretos). Ej: ruta de datos, timeouts */
  config: Record<string, unknown>;
}

/**
 * Payload para el hook beforeDocumentRender.
 * Invocado ANTES de que el core envíe el prompt al LLM.
 */
export interface BeforeDocumentRenderPayload {
  /** Tipo de documento: 'spec' | 'tasks' | 'evd' | 'architecture' | ... */
  documentType: string;
  /** ID del proyecto */
  projectId: string;
  /** Prompt que se enviará al LLM (mutable por plugins) */
  prompt: string;
  /** System prompt que se usará (mutable por plugins) */
  systemPrompt: string;
  /** Contexto adicional: MDD, Blueprint, Spec, etc. */
  context: Record<string, string | null | undefined>;
  /** Runtime del LLM resuelto (provider, model, apiKey) */
  llmRuntime: {
    providerId: string;
    model: string;
    apiKey: string;
    baseURL: string;
  };
}

/**
 * Payload para el hook afterDocumentRender.
 * Invocado DESPUÉS de que el LLM devuelve el documento.
 */
export interface AfterDocumentRenderPayload {
  /** Tipo de documento */
  documentType: string;
  /** ID del proyecto */
  projectId: string;
  /** Contenido raw generado por el LLM */
  rawContent: string;
  /** Contenido parseado/estructurado (si aplica) */
  parsedContent: unknown;
  /** Contexto original enviado al LLM */
  originalContext: BeforeDocumentRenderPayload;
}

/**
 * Payload para el hook afterDocumentPersist.
 * Invocado DESPUÉS de que el documento se guarda en DB.
 */
export interface AfterDocumentPersistPayload {
  /** Tipo de documento */
  documentType: string;
  /** ID del proyecto */
  projectId: string;
  /** Contenido final persistido */
  finalContent: string;
  /** Metadatos de la generación */
  metadata: {
    durationMs: number;
    tokensUsed?: number;
    provider: string;
    model: string;
  };
}

/**
 * Payload para eventos de ciclo de vida del proyecto.
 */
export interface ProjectLifecyclePayload {
  projectId: string;
  projectName: string;
  /** Usuario que realizó la acción */
  userId: string;
  /** Timestamp del evento */
  timestamp: Date;
  /** Datos adicionales según el evento */
  extra?: Record<string, unknown>;
}
