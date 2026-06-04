/** Encabezado de la sección MCP en MDD/BRD (sincronizada al importar design system). */
export const MCP_DESIGN_SYSTEM_SECTION_HEADING = "Design System (MCP)" as const;

const SECTION_HEADING_PATTERN = /^##\s+Design System \(MCP\)\s*$/im;
const HEX_COLOR = /#[0-9A-Fa-f]{3,8}\b/;

export function hasMcpDesignSystemSection(doc: string | null | undefined): boolean {
  return SECTION_HEADING_PATTERN.test((doc ?? "").trim());
}

/**
 * DESIGN.md / guía UX/UI utilizable como design system MCP (tokens o paleta explícita).
 * Si no pasa, el taller y el pipeline pueden generar o mantener guía vía LLM.
 */
export function isValidMcpDesignGuideContent(designMd: string | null | undefined): boolean {
  const t = (designMd ?? "").trim();
  if (t.length < 120) return false;
  if (t.startsWith("[MCP_ERROR]")) return false;

  const fm = t.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm) {
    const yaml = fm[1] ?? "";
    if (/^\s*colors\s*:/im.test(yaml) && HEX_COLOR.test(yaml)) return true;
    if (/primary\s*:/i.test(yaml) && HEX_COLOR.test(yaml)) return true;
  }

  if (/^##\s+Colors\b/im.test(t) && HEX_COLOR.test(t)) return true;

  return false;
}

export type McpDesignSystemSourceInput = {
  uxUiGuideContent?: string | null;
  mddContent?: string | null;
  brdContent?: string | null;
};

/**
 * Usar design system MCP (inyección en MDD, no sobrescribir guía con LLM) solo si la guía es válida.
 */
export function shouldUseMcpDesignSystem(input: McpDesignSystemSourceInput): boolean {
  return isValidMcpDesignGuideContent(input.uxUiGuideContent);
}

/**
 * @deprecated Usar {@link shouldUseMcpDesignSystem} — ya no exige sección MCP en MDD/BRD.
 */
export function shouldPreserveImportedDesignGuide(input: McpDesignSystemSourceInput): boolean {
  return shouldUseMcpDesignSystem(input);
}
