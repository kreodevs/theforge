import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStageScopedDeliverableField,
  resolveWorkshopStageDeliverables,
} from "./workshopStageDeliverables.js";

describe("workshopStageDeliverables", () => {
  it("isStageScopedDeliverableField incluye blueprintContent", () => {
    assert.equal(isStageScopedDeliverableField("blueprintContent"), true);
    assert.equal(isStageScopedDeliverableField("dbgaContent"), false);
  });

  it("resolveWorkshopStageDeliverables prefiere blueprint de la etapa activa", () => {
    const resolved = resolveWorkshopStageDeliverables(
      {
        blueprintContent: "# Project BP",
        stages: [
          { id: "s1", blueprintContent: "# Stage 1 BP" },
          { id: "s2", blueprintContent: "# Stage 2 BP" },
        ],
      },
      "s2",
    );
    assert.equal(resolved.blueprintContent, "# Stage 2 BP");
  });

  it("resolveWorkshopStageDeliverables hace fallback al proyecto", () => {
    const resolved = resolveWorkshopStageDeliverables(
      {
        blueprintContent: "# Project BP",
        stages: [{ id: "s1", blueprintContent: "  " }],
      },
      "s1",
    );
    assert.equal(resolved.blueprintContent, "# Project BP");
  });
});
