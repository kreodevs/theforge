import { Injectable } from "@nestjs/common";
import { PluginLoaderService } from "./plugin-loader.service.js";
import type {
  AfterDocumentPersistPayload,
  AfterDocumentRenderPayload,
  BeforeDocumentRenderPayload,
  ProjectLifecyclePayload,
} from "./types/plugin-payloads.js";

/**
 * Wrapper del core sobre hooks de documentos y ciclo de vida de proyecto.
 * Punto único de invocación desde generadores LLM y persistencia.
 */
@Injectable()
export class PluginDocumentPipelineService {
  constructor(private readonly pluginLoader: PluginLoaderService) {}

  hasDocumentHooks(): boolean {
    return (
      this.pluginLoader.hasHooks("beforeDocumentRender") ||
      this.pluginLoader.hasHooks("afterDocumentRender")
    );
  }

  runBeforeDocumentRender(
    payload: BeforeDocumentRenderPayload,
  ): Promise<BeforeDocumentRenderPayload> {
    return this.pluginLoader.executeBeforeDocumentRender(payload);
  }

  runAfterDocumentRender(
    payload: AfterDocumentRenderPayload,
  ): Promise<AfterDocumentRenderPayload> {
    return this.pluginLoader.executeAfterDocumentRender(payload);
  }

  async runAfterDocumentPersist(payload: AfterDocumentPersistPayload): Promise<void> {
    await this.pluginLoader.executeAfterDocumentPersist(payload);
  }

  async runOnProjectCreate(payload: ProjectLifecyclePayload): Promise<void> {
    await this.pluginLoader.executeOnProjectCreate(payload);
  }

  async runOnProjectUpdate(payload: ProjectLifecyclePayload): Promise<void> {
    await this.pluginLoader.executeOnProjectUpdate(payload);
  }
}
