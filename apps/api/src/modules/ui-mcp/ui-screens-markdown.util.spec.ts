import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildUiScreensMarkdown } from "./ui-screens-markdown.util.js";

describe("buildUiScreensMarkdown", () => {
  it("devuelve null sin pantallas", () => {
    assert.equal(buildUiScreensMarkdown([]), null);
  });

  it("genera markdown de texto con componentes reales y endpoints (sin TSX)", () => {
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
              props: { columns: "orders.status", rows: "orders" },
            },
          ],
          endpoints: ["GET /api/v1/orders"],
        },
      ],
      { libraryName: "Acme UI", libraryVersion: "2.1.0", contractVersion: "1.0.0" },
    );
    assert.ok(md);
    assert.match(md!, /# Pantallas \/ UI Screens Spec/);
    assert.match(md!, /Tablero de Órdenes/);
    assert.match(md!, /`KanbanBoardPro` `@acme\/ui@2\.1\.0`/);
    assert.match(md!, /`orders`/);
    assert.match(md!, /GET \/api\/v1\/orders/);
    assert.ok(!md!.includes("```tsx"), "no debe incluir bloques TSX");
    assert.ok(!md!.includes("```jsx"), "no debe incluir bloques JSX");
  });
});
