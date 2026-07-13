import { Module } from "@nestjs/common";
import { PluginLoaderService, PLUGIN_LOADER_SERVICE } from "./plugin-loader.service.js";

/**
 * Módulo de plugins dinámicos de The Forge.
 *
 * Registra el PluginLoaderService como provider global.
 * El loader escanea directorios configurados al arrancar,
 * carga plugins vía dynamic import(), y registra sus hooks.
 *
 * Cero dependencias de lógica comercial. 100% agnóstico.
 */
@Module({
  providers: [
    PluginLoaderService,
    {
      provide: PLUGIN_LOADER_SERVICE,
      useExisting: PluginLoaderService,
    },
  ],
  exports: [PluginLoaderService, PLUGIN_LOADER_SERVICE],
})
export class PluginModule {}
