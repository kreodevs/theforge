import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildPreviewTheme,
  resolveLightPreviewBackground,
  generateColorScale,
} from "./design-system-utils.js";
import type { DesignTokens } from "./design-system-types.js";

const ELEVEN_LABS_LIKE: DesignTokens = {
  colors: {
    primary: "#3B82F6",
    secondary: "#A855F7",
    tertiary: "#888899",
    neutral: "#888899",
    foreground: "#FAFAFA",
    background: "#0A0A0F",
  },
};

describe("buildPreviewTheme light mode", () => {
  it("uses a light canvas when YAML background is dark-first", () => {
    const theme = buildPreviewTheme(ELEVEN_LABS_LIKE, "light");
    assert.ok(theme.background !== "#0A0A0F");
    assert.match(theme.cssVars["--ds-bg"]!, /^#[A-F0-9]{6}$/i);
    assert.ok(
      parseInt(theme.cssVars["--ds-bg"]!.slice(1, 3), 16) > 200,
      "light bg should be bright",
    );
    assert.ok(
      parseInt(theme.cssVars["--ds-fg"]!.slice(1, 3), 16) < 80,
      "fg should be dark on light canvas",
    );
  });

  it("resolveLightPreviewBackground prefers light neutral over dark background", () => {
    const grayScale = generateColorScale("#888899", 12, "light");
    const bg = resolveLightPreviewBackground(ELEVEN_LABS_LIKE, grayScale);
    assert.notEqual(bg, "#0A0A0F");
  });
});
