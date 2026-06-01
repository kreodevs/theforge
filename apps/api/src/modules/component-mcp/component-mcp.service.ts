import { Injectable } from "@nestjs/common";
import type { ComponentSourcePort } from "@theforge/component-source";
import { ComponentSourceRegistry } from "../component-source/component-source.registry.js";

/**
 * @deprecated Use ComponentSourceRegistry.resolveForUser() instead.
 * Thin facade kept for backward-compatible imports.
 */
@Injectable()
export class ComponentMcpService {
  constructor(private readonly registry: ComponentSourceRegistry) {}

  private async port(userId: string): Promise<ComponentSourcePort> {
    return this.registry.resolveForUser(userId);
  }

  async searchModules(userId: string, query: string) {
    return (await this.port(userId)).searchModules(userId, query);
  }

  async resolveComponents(userId: string, names: string[]) {
    return (await this.port(userId)).resolveComponents(userId, names);
  }

  async getComponent(userId: string, moduleId: string, exportName?: string) {
    return (await this.port(userId)).getComponent(userId, moduleId, exportName);
  }

  async getProps(userId: string, moduleId: string, exportName?: string) {
    return (await this.port(userId)).getProps(userId, moduleId, exportName);
  }

  async getCompositionRecipe(userId: string, moduleId: string) {
    return (await this.port(userId)).getCompositionRecipe(userId, moduleId);
  }

  async listModules(userId: string) {
    return (await this.port(userId)).listModules(userId);
  }

  async catalogHealth(userId: string) {
    return (await this.port(userId)).catalogHealth(userId);
  }

  async getStyleRules(userId: string) {
    return (await this.port(userId)).getStyleRules(userId);
  }

  async getDesignSystem(
    userId: string,
    args?: Parameters<ComponentSourcePort["getDesignSystem"]>[1],
  ) {
    return (await this.port(userId)).getDesignSystem(userId, args);
  }

  async getComponentPreview(
    userId: string,
    args: Parameters<ComponentSourcePort["getComponentPreview"]>[1],
  ) {
    return (await this.port(userId)).getComponentPreview(userId, args);
  }

  async getComponentPreviews(
    userId: string,
    args: Parameters<ComponentSourcePort["getComponentPreviews"]>[1],
  ) {
    return (await this.port(userId)).getComponentPreviews(userId, args);
  }

  async getProductionSnippet(
    userId: string,
    moduleId: string,
    options?: Parameters<ComponentSourcePort["getProductionSnippet"]>[2],
  ) {
    return (await this.port(userId)).getProductionSnippet(userId, moduleId, options);
  }

  async checkHealth(userId: string) {
    return (await this.port(userId)).checkHealth(userId);
  }

  async testConnection(opts: Parameters<ComponentSourceRegistry["testConnection"]>[0]) {
    return this.registry.testConnection(opts);
  }
}
