/**
 * @fileoverview **UiMcpClientService** — cliente de alto nivel del MCP gráfico **activo y compatible**.
 *
 * Resuelve la conexión desde {@link UiMcpService.getActiveCompatibleConnection} (no lee env) y expone
 * los tools del contrato UI parseados con Zod. Cualquier error devuelve `null` para permitir el
 * fallback por-entidad al resolver heurístico.
 *
 * Si la instancia usa un adaptador genérico (p. ej. Kreo), las llamadas se enrutan por el adaptador.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { Injectable, Logger } from "@nestjs/common";
import {
  GetDesignTokensResult,
  ListComponentsResult,
  ListScreensArgs,
  ResolveComponentArgs,
  ResolveComponentResult,
  ScreenSpec,
  UiComponentDescriptor,
  getDesignTokensResultSchema,
  listComponentsResultSchema,
  listScreensArgsSchema,
  listScreensResultSchema,
  resolveComponentArgsSchema,
  resolveComponentResultSchema,
} from "@theforge/shared-types";
import type { UiMcpAdapter } from "./adapters/ui-mcp-adapter.types.js";
import { UiMcpService } from "./ui-mcp.service.js";
import { UiMcpConnection, callUiMcpToolJson } from "./ui-mcp-transport.util.js";

@Injectable()
export class UiMcpClientService {
  private readonly logger = new Logger(UiMcpClientService.name);

  constructor(private readonly uiMcp: UiMcpService) {}

  /** ¿Hay MCP gráfico compatible activo? Gate para feature/deliverables. */
  async isActive(): Promise<boolean> {
    return this.uiMcp.hasActiveCompatible();
  }

  private async session(): Promise<{
    connection: UiMcpConnection;
    supports: { resolveComponent: boolean; listScreens: boolean; designTokens: boolean };
    adapter: UiMcpAdapter | null;
  } | null> {
    return this.uiMcp.getActiveCompatibleConnection();
  }

  /** Catálogo de componentes del MCP (`list_components`). Devuelve [] ante error. */
  async listComponents(): Promise<UiComponentDescriptor[]> {
    const active = await this.session();
    if (!active) return [];
    try {
      if (active.adapter) {
        const parsed: ListComponentsResult = await active.adapter.listComponents(active.connection);
        return parsed.components;
      }
      const raw = await callUiMcpToolJson<unknown>(active.connection, "list_components", {});
      if (!raw) return [];
      const parsed: ListComponentsResult = listComponentsResultSchema.parse(raw);
      return parsed.components;
    } catch (err) {
      this.logger.warn(`[UiMcp] list_components falló: ${this.msg(err)}`);
      return [];
    }
  }

  /** Resuelve un componente real para una entidad (`resolve_component`). `null` → fallback heurístico. */
  async resolveComponent(args: ResolveComponentArgs): Promise<ResolveComponentResult | null> {
    const active = await this.session();
    if (!active || !active.supports.resolveComponent) return null;
    try {
      const payload = resolveComponentArgsSchema.parse(args);
      if (active.adapter) {
        return await active.adapter.resolveComponent(active.connection, payload);
      }
      const raw = await callUiMcpToolJson<unknown>(active.connection, "resolve_component", payload);
      if (!raw) return null;
      return resolveComponentResultSchema.parse(raw);
    } catch (err) {
      this.logger.warn(`[UiMcp] resolve_component(${args.entityName}) falló: ${this.msg(err)}`);
      return null;
    }
  }

  /** Lista de pantallas (`list_screens`). `null` si el MCP no soporta o falla. */
  async listScreens(args: ListScreensArgs): Promise<ScreenSpec[] | null> {
    const active = await this.session();
    if (!active || !active.supports.listScreens) return null;
    try {
      const payload = listScreensArgsSchema.parse(args);
      if (active.adapter?.listScreens) {
        const result = await active.adapter.listScreens(active.connection, payload);
        return result?.screens ?? null;
      }
      const raw = await callUiMcpToolJson<unknown>(active.connection, "list_screens", payload);
      if (!raw) return null;
      return listScreensResultSchema.parse(raw).screens;
    } catch (err) {
      this.logger.warn(`[UiMcp] list_screens falló: ${this.msg(err)}`);
      return null;
    }
  }

  /** Tokens de design system (`get_design_tokens`). `null` si el MCP no soporta o falla. */
  async getDesignTokens(): Promise<GetDesignTokensResult | null> {
    const active = await this.session();
    if (!active || !active.supports.designTokens) return null;
    try {
      if (active.adapter?.getDesignTokens) {
        return await active.adapter.getDesignTokens(active.connection);
      }
      const raw = await callUiMcpToolJson<unknown>(active.connection, "get_design_tokens", {});
      if (!raw) return null;
      return getDesignTokensResultSchema.parse(raw);
    } catch (err) {
      this.logger.warn(`[UiMcp] get_design_tokens falló: ${this.msg(err)}`);
      return null;
    }
  }

  private msg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
