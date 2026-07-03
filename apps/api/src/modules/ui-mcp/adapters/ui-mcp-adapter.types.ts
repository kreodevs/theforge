/**
 * @fileoverview Contrato de adaptadores genéricos para MCPs UI no nativos.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import type {
  DescribeCapabilitiesResult,
  GetDesignTokensResult,
  ListComponentsResult,
  ListScreensArgs,
  ListScreensResult,
  ResolveComponentArgs,
  ResolveComponentResult,
} from "@theforge/shared-types";
import type { UiMcpConnection } from "../ui-mcp-transport.util.js";

/** Adaptador que traduce tools nativos de un MCP externo al contrato UI de The Forge. */
export interface UiMcpAdapter {
  readonly id: string;
  readonly label: string;
  /** Tools del MCP externo que deben estar presentes para activar este adaptador. */
  readonly requiredTools: readonly string[];
  describeCapabilities(conn: UiMcpConnection): Promise<DescribeCapabilitiesResult>;
  listComponents(conn: UiMcpConnection): Promise<ListComponentsResult>;
  resolveComponent(
    conn: UiMcpConnection,
    args: ResolveComponentArgs,
  ): Promise<ResolveComponentResult>;
  listScreens?(conn: UiMcpConnection, args: ListScreensArgs): Promise<ListScreensResult | null>;
  getDesignTokens?(conn: UiMcpConnection): Promise<GetDesignTokensResult | null>;
}
