/** Marcador embebido al final de uiScreensContent para exportar ui-project.json. */
export const UI_PROJECT_JSON_MARKER = "---UI_PROJECT_JSON---";

function extractJsonFromAnnexTail(tail: string): string | null {
  let jsonPart = tail.trim();
  if (!jsonPart) return null;

  const fenced = jsonPart.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenced) jsonPart = fenced[1]!.trim();

  if (!jsonPart.startsWith("{")) return null;

  try {
    return JSON.stringify(JSON.parse(jsonPart), null, 2);
  } catch {
    return jsonPart;
  }
}

/** Separa pantallas legibles del JSON de prototipo embebido. */
export function splitPantallasAndUiProject(combined: string): {
  pantallas: string;
  uiProjectJson: string | null;
} {
  const text = (combined ?? "").trim();
  if (!text) return { pantallas: "", uiProjectJson: null };

  const idx = text.indexOf(UI_PROJECT_JSON_MARKER);
  if (idx === -1) return { pantallas: text, uiProjectJson: null };

  const pantallas = text.slice(0, idx).trimEnd();
  const jsonPart = extractJsonFromAnnexTail(text.slice(idx + UI_PROJECT_JSON_MARKER.length));
  if (!jsonPart) return { pantallas: text, uiProjectJson: null };

  return { pantallas: pantallas ? `${pantallas}\n` : "", uiProjectJson: jsonPart };
}

/** Markdown legible del anexo ui-project.json (preview Workshop / export parcial). */
export function formatPantallasUiProjectAnnex(uiProjectJson: string): string {
  const json = extractJsonFromAnnexTail(uiProjectJson) ?? uiProjectJson.trim();
  return (
    "## Anexo — ui-project.json\n\n" +
    "> Instrucciones `UiProjectInstructions` para MCP gráfico (prototipo). " +
    "El marcador interno se conserva en modo fuente para export spec-kit.\n\n" +
    "```json\n" +
    json +
    "\n```\n"
  );
}

/** Preview Workshop: tablas markdown + JSON del anexo en bloque formateado (sin wall of text). */
export function formatPantallasMarkdownForPreview(combined: string): string {
  const text = (combined ?? "").trim();
  if (!text) return text;

  const { pantallas, uiProjectJson } = splitPantallasAndUiProject(text);
  if (!uiProjectJson) return text;

  const base = pantallas.trimEnd();
  const annex = formatPantallasUiProjectAnnex(uiProjectJson).trimEnd();
  return base ? `${base}\n\n${annex}\n` : `${annex}\n`;
}

/** Contenido de `pantallas.md` sin el anexo JSON embebido. */
export function exportPantallasMarkdownOnly(combined: string | null | undefined): string {
  const trimmed = (combined ?? "").trim();
  if (!trimmed) return "";
  const { pantallas } = splitPantallasAndUiProject(trimmed);
  return pantallas.trim() || trimmed;
}

/**
 * Reconstruye el formato persistido en `Project.uiScreensContent`
 * (markdown + marcador + fence JSON) a partir de pantallas.md y ui-project.json del export.
 */
export function joinPantallasAndUiProject(
  pantallas: string | null | undefined,
  uiProjectJson: string | null | undefined,
): string {
  const base = (pantallas ?? "").trim();
  let json = (uiProjectJson ?? "").trim();
  if (json) {
    try {
      json = JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      // keep raw
    }
  }
  if (!json) return base;
  if (!base) return `${UI_PROJECT_JSON_MARKER}\n\n\`\`\`json\n${json}\n\`\`\`\n`;
  return `${base}\n\n${UI_PROJECT_JSON_MARKER}\n\n\`\`\`json\n${json}\n\`\`\`\n`;
}
