import { Injectable } from "@nestjs/common";
import type { ComponentSourcePort } from "@theforge/component-source";
import { ComponentSourceRegistry } from "../component-source/component-source.registry.js";

/**
 * @deprecated Use ComponentSourceRegistry.resolveForProject() instead.
 * Thin facade kept for backward-compatible imports; not wired in AppModule.
 */
@Injectable()
export class ComponentMcpService {
  constructor(private readonly registry: ComponentSourceRegistry) {}

  private async portForProject(projectId: string): Promise<ComponentSourcePort> {
    const ctx = await this.registry.resolveForProject(projectId);
    return ctx.port;
  }

  async searchModules(projectId: string, userId: string, query: string) {
    return (await this.portForProject(projectId)).searchModules(userId, query);
  }

  async resolveComponents(projectId: string, userId: string, names: string[]) {
    return (await this.portForProject(projectId)).resolveComponents(userId, names);
  }

  async getComponent(projectId: string, userId: string, moduleId: string, exportName?: string) {
    return (await this.portForProject(projectId)).getComponent(userId, moduleId, exportName);
  }

  async getProps(projectId: string, userId: string, moduleId: string, exportName?: string) {
    return (await this.portForProject(projectId)).getProps(userId, moduleId, exportName);
  }

  async getCompositionRecipe(projectId: string, userId: string, moduleId: string) {
    return (await this.portForProject(projectId)).getCompositionRecipe(userId, moduleId);
  }

  async listModules(projectId: string, userId: string) {
    return (await this.portForProject(projectId)).listModules(userId);
  }

  async catalogHealth(projectId: string, userId: string) {
    return (await this.portForProject(projectId)).catalogHealth(userId);
  }

  async getStyleRules(projectId: string, userId: string) {
    return (await this.portForProject(projectId)).getStyleRules(userId);
  }

  async getDesignSystem(
    projectId: string,
    userId: string,
    args?: Parameters<ComponentSourcePort["getDesignSystem"]>[1],
  ) {
    return (await this.portForProject(projectId)).getDesignSystem(userId, args);
  }

  async getComponentPreview(
    projectId: string,
    userId: string,
    args: Parameters<ComponentSourcePort["getComponentPreview"]>[1],
  ) {
    return (await this.portForProject(projectId)).getComponentPreview(userId, args);
  }

  async getComponentPreviews(
    projectId: string,
    userId: string,
    args: Parameters<ComponentSourcePort["getComponentPreviews"]>[1],
  ) {
    return (await this.portForProject(projectId)).getComponentPreviews(userId, args);
  }

  async checkHealth(projectId: string, userId: string) {
    return (await this.portForProject(projectId)).checkHealth(userId);
  }

  async testConnection(opts: Parameters<ComponentSourceRegistry["testConnection"]>[0]) {
    return this.registry.testConnection(opts);
  }
}
