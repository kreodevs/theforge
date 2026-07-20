import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getWorkshopDocToolbarActiveViewMode,
  workshopDocSourceTogglePresentation,
  type WorkshopDocToolbarViewModes,
} from "./workshopDocToolbar.js";

const baseModes: WorkshopDocToolbarViewModes = {
  mddViewMode: "preview",
  mddInicialViewMode: "source",
  specViewMode: "preview",
  architectureViewMode: "source",
  useCasesViewMode: "preview",
  userStoriesViewMode: "source",
  uxUiGuideViewMode: "design",
  aemViewMode: "preview",
  blueprintViewMode: "source",
  apiContractsViewMode: "preview",
  logicFlowsViewMode: "source",
  brdDocViewMode: "preview",
  infraViewMode: "source",
  agentGovernanceViewMode: "preview",
  tasksViewMode: "source",
};

describe("getWorkshopDocToolbarActiveViewMode", () => {
  it("maps known panels to their view mode field", () => {
    assert.equal(getWorkshopDocToolbarActiveViewMode("mdd", baseModes), "preview");
    assert.equal(getWorkshopDocToolbarActiveViewMode("agent-governance", baseModes), "preview");
    assert.equal(getWorkshopDocToolbarActiveViewMode("tasks", baseModes), "source");
  });

  it("falls back to infra view mode for unknown panels", () => {
    assert.equal(getWorkshopDocToolbarActiveViewMode("unknown-panel", baseModes), "source");
  });
});

describe("workshopDocSourceTogglePresentation", () => {
  it("returns edit/preview toggles for standard panels", () => {
    assert.equal(workshopDocSourceTogglePresentation("spec", "preview").tooltip, "Editar");
    assert.equal(workshopDocSourceTogglePresentation("spec", "source").tooltip, "Ver previsualización");
  });

  it("returns three-state UX guide toggles", () => {
    assert.equal(workshopDocSourceTogglePresentation("ux-ui-guide", "preview").tooltip, "Ver markdown");
    assert.equal(workshopDocSourceTogglePresentation("ux-ui-guide", "design").tooltip, "Ver UI Kit y tokens");
    assert.equal(workshopDocSourceTogglePresentation("ux-ui-guide", "source").tooltip, "Ver documento DESIGN.md");
  });
});
