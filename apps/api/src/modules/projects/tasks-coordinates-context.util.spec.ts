import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGreenfieldModulePathHints,
  buildTasksCoordinatesPromptBlock,
  extractMddCapabilityLines,
  parseChangeScopeFromLegacyState,
} from "./tasks-coordinates-context.util.js";

describe("tasks-coordinates-context.util", () => {
  it("parseChangeScopeFromLegacyState reads nested changeScope", () => {
    const scope = parseChangeScopeFromLegacyState({
      changeScope: { description: "Agregar descuento", confirmed: true, affectedRoutes: [] },
    });
    assert.equal(scope?.description, "Agregar descuento");
  });

  it("extractMddCapabilityLines parses §1 bullets", () => {
    const mdd = "## 1. Contexto\n\n- Generación de recomendaciones IA\n- Watchlists por usuario\n";
    const lines = extractMddCapabilityLines(mdd);
    assert.ok(lines.some((l) => /recomendaciones/i.test(l)));
  });

  it("buildGreenfieldModulePathHints from architecture tree", () => {
    const hints = buildGreenfieldModulePathHints(
      "## 2\nCore (Alpha Engine)",
      "modules/alpha/\nmodules/auth/\n",
    );
    assert.ok(hints.some((h) => h.includes("alpha")));
  });

  it("buildTasksCoordinatesPromptBlock activates coordinates mode", () => {
    const { block, coordinatesMode } = buildTasksCoordinatesPromptBlock({
      mddMarkdown: "## 2\nCore (Data Service)",
      architectureMarkdown: "modules/ingestion/",
      navigationMapMarkdown: "## /dashboard\nComponent: DashboardPage.tsx\n".repeat(20),
    });
    assert.equal(coordinatesMode, true);
    assert.match(block, /Modo coordenadas exactas/);
    assert.match(block, /ingestion/);
  });
});
