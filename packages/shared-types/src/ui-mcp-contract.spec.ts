import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_UI_MCP_TOOLS,
  UI_MCP_CONTRACT_VERSION,
  describeCapabilitiesResultSchema,
  evaluateUiMcpCompatibility,
  isSupportedUiMcpContractVersion,
  listScreensResultSchema,
  resolveComponentResultSchema,
} from "./ui-mcp-contract.js";

describe("ui-mcp-contract — describeCapabilitiesResultSchema", () => {
  it("aplica defaults de supports cuando no se envían", () => {
    const parsed = describeCapabilitiesResultSchema.parse({
      contractVersion: UI_MCP_CONTRACT_VERSION,
      componentLibrary: { name: "acme-ui", version: "3.2.1" },
    });
    assert.equal(parsed.supports.resolveComponent, true);
    assert.equal(parsed.supports.listScreens, false);
    assert.equal(parsed.supports.designTokens, false);
  });
});

describe("ui-mcp-contract — isSupportedUiMcpContractVersion", () => {
  it("acepta la versión exacta", () => {
    assert.equal(isSupportedUiMcpContractVersion(UI_MCP_CONTRACT_VERSION), true);
  });
  it("acepta mismo major distinto minor/patch", () => {
    assert.equal(isSupportedUiMcpContractVersion("1.5.9"), true);
  });
  it("rechaza otro major", () => {
    assert.equal(isSupportedUiMcpContractVersion("2.0.0"), false);
  });
  it("rechaza undefined/vacío", () => {
    assert.equal(isSupportedUiMcpContractVersion(undefined), false);
    assert.equal(isSupportedUiMcpContractVersion(""), false);
  });
});

describe("ui-mcp-contract — evaluateUiMcpCompatibility", () => {
  it("compatible con todos los tools y contractVersion reconocido", () => {
    const result = evaluateUiMcpCompatibility({
      toolNames: [...REQUIRED_UI_MCP_TOOLS, "list_screens"],
      capabilities: {
        contractVersion: UI_MCP_CONTRACT_VERSION,
        componentLibrary: { name: "acme-ui", version: "1.0.0" },
        supports: { resolveComponent: true, listScreens: true, designTokens: false },
      },
    });
    assert.equal(result.compatible, true);
    assert.equal(result.missingTools.length, 0);
    assert.equal(result.libraryName, "acme-ui");
  });

  it("no compatible cuando falta un tool obligatorio", () => {
    const result = evaluateUiMcpCompatibility({
      toolNames: ["describe_capabilities", "list_components"],
      capabilities: {
        contractVersion: UI_MCP_CONTRACT_VERSION,
        componentLibrary: { name: "acme-ui", version: "1.0.0" },
        supports: { resolveComponent: true, listScreens: false, designTokens: false },
      },
    });
    assert.equal(result.compatible, false);
    assert.deepEqual(result.missingTools, ["resolve_component"]);
  });

  it("no compatible cuando el contractVersion no es reconocido", () => {
    const result = evaluateUiMcpCompatibility({
      toolNames: [...REQUIRED_UI_MCP_TOOLS],
      capabilities: {
        contractVersion: "9.9.9",
        componentLibrary: { name: "acme-ui", version: "1.0.0" },
        supports: { resolveComponent: true, listScreens: false, designTokens: false },
      },
    });
    assert.equal(result.compatible, false);
  });

  it("no compatible cuando no hay capabilities", () => {
    const result = evaluateUiMcpCompatibility({
      toolNames: [...REQUIRED_UI_MCP_TOOLS],
      capabilities: null,
    });
    assert.equal(result.compatible, false);
  });
});

describe("ui-mcp-contract — resolveComponentResultSchema", () => {
  it("aplica defaults de propMapping/confidence", () => {
    const parsed = resolveComponentResultSchema.parse({
      component: "DataGridPro",
      package: "@mui/x-data-grid-pro",
      version: "7.0.0",
    });
    assert.deepEqual(parsed.propMapping, {});
    assert.equal(parsed.confidence, 1);
  });
});

describe("ui-mcp-contract — listScreensResultSchema", () => {
  it("parsea pantallas con componentes y endpoints", () => {
    const parsed = listScreensResultSchema.parse({
      screens: [
        {
          name: "Orders Board",
          purpose: "Kanban de órdenes",
          components: [
            { component: "KanbanBoard", entity: "orders", props: { columns: "status" } },
          ],
          endpoints: ["GET /api/v1/orders"],
        },
      ],
    });
    assert.equal(parsed.screens.length, 1);
    assert.equal(parsed.screens[0]?.components[0]?.component, "KanbanBoard");
  });
});
