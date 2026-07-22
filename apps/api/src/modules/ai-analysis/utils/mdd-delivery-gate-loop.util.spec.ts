import { describe, expect, it } from "vitest";
import { resolveDeliveryGateFixTarget } from "./mdd-delivery-gate-loop.util.js";

describe("resolveDeliveryGateFixTarget (CHANGELOG [Unreleased] → Added → \"Dedicated §5 pass\")", () => {
  it("rutas a 'section5' cuando TODOS los blockers son sólo sobre §5", () => {
    const target = resolveDeliveryGateFixTarget([
      "Sección 5. Lógica y Edge Cases está en (Pendiente) o tiene contenido insuficiente (0 chars; mínimo 200).",
    ]);
    expect(target).toBe("section5");
  });

  it("rutas a 'section5' con múltiples substance blockers de §5", () => {
    const target = resolveDeliveryGateFixTarget([
      "Sección 5. Lógica y Edge Cases está en (Pendiente) (0 chars; mínimo 200).",
      "Sección 5. Lógica y Edge Cases es un placeholder del pipeline (ej. \"Pendiente: Arquitecto\").",
    ]);
    expect(target).toBe("section5");
  });

  it("NO rutas a 'section5' si hay blockers de otras secciones también", () => {
    // §2 + §5 → no es "sólo §5" → va a software_architect (que regenera §2-§5)
    const target = resolveDeliveryGateFixTarget([
      "Sección 2. Arquitectura y Stack tiene contenido insuficiente (50 chars; mínimo 200).",
      "Sección 5. Lógica y Edge Cases tiene contenido insuficiente (0 chars; mínimo 200).",
    ]);
    expect(target).toBe("software_architect");
  });

  it("NO rutas a 'section5' si hay blockers de §7 — va a 'integration'", () => {
    const target = resolveDeliveryGateFixTarget([
      "Sección 5. Lógica y Edge Cases tiene contenido insuficiente (0 chars; mínimo 200).",
      "Secciones obligatorias faltantes: 7. Infraestructura",
    ]);
    expect(target).toBe("integration");
  });

  it("NO rutas a 'section5' si hay blocker de §1 — va a 'clarifier'", () => {
    const target = resolveDeliveryGateFixTarget([
      "Sección 1. Contexto tiene contenido insuficiente (10 chars; mínimo 200).",
      "Sección 5. Lógica y Edge Cases tiene contenido insuficiente (0 chars; mínimo 200).",
    ]);
    expect(target).toBe("clarifier");
  });

  it("comportamiento legacy preservado: blockers sin §5 van a su ruta normal", () => {
    expect(
      resolveDeliveryGateFixTarget([
        "Secciones obligatorias faltantes: 7. Infraestructura",
      ]),
    ).toBe("integration");
    expect(
      resolveDeliveryGateFixTarget([
        "Sección 3. Modelo de Datos tiene contenido insuficiente (5 chars; mínimo 100).",
      ]),
    ).toBe("software_architect");
    expect(resolveDeliveryGateFixTarget([])).toBe("software_architect");
  });
});
