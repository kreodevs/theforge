/** Marcador embebido al final de uiScreensContent para exportar ui-project.json. */
export const UI_PROJECT_JSON_MARKER = "---UI_PROJECT_JSON---";

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
  const jsonPart = text.slice(idx + UI_PROJECT_JSON_MARKER.length).trim();
  if (!jsonPart.startsWith("{")) return { pantallas: text, uiProjectJson: null };

  return { pantallas: pantallas ? `${pantallas}\n` : "", uiProjectJson: jsonPart };
}
