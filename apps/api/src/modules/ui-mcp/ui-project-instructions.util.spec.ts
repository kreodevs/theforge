import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScreenSpec } from "@theforge/shared-types";
import {
  appendUiProjectToPantallas,
  buildUiProjectInstructions,
} from "./ui-project-instructions.util.js";
import { splitPantallasAndUiProject, UI_PROJECT_JSON_MARKER } from "@theforge/shared-types";
import type { PantallaPlanItem } from "./ui-screens-plan.util.js";

const plan: PantallaPlanItem[] = [
  {
    name: "orders",
    screenName: "Pedidos",
    purpose: "Listar pedidos",
    classification: "WorkflowProcess",
    keyFields: ["id", "status"],
    source: "entity",
    role: "Operador",
    route: "/orders",
    pageName: "OrdersPage",
    userStoryId: "US-003",
    uiStates: "loading, empty, error",
    primaryApi: "GET /orders",
  },
];

const screens: ScreenSpec[] = [
  {
    name: "Pedidos",
    components: [{ component: "DataTable", entity: "orders" }],
    endpoints: ["GET /orders"],
  },
];

describe("buildUiProjectInstructions", () => {
  it("genera UiProjectInstructions v1 con navigation y screens", () => {
    const out = buildUiProjectInstructions({
      projectName: "Acme WMS",
      plan,
      screens,
    });
    assert.equal(out.version, "1.0.0");
    assert.equal(out.project.slug, "acme-wms");
    assert.ok(out.context.navigation.primaryItems.some((i) => i.screenKey === "orders"));
    assert.ok(out.screens.some((s) => s.key === "orders"));
    assert.ok(out.constraints.preferredComponents.includes("DataTable"));
    assert.ok(out.screens[0]?.states.some((s) => s.key === "empty"));
  });

  it("embebe y separa JSON para export spec-kit", () => {
    const instructions = buildUiProjectInstructions({
      projectName: "Test",
      plan,
      screens,
    });
    const combined = appendUiProjectToPantallas("# Pantallas\n", instructions);
    assert.match(combined, new RegExp(UI_PROJECT_JSON_MARKER));
    const { pantallas, uiProjectJson } = splitPantallasAndUiProject(combined);
    assert.match(pantallas, /^# Pantallas/);
    assert.ok(uiProjectJson?.includes('"version": "1.0.0"'));
  });
});
