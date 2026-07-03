import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractJsonFromMcpText,
  parseKreoCatalogComponentNames,
} from "./ui-mcp-mcp-text.util.js";

describe("ui-mcp-mcp-text — extractJsonFromMcpText", () => {
  it("parsea JSON puro", () => {
    assert.deepEqual(extractJsonFromMcpText('{"a":1}'), { a: 1 });
  });

  it("extrae JSON embebido en markdown", () => {
    const text = "# Title\n\nSome prose\n\n{\"component_name\":\"DataTable\"}\n";
    assert.deepEqual(extractJsonFromMcpText(text), { component_name: "DataTable" });
  });
});

describe("ui-mcp-mcp-text — parseKreoCatalogComponentNames", () => {
  it("extrae nombres de filas de tabla markdown", () => {
    const md = "| Componente | Tier |\n|---|---|\n| DataTable | composable |\n| Button | composable |";
    assert.deepEqual(parseKreoCatalogComponentNames(md), ["DataTable", "Button"]);
  });
});
