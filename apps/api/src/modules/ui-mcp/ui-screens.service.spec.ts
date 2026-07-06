import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { StageStatus } from "@theforge/database";
import { UiScreensService } from "./ui-screens.service.js";
import type { UiMcpClientService } from "./ui-mcp-client.service.js";
import type { UiMcpService } from "./ui-mcp.service.js";

const SAMPLE_MDD = [
  "## 3. Modelo de Datos",
  "",
  "CREATE TABLE orders (id UUID PRIMARY KEY, status TEXT NOT NULL, total NUMERIC);",
].join("\n");

function makeService(mcpClient: Partial<UiMcpClientService>, uiMcp: Partial<UiMcpService>) {
  const prisma = {
    project: {
      findUnique: async () => ({
        id: "proj-1",
        complexity: "HIGH",
        dbgaContent: null,
        phase0SummaryContent: null,
        specContent: null,
        apiContractsContent: null,
        userStoriesContent: null,
        name: "Demo",
        stages: [
          {
            ordinal: 1,
            workflowStatus: StageStatus.ACTIVE,
            mddContent: SAMPLE_MDD,
          },
        ],
      }),
      update: async () => ({}),
    },
  };
  return new UiScreensService(
    prisma as never,
    mcpClient as UiMcpClientService,
    uiMcp as UiMcpService,
  );
}

describe("UiScreensService — syncUiScreens", () => {
  it("ensambla pantallas vía resolve_component cuando list_screens no está soportado", async () => {
    const resolveCalls: Array<Record<string, unknown>> = [];
    const service = makeService(
      {
        isActive: async () => true,
        listScreens: async () => null,
        resolveComponent: async (args) => {
          resolveCalls.push(args as Record<string, unknown>);
          return {
            component: "Table",
            package: "@imj_media/ui",
            version: "1.12.0",
            propMapping: { rows: "GET /api/v1/orders" },
            confidence: 0.9,
          };
        },
      },
      {
        getActiveCompatibleMeta: async () => ({
          libraryName: "@imj_media/ui",
          libraryVersion: "1.12.0",
          contractVersion: "1.0.0",
        }),
        supportsUiProjectInstructions: async () => false,
      },
    );

    const result = await service.syncUiScreens("proj-1");
    assert.equal(result.screens, 1);
    assert.match(result.content, /orders/i);
    assert.equal(resolveCalls.length, 1);
    assert.deepEqual(resolveCalls[0].keyFields, ["id", "status", "total"]);
  });

  it("400 cuando resolve_component no devuelve ninguna pantalla", async () => {
    const service = makeService(
      {
        isActive: async () => true,
        listScreens: async () => null,
        resolveComponent: async () => null,
      },
      {
        getActiveCompatibleMeta: async () => ({
          libraryName: "@imj_media/ui",
          libraryVersion: "1.12.0",
          contractVersion: "1.0.0",
        }),
        supportsUiProjectInstructions: async () => false,
      },
    );

    await assert.rejects(
      () => service.syncUiScreens("proj-1"),
      (err: unknown) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(err.message, /no devolvió pantallas/i);
        return true;
      },
    );
  });
});
