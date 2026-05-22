import { describe, expect, it } from "vitest";
import {
  detectNaturalRegenerateSection,
  getRegenerateSectionFromSlashCommand,
  mddHasSection6Heading,
} from "./mddSectionRegen";

describe("mddSectionRegen", () => {
  it("detectNaturalRegenerateSection acepta texto después del número", () => {
    expect(detectNaturalRegenerateSection("regenera la sección 6 por favor")).toBe(6);
    expect(detectNaturalRegenerateSection("rehacer paso 3 del mdd")).toBe(3);
  });

  it("getRegenerateSectionFromSlashCommand resuelve /seguridad", () => {
    expect(getRegenerateSectionFromSlashCommand("/seguridad")).toBe(6);
  });

  it("mddHasSection6Heading detecta ## 6. Seguridad", () => {
    expect(mddHasSection6Heading("## 5. Lógica\n\nx\n## 6. Seguridad\n\nJWT")).toBe(true);
    expect(mddHasSection6Heading("## 5. Lógica\n\n## 7. Infraestructura")).toBe(false);
  });
});
