/**
 * @fileoverview Construye la sección de **Design System inferido del MCP gráfico** para anexar a la
 * Guía UX/UI (DESIGN.md) cuando hay un MCP compatible activo. Si no hay tokens ni componentes útiles,
 * devuelve `null` y el llamador conserva el design system heurístico/Ariadne actual.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import type { GetDesignTokensResult, UiComponentDescriptor } from "@theforge/shared-types";

export interface UiDesignSystemSectionInput {
  tokens: GetDesignTokensResult | null;
  components: UiComponentDescriptor[];
  libraryName?: string | null;
  libraryVersion?: string | null;
}

function recordRows(record: Record<string, unknown> | undefined, max = 24): string[] {
  if (!record) return [];
  return Object.entries(record)
    .slice(0, max)
    .map(([k, v]) => `| \`${k}\` | ${typeof v === "object" ? JSON.stringify(v) : String(v)} |`);
}

/** Marcador para detectar/no duplicar la sección al regenerar. */
export const UI_MCP_DESIGN_SYSTEM_HEADING = "## Design System (inferido del MCP gráfico)";

/** Genera la sección markdown; `null` si no hay contenido aprovechable. */
export function buildUiMcpDesignSystemSection(input: UiDesignSystemSectionInput): string | null {
  const { tokens, components } = input;
  const hasTokens =
    !!tokens &&
    (tokens.colors || tokens.typography || tokens.spacing || tokens.radii || tokens.shadows);
  if (!hasTokens && components.length === 0) return null;

  const lines: string[] = [];
  lines.push(UI_MCP_DESIGN_SYSTEM_HEADING);
  lines.push("");
  const lib = input.libraryName
    ? `${input.libraryName}${input.libraryVersion ? ` ${input.libraryVersion}` : ""}`
    : "MCP gráfico conectado";
  lines.push(
    `> Design system inferido de **${lib}** vía el MCP gráfico compatible activo. Sustituye la ` +
      "inferencia heurística/Ariadne mientras el MCP esté conectado.",
  );
  lines.push("");

  if (tokens?.colors && Object.keys(tokens.colors).length > 0) {
    lines.push("### Colores");
    lines.push("");
    lines.push("| Token | Valor |");
    lines.push("|---|---|");
    lines.push(...recordRows(tokens.colors));
    lines.push("");
  }
  if (tokens?.typography && Object.keys(tokens.typography).length > 0) {
    lines.push("### Tipografía");
    lines.push("");
    lines.push("| Token | Valor |");
    lines.push("|---|---|");
    lines.push(...recordRows(tokens.typography));
    lines.push("");
  }
  if (tokens?.spacing && Object.keys(tokens.spacing).length > 0) {
    lines.push("### Espaciado");
    lines.push("");
    lines.push("| Token | Valor |");
    lines.push("|---|---|");
    lines.push(...recordRows(tokens.spacing));
    lines.push("");
  }
  if (tokens?.radii && Object.keys(tokens.radii).length > 0) {
    lines.push("### Radios");
    lines.push("");
    lines.push("| Token | Valor |");
    lines.push("|---|---|");
    lines.push(...recordRows(tokens.radii));
    lines.push("");
  }

  if (components.length > 0) {
    lines.push("### Catálogo de componentes");
    lines.push("");
    lines.push("| Componente | Paquete | Reemplaza (genérico) |");
    lines.push("|---|---|---|");
    for (const c of components.slice(0, 60)) {
      const pkg = `\`${c.package}@${c.version}\``;
      const replaces = c.replacesGeneric.length > 0 ? c.replacesGeneric.map((r) => `\`${r}\``).join(", ") : "—";
      lines.push(`| \`${c.name}\` | ${pkg} | ${replaces} |`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
