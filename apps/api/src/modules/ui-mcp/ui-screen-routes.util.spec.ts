import { describe, expect, it } from "vitest";
import { inferPageComponentName } from "./ui-screen-routes.util.js";

describe("inferPageComponentName (CHANGELOG [Unreleased] → Fixed → 'Pantallas: PascalCase limpio')", () => {
  it("snake_case → PascalCase limpio (AppPackages, no App_packages)", () => {
    expect(inferPageComponentName("Gestionar app_packages")).toBe("GestionarAppPackagesPage");
  });

  it("kebab-case → PascalCase limpio", () => {
    expect(inferPageComponentName("Gestionar app-packages")).toBe("GestionarAppPackagesPage");
  });

  it("SCREAMING_SNAKE_CASE → PascalCase limpio", () => {
    expect(inferPageComponentName("APP_PACKAGES")).toBe("AppPackagesPage");
  });

  it("multi-palabra con espacios → PascalCase", () => {
    expect(inferPageComponentName("Chat del copiloto")).toBe("ChatDelCopilotoPage");
    expect(inferPageComponentName("Dashboard ejecutivo")).toBe("DashboardEjecutivoPage");
  });

  it("acentos se normalizan a ASCII (NFD + strip combining marks)", () => {
    // Antes: "Gestión de app_packages" → "GestiNDeApp_packagesPage" (bug)
    //   porque `ó` no está en [a-zA-Z0-9] y rompía la palabra.
    // Ahora: NFD normaliza ó → o, así la palabra se preserva.
    expect(inferPageComponentName("Gestión de app_packages")).toBe("GestionDeAppPackagesPage");
    expect(inferPageComponentName("Inicio de sesión")).toBe("InicioDeSesionPage");
    expect(inferPageComponentName("Bitácora de peticiones")).toBe("BitacoraDePeticionesPage");
  });

  it("string vacío o solo separadores → ScreenPage (fallback)", () => {
    expect(inferPageComponentName("")).toBe("ScreenPage");
    expect(inferPageComponentName("   ")).toBe("ScreenPage");
    expect(inferPageComponentName("---")).toBe("ScreenPage");
  });

  it("mayúsculas iniciales se preservan solo en la primera letra (PascalCase, no ALL_CAPS)", () => {
    // "GESTION" → "Gestion" (no "GESTION" ni "GESTIÓN").
    expect(inferPageComponentName("GESTION")).toBe("GestionPage");
  });

  it("dígitos se preservan", () => {
    expect(inferPageComponentName("renovación 2026")).toBe("Renovacion2026Page");
  });
});
