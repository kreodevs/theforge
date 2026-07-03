import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  UI_MCP_DESIGN_SYSTEM_HEADING,
  buildUiMcpDesignSystemSection,
} from "./ui-design-system-section.util.js";

describe("buildUiMcpDesignSystemSection", () => {
  it("devuelve null sin tokens ni componentes", () => {
    assert.equal(buildUiMcpDesignSystemSection({ tokens: null, components: [] }), null);
  });

  it("genera sección con colores y catálogo", () => {
    const md = buildUiMcpDesignSystemSection({
      tokens: { colors: { primary: "#0af", bg: "#fff" } },
      components: [
        {
          name: "DataGridPro",
          package: "@mui/x-data-grid-pro",
          version: "7.0.0",
          replacesGeneric: ["DataTable"],
          semantic: { classification: ["DataRegistry"], capabilities: [] },
          props: [],
        },
      ],
      libraryName: "MUI",
      libraryVersion: "7.0.0",
    });
    assert.ok(md);
    assert.ok(md!.startsWith(UI_MCP_DESIGN_SYSTEM_HEADING));
    assert.match(md!, /MUI 7\.0\.0/);
    assert.match(md!, /`primary`/);
    assert.match(md!, /DataGridPro/);
    assert.match(md!, /DataTable/);
  });
});
