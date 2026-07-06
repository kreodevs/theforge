import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  matchUiMcpAdapter,
  resolveUiMcpAdapterById,
} from "./adapters/ui-mcp-adapter.registry.js";
import { SEMANTIC_CATALOG_ADAPTER_ID } from "./adapters/kreo-ui-mcp.adapter.js";
import { UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID } from "@theforge/shared-types";

describe("ui-mcp-adapter.registry — matchUiMcpAdapter", () => {
  it("no empareja si faltan tools del contrato semántico", () => {
    assert.equal(matchUiMcpAdapter(["get_ui_component_catalog"]), null);
  });

  it("empareja adaptador semántico cuando están las tools mínimas", () => {
    const adapter = matchUiMcpAdapter([
      "resolve_component_for_entity",
      "get_ui_component_catalog",
      "pull_tokens_dtcg",
    ]);
    assert.ok(adapter);
    assert.equal(adapter?.id, SEMANTIC_CATALOG_ADAPTER_ID);
  });

  it("rehidrata por adapterId legacy kreo", () => {
    const adapter = resolveUiMcpAdapterById("kreo", [
      "resolve_component_for_entity",
      "get_ui_component_catalog",
    ]);
    assert.ok(adapter);
    assert.equal(adapter?.id, SEMANTIC_CATALOG_ADAPTER_ID);
  });

  it("no empareja cuando ya hay contrato nativo (sin tools semánticas)", () => {
    assert.equal(
      matchUiMcpAdapter(["describe_capabilities", "list_components", "resolve_component"]),
      null,
    );
  });

  it("no empareja adaptador semántico si faltan tools Kreo aunque exista resolve_entity_ui", () => {
    assert.equal(
      matchUiMcpAdapter([
        "describe_capabilities",
        "list_components",
        "resolve_component",
        "resolve_entity_ui",
      ]),
      null,
    );
  });
});
