import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HeuristicUiComponentResolver,
  McpUiComponentResolver,
  type UiMcpResolveCapableClient,
} from "./ui-component-resolver.js";

const baseInput = {
  name: "orders",
  classification: "WorkflowProcess" as const,
  heuristicComponent: "KanbanBoard",
};

describe("HeuristicUiComponentResolver", () => {
  it("devuelve el componente heurístico sin cambios", async () => {
    const r = new HeuristicUiComponentResolver();
    const out = await r.resolve(baseInput);
    assert.equal(out.componentType, "KanbanBoard");
    assert.equal(out.source, "heuristic");
  });
});

describe("McpUiComponentResolver", () => {
  it("usa el componente del MCP cuando resuelve", async () => {
    const client: UiMcpResolveCapableClient = {
      async resolveComponent() {
        return {
          component: "OrderKanbanPro",
          package: "@acme/ui",
          version: "2.1.0",
          propMapping: { columns: "status" },
          confidence: 0.9,
        };
      },
    };
    const out = await new McpUiComponentResolver(client).resolve(baseInput);
    assert.equal(out.componentType, "OrderKanbanPro");
    assert.equal(out.package, "@acme/ui");
    assert.equal(out.source, "mcp");
  });

  it("fallback por-entidad al heurístico cuando el MCP devuelve null", async () => {
    const client: UiMcpResolveCapableClient = {
      async resolveComponent() {
        return null;
      },
    };
    const out = await new McpUiComponentResolver(client).resolve(baseInput);
    assert.equal(out.componentType, "KanbanBoard");
    assert.equal(out.source, "heuristic");
  });

  it("fallback cuando el MCP lanza error", async () => {
    const client: UiMcpResolveCapableClient = {
      async resolveComponent() {
        throw new Error("network");
      },
    };
    const out = await new McpUiComponentResolver(client).resolve(baseInput);
    assert.equal(out.componentType, "KanbanBoard");
    assert.equal(out.source, "heuristic");
  });
});
