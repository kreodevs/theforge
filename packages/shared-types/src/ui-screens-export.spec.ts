import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  exportPantallasMarkdownOnly,
  formatPantallasMarkdownForPreview,
  joinPantallasAndUiProject,
  splitPantallasAndUiProject,
  UI_PROJECT_JSON_MARKER,
} from "./ui-screens-export.js";

describe("ui-screens-export", () => {
  it("split separa markdown legible del JSON embebido (legacy sin fence)", () => {
    const combined =
      "# Pantallas\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n" +
      `${UI_PROJECT_JSON_MARKER}\n{"version":"1.0.0","project":{"slug":"x"}}\n`;
    const { pantallas, uiProjectJson } = splitPantallasAndUiProject(combined);
    assert.match(pantallas, /^# Pantallas/);
    assert.ok(!pantallas.includes(UI_PROJECT_JSON_MARKER));
    assert.ok(uiProjectJson?.includes('"version": "1.0.0"'));
  });

  it("split extrae JSON desde fence ```json tras el marcador", () => {
    const combined =
      "# Pantallas\n\n" +
      `${UI_PROJECT_JSON_MARKER}\n\n\`\`\`json\n{"version":"1.0.0"}\n\`\`\`\n`;
    const { pantallas, uiProjectJson } = splitPantallasAndUiProject(combined);
    assert.match(pantallas, /^# Pantallas/);
    assert.equal(uiProjectJson, '{\n  "version": "1.0.0"\n}');
  });

  it("formatPantallasMarkdownForPreview envuelve JSON en bloque legible", () => {
    const raw =
      "# Pantallas — Demo\n\n## Admin\n\n| Ruta | Página |\n|------|--------|\n| / | Home |\n\n" +
      `${UI_PROJECT_JSON_MARKER}\n{"version":"1.0.0","screens":[]}\n`;
    const preview = formatPantallasMarkdownForPreview(raw);
    assert.ok(preview.includes("## Anexo — ui-project.json"));
    assert.ok(preview.includes("```json"));
    assert.ok(!preview.includes(UI_PROJECT_JSON_MARKER));
    assert.ok(preview.includes('"version": "1.0.0"'));
    assert.ok(preview.includes("| / | Home |"));
  });

  it("exportPantallasMarkdownOnly omite el anexo JSON", () => {
    const raw = "# Pantallas\n\n" + `${UI_PROJECT_JSON_MARKER}\n{}\n`;
    assert.equal(exportPantallasMarkdownOnly(raw), "# Pantallas");
  });

  it("joinPantallasAndUiProject reconstruye marcador + fence", () => {
    const joined = joinPantallasAndUiProject("# Pantallas", '{"version":"1.0.0"}');
    assert.match(joined, /^# Pantallas/);
    assert.ok(joined.includes(UI_PROJECT_JSON_MARKER));
    assert.ok(joined.includes("```json"));
    assert.ok(joined.includes('"version": "1.0.0"'));
  });
});
