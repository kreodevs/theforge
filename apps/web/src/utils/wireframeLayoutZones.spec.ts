import { describe, expect, it } from "vitest";
import { parseWireframeAscii, splitLineIntoZones } from "./wireframeLayoutZones";

describe("wireframeLayoutZones", () => {
  it("puts Usuario on the right when spaced in ASCII line", () => {
    const zones = splitLineIntoZones(
      "│ LOGO   [Menu]                         [Usuario]             │",
    );
    expect(zones.some((z) => z.align === "right" && /usuario/i.test(z.cell.raw))).toBe(true);
    expect(zones.some((z) => z.align === "left" && /logo/i.test(z.cell.raw))).toBe(true);
  });

  it("classifies single-line header with right usuario as header row", () => {
    const rows = parseWireframeAscii(`
┌──────────────────────────────────────────┐
│ LOGO   [Menu]                         [Usuario]             │
├──────────────────────────────────────────┤
│ [Buscar]  [Crear nuevo]  [Exportar]                        │
└──────────────────────────────────────────┘
`);
    const header = rows.find((r) => r.kind === "header");
    expect(header).toBeDefined();
    expect(header?.zones.some((z) => z.align === "right")).toBe(true);
  });

  it("splits toolbar actions by gaps", () => {
    const zones = splitLineIntoZones("│ [Buscar tarifario...]  [Crear nuevo]  [Exportar]      │");
    expect(zones.length).toBeGreaterThanOrEqual(2);
  });
});
