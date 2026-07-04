import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildUiScreensMarkdown } from "./ui-screens-markdown.util.js";
import type { PantallaPlanItem } from "./ui-screens-plan.util.js";

const PLAN: PantallaPlanItem[] = [
  {
    name: "orders",
    screenName: "Tablero de Órdenes",
    purpose: "Gestión visual del flujo de órdenes.",
    source: "entity+hu",
    role: "Inversor",
    route: "/orders",
    pageName: "OrdersPage",
    uiStates: "loading, empty, error",
    primaryApi: "GET /api/orders",
    userStoryId: "US-001",
    classification: "WorkflowProcess",
  },
];

describe("buildUiScreensMarkdown", () => {
  it("devuelve null sin plan", () => {
    assert.equal(buildUiScreensMarkdown([], []), null);
  });

  it("genera tablas por rol con ruta, componentes y API (sin TSX)", () => {
    const md = buildUiScreensMarkdown(
      [
        {
          name: "Tablero de Órdenes",
          purpose: "Gestión visual del flujo de órdenes.",
          components: [
            {
              component: "KanbanBoardPro",
              package: "@acme/ui",
              version: "2.1.0",
              entity: "orders",
              props: { columns: "orders.status" },
            },
          ],
          endpoints: ["GET /api/orders"],
        },
      ],
      PLAN,
      { projectName: "Demo", libraryName: "Acme UI", libraryVersion: "2.1.0" },
    );
    assert.ok(md);
    assert.match(md!, /# Pantallas — Demo/);
    assert.match(md!, /## Inversor/);
    assert.match(md!, /\| \/orders \| OrdersPage \| US-001 \|/);
    assert.match(md!, /KanbanBoardPro/);
    assert.match(md!, /Layout transversal/);
    assert.ok(!md!.includes("```tsx"));
  });
});
