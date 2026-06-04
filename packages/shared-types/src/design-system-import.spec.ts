import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidMcpDesignGuideContent,
  shouldUseMcpDesignSystem,
} from "./design-system-import.js";

describe("design-system-import", () => {
  const validGuide =
    "---\nname: Orbit\ncolors:\n  primary: \"#182A4A\"\n  secondary: \"#E2ECFE\"\n---\n\n## Overview\n\nDesign system importado desde Orbit MCP con paleta y tokens suficientes para validación.";

  it("isValidMcpDesignGuideContent acepta YAML con colores", () => {
    assert.equal(isValidMcpDesignGuideContent(validGuide), true);
  });

  it("rechaza guía corta o sin tokens de color", () => {
    assert.equal(isValidMcpDesignGuideContent("---\nname: X\n---\n"), false);
    assert.equal(
      isValidMcpDesignGuideContent(
        "## Overview\n\nTexto sin paleta ni frontmatter con hex.",
      ),
      false,
    );
  });

  it("shouldUseMcpDesignSystem no exige sección MCP en MDD", () => {
    assert.equal(
      shouldUseMcpDesignSystem({
        uxUiGuideContent: validGuide,
        mddContent: "## Solo ingeniería\n\nSin sección MCP.",
      }),
      true,
    );
    assert.equal(
      shouldUseMcpDesignSystem({
        uxUiGuideContent: validGuide.replace(/#[0-9A-Fa-f]+/gi, ""),
        mddContent: `## Design System (MCP)\n\nRef.`,
      }),
      false,
    );
  });
});
