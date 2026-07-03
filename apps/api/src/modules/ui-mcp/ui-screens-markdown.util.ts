/**
 * @fileoverview Ensamblador del deliverable **"Pantallas / UI Screens Spec"** (texto).
 *
 * Convierte la spec estructurada (`ScreenSpec[]`) del MCP gráfico en un documento markdown de texto:
 * por cada pantalla, su propósito, los componentes reales (nombre + paquete/versión), la entidad
 * asociada y las props/binding a endpoints. **Sin bloques TSX ni preview** — se muestra con la vista
 * markdown normal.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import type { ScreenSpec } from "@theforge/shared-types";

export interface UiScreensMarkdownMeta {
  libraryName?: string | null;
  libraryVersion?: string | null;
  contractVersion?: string | null;
  generatedAt?: Date;
}

function componentLabel(c: ScreenSpec["components"][number]): string {
  const pkg = c.package ? ` \`${c.package}${c.version ? `@${c.version}` : ""}\`` : "";
  return `\`${c.component}\`${pkg}`;
}

/** Genera el markdown del deliverable "Pantallas". Devuelve `null` si no hay pantallas. */
export function buildUiScreensMarkdown(
  screens: ScreenSpec[],
  meta: UiScreensMarkdownMeta = {},
): string | null {
  if (!screens || screens.length === 0) return null;

  const lines: string[] = [];
  lines.push("# Pantallas / UI Screens Spec");
  lines.push("");
  lines.push(
    "> Documento generado a partir del MCP gráfico compatible activo. Lista las pantallas de la " +
      "aplicación con los componentes reales de la librería conectada, la entidad de dominio asociada " +
      "y el binding de props a endpoints. Es una especificación de texto: no incluye código ni preview.",
  );
  lines.push("");

  const libLine: string[] = [];
  if (meta.libraryName) {
    libLine.push(`**Librería:** ${meta.libraryName}${meta.libraryVersion ? ` ${meta.libraryVersion}` : ""}`);
  }
  if (meta.contractVersion) libLine.push(`**Contrato UI MCP:** ${meta.contractVersion}`);
  if (libLine.length > 0) {
    lines.push(libLine.join(" · "));
    lines.push("");
  }

  lines.push(`**Pantallas:** ${screens.length}`);
  lines.push("");

  for (const [idx, screen] of screens.entries()) {
    lines.push(`## ${idx + 1}. ${screen.name}`);
    lines.push("");
    if (screen.purpose) {
      lines.push(screen.purpose);
      lines.push("");
    }

    if (screen.components.length > 0) {
      lines.push("### Componentes");
      lines.push("");
      lines.push("| Componente | Entidad | Props / Binding |");
      lines.push("|---|---|---|");
      for (const c of screen.components) {
        const props =
          Object.keys(c.props).length > 0
            ? Object.entries(c.props)
                .map(([k, v]) => `\`${k}\`: ${v}`)
                .join("; ")
            : "—";
        lines.push(`| ${componentLabel(c)} | ${c.entity ? `\`${c.entity}\`` : "—"} | ${props} |`);
      }
      lines.push("");
    }

    if (screen.endpoints.length > 0) {
      lines.push("### Endpoints");
      lines.push("");
      for (const ep of screen.endpoints) {
        lines.push(`- \`${ep}\``);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
