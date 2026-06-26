import { describe, expect, it } from "vitest";
import {
  isSsotPatternsNotice,
  isWorkshopConnectionError,
  SSOT_PATTERNS_RESTORED_NOTICE,
} from "./workshopSyncStatus";

describe("workshopSyncStatus", () => {
  it("SSOT notice is not a connection error", () => {
    expect(isSsotPatternsNotice(SSOT_PATTERNS_RESTORED_NOTICE)).toBe(true);
    expect(isWorkshopConnectionError(SSOT_PATTERNS_RESTORED_NOTICE)).toBe(false);
  });

  it("detects offline persist messages", () => {
    expect(isWorkshopConnectionError("Sin conexión: Failed to fetch. Cambio guardado localmente.")).toBe(
      true,
    );
    expect(isWorkshopConnectionError("Error de red al guardar")).toBe(true);
  });

  it("ignores generic operation errors", () => {
    expect(isWorkshopConnectionError("Error al generar MDD")).toBe(false);
  });
});
