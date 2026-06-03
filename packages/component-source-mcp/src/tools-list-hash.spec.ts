import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeToolsListHash } from "./tools-list-hash.js";

describe("computeToolsListHash", () => {
  it("is stable regardless of tool order", () => {
    const a = computeToolsListHash([
      { name: "list_modules", inputSchema: { type: "object" } },
      { name: "get_component", inputSchema: { type: "object", properties: { id: { type: "string" } } } },
    ]);
    const b = computeToolsListHash([
      { name: "get_component", inputSchema: { type: "object", properties: { id: { type: "string" } } } },
      { name: "list_modules", inputSchema: { type: "object" } },
    ]);
    assert.equal(a, b);
  });

  it("changes when a tool schema changes", () => {
    const before = computeToolsListHash([{ name: "list_modules", inputSchema: { type: "object" } }]);
    const after = computeToolsListHash([
      { name: "list_modules", inputSchema: { type: "object", properties: { q: { type: "string" } } } },
    ]);
    assert.notEqual(before, after);
  });
});
