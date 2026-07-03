/**
 * @fileoverview **UiComponentResolver** — abstracción pluggable para resolver el componente UI de
 * una entidad de dominio.
 *
 * - {@link HeuristicUiComponentResolver}: comportamiento actual (usa el componente genérico que ya
 *   computan las heurísticas de `mdd-enrich-uiux-intent` / `blueprint-enrich-ui-system`).
 * - {@link McpUiComponentResolver}: consulta `resolve_component` del MCP gráfico activo y compatible;
 *   ante error / no soportado, hace **fallback por-entidad** al componente heurístico.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import type { EntityClassification } from "@theforge/shared-types";

/** Entrada al resolver. `heuristicComponent` es el componente que el llamador ya calculó por heurística. */
export interface UiResolverEntityInput {
  name: string;
  classification: EntityClassification;
  keyFields?: string[];
  lifecycleStates?: string[];
  restEndpoint?: string;
  /** Componente genérico calculado por la heurística existente (base y fallback). */
  heuristicComponent: string;
}

/** Resultado del resolver: componente + procedencia. */
export interface ResolvedUiComponent {
  componentType: string;
  package?: string;
  version?: string;
  propMapping?: Record<string, string>;
  confidence?: number;
  source: "heuristic" | "mcp";
}

/** Contrato del resolver de componentes UI. */
export interface UiComponentResolver {
  resolve(input: UiResolverEntityInput): Promise<ResolvedUiComponent>;
}

/** Resolver heurístico: devuelve el componente genérico sin cambios (comportamiento por defecto). */
export class HeuristicUiComponentResolver implements UiComponentResolver {
  async resolve(input: UiResolverEntityInput): Promise<ResolvedUiComponent> {
    return { componentType: input.heuristicComponent, source: "heuristic" };
  }
}

/** Subconjunto del cliente MCP necesario para resolver componentes (facilita testing). */
export interface UiMcpResolveCapableClient {
  resolveComponent(args: {
    entityName: string;
    classification?: EntityClassification;
    keyFields?: string[];
    lifecycleStates?: string[];
    restEndpoint?: string;
  }): Promise<{
    component: string;
    package: string;
    version: string;
    propMapping?: Record<string, string>;
    confidence?: number;
  } | null>;
}

/** Resolver basado en MCP con fallback por-entidad al heurístico. */
export class McpUiComponentResolver implements UiComponentResolver {
  constructor(private readonly client: UiMcpResolveCapableClient) {}

  async resolve(input: UiResolverEntityInput): Promise<ResolvedUiComponent> {
    let resolved: Awaited<ReturnType<UiMcpResolveCapableClient["resolveComponent"]>> = null;
    try {
      resolved = await this.client.resolveComponent({
        entityName: input.name,
        classification: input.classification,
        keyFields: input.keyFields,
        lifecycleStates: input.lifecycleStates,
        restEndpoint: input.restEndpoint,
      });
    } catch {
      resolved = null;
    }
    if (!resolved || !resolved.component) {
      return { componentType: input.heuristicComponent, source: "heuristic" };
    }
    return {
      componentType: resolved.component,
      package: resolved.package,
      version: resolved.version,
      propMapping: resolved.propMapping,
      confidence: resolved.confidence,
      source: "mcp",
    };
  }
}

/** Resolver heurístico compartido (sin estado). */
export const heuristicUiComponentResolver = new HeuristicUiComponentResolver();
