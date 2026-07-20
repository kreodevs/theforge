import { Module } from "@nestjs/common";
import { PluginLoaderService, PLUGIN_LOADER_SERVICE } from "./plugin-loader.service.js";
import { PluginUserSettingsService } from "./plugin-user-settings.service.js";
import { PluginDocumentPipelineService } from "./plugin-document-pipeline.service.js";
import { PluginArtifactService } from "./plugin-artifact.service.js";
import { PrismaModule } from "../prisma/prisma.module.js";

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
  imports: [PrismaModule],
  providers: [
    PluginLoaderService,
    PluginDocumentPipelineService,
    PluginArtifactService,
    PluginUserSettingsService,
    {
      provide: PLUGIN_LOADER_SERVICE,
      useExisting: PluginLoaderService,
    },
  ],
  exports: [
    PluginLoaderService,
    PLUGIN_LOADER_SERVICE,
    PluginDocumentPipelineService,
    PluginArtifactService,
    PluginUserSettingsService,
  ],
})
export class PluginModule {}
