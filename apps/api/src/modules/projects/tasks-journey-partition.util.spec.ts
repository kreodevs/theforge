import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partitionTasksPlanByJourney } from "./tasks-journey-partition.util.js";
import type { TasksGenerationPlan } from "@theforge/shared-types";

describe("partitionTasksPlanByJourney", () => {
  it("groups plan items by journey upstream ref", () => {
    const plan: TasksGenerationPlan = {
      sections: [],
      items: [
        {
          id: "T-001",
          title: "Core",
          layer: "Backend",
          mddRefs: [],
          storyRefs: [],
          upstreamRefs: [],
          dependsOn: [],
          targetFilesHint: [],
        },
        {
          id: "T-002",
          title: "WhatsApp journey",
          layer: "Backend",
          mddRefs: [],
          storyRefs: ["US-JRN-CAP_WHATSAPP"],
          upstreamRefs: ["journey:proc-cap-whatsapp"],
          dependsOn: [],
          targetFilesHint: [],
        },
      ],
    };
    const inventory = {
      capabilities: [],
      suggestedEntities: [],
      crudMatrix: [],
      adminSurfaces: [],
      processes: [
        {
          id: "proc-cap-whatsapp",
          name: "WhatsApp",
          steps: [],
          entities: [],
          critical: true,
          brdCapabilityIds: ["cap-whatsapp"],
          screenHints: [],
        },
      ],
    };
    const parts = partitionTasksPlanByJourney(plan, inventory);
    assert.ok(parts.length >= 2);
    const journey = parts.find((p) => p.journeyId === "proc-cap-whatsapp");
    assert.ok(journey?.items.some((i) => i.id === "T-002"));
  });
});
