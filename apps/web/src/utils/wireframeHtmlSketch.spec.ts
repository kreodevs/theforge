import { describe, expect, it } from "vitest";
import { buildWireframeHtmlSketchSrcDoc, parseWireframeAscii } from "./wireframeHtmlSketch";

const COTIZACION_ASCII = `
┌─────────────────────────────────────────────────────────────┐
│ LOGO   [Menu]                         [Usuario]             │
├─────────────────────────────────────────────────────────────┤
│ Seleccionar Tarifario [ v ] (Modal)                         │
├──────────────────────────┬──────────────────────────────────┤
│ Medios disponibles       │ Tabla de medios seleccionados    │
│ (DataTable)              │ (DataTable)                      │
├──────────────────────────┴──────────────────────────────────┤
│ Precio total: $ 1 234,56    [Calcular] [Guardar]              │
│              [ Añadir medio ] [ Reset ]                       │
└─────────────────────────────────────────────────────────────┘
`.trim();

describe("wireframeHtmlSketch", () => {
  it("parses multi-row campaign wireframe", () => {
    const rows = parseWireframeAscii(COTIZACION_ASCII);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.some((r) => r.kind === "split")).toBe(true);
  });

  it("builds HTML with tables and action buttons", () => {
    const doc = buildWireframeHtmlSketchSrcDoc({
      screenTitle: "Cotización de campaña",
      wireframeAscii: COTIZACION_ASCII,
      requirementsContext: "- El usuario selecciona medios del tarifario",
    });
    expect(doc).toContain("<table");
    expect(doc).toContain("Calcular");
    expect(doc).toContain("Precio total");
    expect(doc).toContain("Tarifario");
  });

  it("builds HTML solo desde componentes DS (sin wireframe ASCII)", () => {
    const doc = buildWireframeHtmlSketchSrcDoc({
      screenTitle: "Listado",
      dsComponents: [
        { requiredComponent: "Tabla de medios (DataTable)", dsModule: "@ds/table", exportName: "Table", props: "{}" },
        { requiredComponent: "Botón Guardar", dsModule: "@ds/button", exportName: "Button", props: "{}" },
      ],
    });
    expect(doc).toContain("<table");
    expect(doc).toContain("Guardar");
  });
});
