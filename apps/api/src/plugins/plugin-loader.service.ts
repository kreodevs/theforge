import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { ITheForgePlugin } from "./interfaces/the-forge-plugin.interface.js";
import type { ArtifactTypeDefinition } from "@theforge/shared-types";
import type {
  BeforeDocumentRenderPayload,
  AfterDocumentRenderPayload,
  AfterDocumentPersistPayload,
  ProjectLifecyclePayload,
} from "./types/plugin-payloads.js";

/** Token DI para exponer PluginLoaderService */
export const PLUGIN_LOADER_SERVICE = Symbol("PLUGIN_LOADER_SERVICE");

/**
 * Estado de un hook: plugin + handler compilado.
 */
interface HookEntry<H> {
  pluginId: string;
  handler: H;
}

/**
 * Carga dinámica de plugins en runtime.
 *
 * Busca directorios en rutas configuradas, carga cada plugin vía `await import()`,
 * valida que implementa `ITheForgePlugin`, inicializa, y registra sus hooks.
 *
 * Si un plugin falla al cargar, se loguea el error y el core continúa (YAGNI).
 */
@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PluginLoaderService.name);

  /** Mapa de plugins cargados: id → instancia */
  private readonly plugins = new Map<string, ITheForgePlugin>();

  /** Registro de hooks por tipo */
  private readonly beforeDocumentRenderHooks: HookEntry<
    NonNullable<ITheForgePlugin["beforeDocumentRender"]>
  >[] = [];
  private readonly afterDocumentRenderHooks: HookEntry<
    NonNullable<ITheForgePlugin["afterDocumentRender"]>
  >[] = [];
  private readonly afterDocumentPersistHooks: HookEntry<
    NonNullable<ITheForgePlugin["afterDocumentPersist"]>
  >[] = [];
  private readonly onProjectCreateHooks: HookEntry<
    NonNullable<ITheForgePlugin["onProjectCreate"]>
  >[] = [];
  private readonly onProjectUpdateHooks: HookEntry<
    NonNullable<ITheForgePlugin["onProjectUpdate"]>
  >[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Ciclo de vida de NestJS: cargar plugins al arrancar */
  async onModuleInit(): Promise<void> {
    const directories = this.resolvePluginDirectories();

    for (const dir of directories) {
      if (!existsSync(dir)) {
        this.logger.debug(`Plugin directory not found: ${dir}`);
        continue;
      }

      const entries = readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => join(dir, e.name));

      for (const pluginPath of entries) {
        await this.tryLoadPlugin(pluginPath);
      }
    }

    if (this.plugins.size === 0) {
      this.logger.log("No plugins loaded — core running standalone (YAGNI)");
    } else {
      this.logger.log(
        `${this.plugins.size} plugin(s) loaded: ${[...this.plugins.keys()].join(", ")}`,
      );
    }
  }

  /**
   * Intenta cargar un plugin desde un directorio.
   * Si falla, loguea el error y continúa (graceful degradation).
   */
  private async tryLoadPlugin(pluginPath: string): Promise<void> {
    // Try both .ts (dev) and .js (prod/compiled) entry points
    const candidates = [
      join(pluginPath, "index.ts"),
      join(pluginPath, "index.js"),
      join(pluginPath, "src", "index.ts"),
      join(pluginPath, "src", "index.js"),
    ];

    let entryPoint: string | undefined;
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        entryPoint = candidate;
        break;
      }
    }

    if (!entryPoint) {
      this.logger.verbose(
        `No entry point found in plugin directory ${pluginPath} — skipping`,
      );
      return;
    }

    try {
      // Dynamic import — el core NUNCA tiene static imports hacia plugins
      const module = await import(entryPoint);

      // Soporta export default o export named
      const PluginClass = module.default ?? module.TheForgePlugin;

      if (!PluginClass || typeof PluginClass !== "function") {
        this.logger.warn(
          `Plugin at ${pluginPath} does not export a class — skipping`,
        );
        return;
      }

      const instance = new PluginClass() as ITheForgePlugin;

      // Validación mínima del contrato
      if (!instance.id || typeof instance.id !== "string") {
        this.logger.warn(`Plugin at ${pluginPath} missing 'id' — skipping`);
        return;
      }
      if (!instance.version || typeof instance.version !== "string") {
        this.logger.warn(
          `Plugin at ${pluginPath} missing 'version' — skipping`,
        );
        return;
      }
      if (typeof instance.onPluginInit !== "function") {
        this.logger.warn(
          `Plugin at ${pluginPath} missing 'onPluginInit' — skipping`,
        );
        return;
      }

      // Evitar duplicados
      if (this.plugins.has(instance.id)) {
        this.logger.warn(
          `Plugin '${instance.id}' already loaded — skipping duplicate at ${pluginPath}`,
        );
        return;
      }

      // Contexto de inyección limitado
      const context = this.buildPluginContext(instance.id);

      // Inicialización del plugin
      await instance.onPluginInit(context);

      // Registro en el sistema
      this.plugins.set(instance.id, instance);
      this.registerHooks(instance);

      this.logger.log(
        `✅ Plugin loaded: ${instance.name} v${instance.version} (${instance.id})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`❌ Failed to load plugin ${pluginPath}: ${msg}`);

      const failOnError = this.configService.get<boolean>(
        "plugins.failOnPluginError",
        false,
      );
      if (failOnError) {
        throw new Error(
          `Plugin loading failed and failOnPluginError=true: ${msg}`,
        );
      }
      // FALLA GRACEFUL: el core continúa sin este plugin
    }
  }

  /** Construye el contexto limitado de inyección para un plugin */
  private buildPluginContext(pluginId: string): {
    getService: <T>(
      token: string | symbol | (new (...args: unknown[]) => T),
    ) => T;
    logger: Logger;
    config: Record<string, unknown>;
  } {
    return {
      getService: <T>(
        token: string | symbol | (new (...args: unknown[]) => T),
      ): T => {
        try {
          return this.moduleRef.get<T>(token as never, { strict: false });
        } catch {
          throw new Error(
            `Service '${String(token)}' not found or not exposed to plugins`,
          );
        }
      },
      logger: new Logger(`Plugin:${pluginId}`),
      config: this.configService.get<Record<string, unknown>>("plugins", {}),
    };
  }

  /** Registra los hooks de un plugin en los arrays correspondientes */
  private registerHooks(plugin: ITheForgePlugin): void {
    if (plugin.beforeDocumentRender) {
      this.beforeDocumentRenderHooks.push({
        pluginId: plugin.id,
        handler: plugin.beforeDocumentRender.bind(plugin),
      });
    }
    if (plugin.afterDocumentRender) {
      this.afterDocumentRenderHooks.push({
        pluginId: plugin.id,
        handler: plugin.afterDocumentRender.bind(plugin),
      });
    }
    if (plugin.afterDocumentPersist) {
      this.afterDocumentPersistHooks.push({
        pluginId: plugin.id,
        handler: plugin.afterDocumentPersist.bind(plugin),
      });
    }
    if (plugin.onProjectCreate) {
      this.onProjectCreateHooks.push({
        pluginId: plugin.id,
        handler: plugin.onProjectCreate.bind(plugin),
      });
    }
    if (plugin.onProjectUpdate) {
      this.onProjectUpdateHooks.push({
        pluginId: plugin.id,
        handler: plugin.onProjectUpdate.bind(plugin),
      });
    }
  }

  // ────────────────────────
  // API Pública — Hooks
  // ────────────────────────

  /** Ejecuta hooks beforeDocumentRender */
  async executeBeforeDocumentRender(
    payload: BeforeDocumentRenderPayload,
  ): Promise<BeforeDocumentRenderPayload> {
    let current = payload;
    for (const entry of this.beforeDocumentRenderHooks) {
      try {
        const result = await entry.handler(current);
        if (result !== undefined) current = result;
      } catch (err) {
        this.logHookError("beforeDocumentRender", entry.pluginId, err);
      }
    }
    return current;
  }

  /** Ejecuta hooks afterDocumentRender */
  async executeAfterDocumentRender(
    payload: AfterDocumentRenderPayload,
  ): Promise<AfterDocumentRenderPayload> {
    let current = payload;
    for (const entry of this.afterDocumentRenderHooks) {
      try {
        const result = await entry.handler(current);
        if (result !== undefined) current = result;
      } catch (err) {
        this.logHookError("afterDocumentRender", entry.pluginId, err);
      }
    }
    return current;
  }

  /** Ejecuta hooks afterDocumentPersist (fire-and-forget, no retorna nada) */
  async executeAfterDocumentPersist(
    payload: AfterDocumentPersistPayload,
  ): Promise<void> {
    for (const entry of this.afterDocumentPersistHooks) {
      try {
        await entry.handler(payload);
      } catch (err) {
        this.logHookError("afterDocumentPersist", entry.pluginId, err);
      }
    }
  }

  /** Ejecuta hooks onProjectCreate */
  async executeOnProjectCreate(
    payload: ProjectLifecyclePayload,
  ): Promise<void> {
    for (const entry of this.onProjectCreateHooks) {
      try {
        await entry.handler(payload);
      } catch (err) {
        this.logHookError("onProjectCreate", entry.pluginId, err);
      }
    }
  }

  /** Ejecuta hooks onProjectUpdate */
  async executeOnProjectUpdate(
    payload: ProjectLifecyclePayload,
  ): Promise<void> {
    for (const entry of this.onProjectUpdateHooks) {
      try {
        await entry.handler(payload);
      } catch (err) {
        this.logHookError("onProjectUpdate", entry.pluginId, err);
      }
    }
  }

  private logHookError(
    hookName: string,
    pluginId: string,
    err: unknown,
  ): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.error(`Hook '${hookName}' failed in plugin '${pluginId}': ${msg}`);
  }

  /** Obtiene la lista de directorios donde escanear plugins */
  private resolvePluginDirectories(): string[] {
    const fromEnv = this.configService.get<string>("plugins.directory");
    const dirs: string[] = [];
    if (fromEnv) dirs.push(fromEnv);

    // Try multiple locations for flexibility (dev from apps/api/, prod from dist/, etc.)
    const candidates = [
      resolve(process.cwd(), "plugins-enabled"),
      resolve(process.cwd(), "../../plugins-enabled"),
    ];
    for (const candidate of candidates) {
      if (!dirs.includes(candidate)) dirs.push(candidate);
    }

    return dirs;
  }

  // ────────────────────────
  // API Pública — Queries
  // ────────────────────────

  /** Número de plugins cargados */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /** Obtiene un plugin por su ID */
  getPlugin(id: string): ITheForgePlugin | undefined {
    return this.plugins.get(id);
  }

  /** Lista de IDs de plugins cargados */
  getPluginIds(): string[] {
    return [...this.plugins.keys()];
  }

  /** Obtiene los artifact types registrados por todos los plugins */
  getArtifactTypes(): ArtifactTypeDefinition[] {
    const types: ArtifactTypeDefinition[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.getArtifactTypes) {
        const pluginTypes = plugin.getArtifactTypes();
        if (Array.isArray(pluginTypes)) {
          types.push(...pluginTypes);
        }
      }
    }
    return types;
  }

  /** Verifica si al menos un hook de un tipo está registrado */
  hasHooks(hookName: "beforeDocumentRender" | "afterDocumentRender" | "afterDocumentPersist" | "onProjectCreate" | "onProjectUpdate"): boolean {
    switch (hookName) {
      case "beforeDocumentRender":
        return this.beforeDocumentRenderHooks.length > 0;
      case "afterDocumentRender":
        return this.afterDocumentRenderHooks.length > 0;
      case "afterDocumentPersist":
        return this.afterDocumentPersistHooks.length > 0;
      case "onProjectCreate":
        return this.onProjectCreateHooks.length > 0;
      case "onProjectUpdate":
        return this.onProjectUpdateHooks.length > 0;
      default:
        return false;
    }
  }
}
