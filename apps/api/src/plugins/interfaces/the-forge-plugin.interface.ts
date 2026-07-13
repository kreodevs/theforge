import type {
  PluginContext,
  BeforeDocumentRenderPayload,
  AfterDocumentRenderPayload,
  AfterDocumentPersistPayload,
  ProjectLifecyclePayload,
} from "../types/plugin-payloads.js";

/**
 * Ciclo de vida completo de un plugin The Forge.
 *
 * Cada plugin es una clase que implementa esta interfaz.
 * El core nunca depende de implementaciones concretas,
 * solo de esta abstracción (Inversión de Dependencias).
 *
 * Todas las funciones de hook son opcionales (?).
 * Un plugin solo implementa los que necesita.
 *
 * @example
 * ```typescript
 * export default class MyPlugin implements ITheForgePlugin {
 *   readonly id = 'my-company/my-plugin';
 *   readonly version = '1.0.0';
 *   readonly name = 'Mi Plugin';
 *   readonly description = 'Extiende The Forge con X';
 *
 *   async onPluginInit(ctx: PluginContext) {
 *     ctx.logger.log('Plugin inicializado');
 *   }
 *
 *   async afterDocumentRender(payload: AfterDocumentRenderPayload) {
 *     if (payload.documentType !== 'evd') return payload;
 *     // ... post-procesar EVD
 *     return payload;
 *   }
 * }
 * ```
 */
export interface ITheForgePlugin {
  /** Identificador único del plugin. Usar formato reverse-DNS: "com.miempresa.plugin" */
  readonly id: string;

  /** Versión semántica del plugin. Ej: "2.1.0" */
  readonly version: string;

  /** Nombre legible para humanos. Ej: "Executive Visual Deck" */
  readonly name: string;

  /** Descripción de la funcionalidad que proporciona */
  readonly description: string;

  // ────────────────────────
  // Ciclo de Vida del Plugin
  // ────────────────────────

  /**
   * Invocado una única vez cuando el PluginLoaderService detecta y carga el plugin.
   *
   * Útil para:
   * - Resolver servicios del core vía PluginContext.getService()
   * - Validar configuración (API keys, rutas, etc.)
   * - Inicializar recursos (conexiones, directorios, caché)
   *
   * @param context Contexto de inyección de dependencias limitado
   * @throws Si el plugin no puede inicializarse. El loader ejecuta try/catch y skip.
   */
  onPluginInit(context: PluginContext): Promise<void> | void;

  /**
   * Invocado cuando el plugin va a ser descargado o reemplazado.
   *
   * Útil para limpiar recursos: cerrar conexiones, liberar locks, flush buffers.
   *
   * @optional
   */
  onPluginDestroy?(): Promise<void> | void;

  // ────────────────────────
  // Hooks del Pipeline de Documentos
  // ────────────────────────

  /**
   * Hook: ANTES de que el LLM genere un documento/entregable.
   *
   * Permite:
   * - Modificar el prompt (pre-pend/append instrucciones)
   * - Cambiar el system prompt
   * - Anexar contexto adicional al payload
   * - Rechazar la generación lanzando Error
   *
   * @param payload Contexto completo de la generación
   * @returns Payload modificado (inmutable)
   * @optional
   */
  beforeDocumentRender?(
    payload: BeforeDocumentRenderPayload
  ): Promise<BeforeDocumentRenderPayload> | BeforeDocumentRenderPayload;

  /**
   * Hook: DESPUÉS de que el LLM devuelve un documento/entregable.
   *
   * Permite:
   * - Post-procesar el output (parsear, validar, enriquecer)
   * - Generar recursos adicionales (imágenes, diagramas)
   * - Transformar formato (JSON → enriched JSON)
   * - Lanzar Error si el output no cumple criterios del plugin
   *
   * @param payload Documento generado + contexto original
   * @returns Documento modificado (inmutable)
   * @optional
   */
  afterDocumentRender?(
    payload: AfterDocumentRenderPayload
  ): Promise<AfterDocumentRenderPayload> | AfterDocumentRenderPayload;

  /**
   * Hook: DESPUÉS de que un entregable se persiste en DB.
   *
   * Útil para side-effects: export, notificación, analytics, indexing.
   * NO modifica el payload (void). Si falla, se loguea pero no bloquea.
   *
   * @param payload Documento persistido + metadatos de generación
   * @optional
   */
  afterDocumentPersist?(
    payload: AfterDocumentPersistPayload
  ): Promise<void> | void;

  // ────────────────────────
  // Hooks de Ciclo de Vida del Proyecto
  // ────────────────────────

  /**
   * Hook: Cuando se crea un nuevo proyecto.
   *
   * Permite inicializar recursos específicos del plugin para el proyecto.
   *
   * @param payload Datos del proyecto creado
   * @optional
   */
  onProjectCreate?(
    payload: ProjectLifecyclePayload
  ): Promise<void> | void;

  /**
   * Hook: Cuando un proyecto es actualizado (post-save).
   *
   * @param payload Datos del proyecto actualizado
   * @optional
   */
  onProjectUpdate?(
    payload: ProjectLifecyclePayload
  ): Promise<void> | void;
}
