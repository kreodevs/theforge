import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchUiMcpAdapter } from "./adapters/ui-mcp-adapter.registry.js";

describe("ui-mcp-adapter.registry — matchUiMcpAdapter", () => {
  it("no empareja si faltan tools Kreo", () => {
    assert.equal(matchUiMcpAdapter(["get_ui_component_catalog"]), null);
  });

  it("empareja adaptador Kreo cuando están los tools mínimos", () => {
    const adapter = matchUiMcpAdapter([
      "resolve_component_for_entity",
      "get_ui_component_catalog",
      "pull_tokens_dtcg",
    ]);
    assert.ok(adapter);
    assert.equal(adapter?.id, "kreo");
  });

  it("no empareja cuando ya hay contrato nativo (sin tools Kreo)", () => {
    assert.equal(
      matchUiMcpAdapter(["describe_capabilities", "list_components", "resolve_component"]),
      null,
    );
  });
});
