import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeTasksPlanWithCoverageFloor,
  renumberTasksPlanItems,
} from "./tasks-plan-merge.util.js";
import type { TasksPlanItem } from "@theforge/shared-types";

describe("tasks-plan-merge", () => {
  it("renumberTasksPlanItems remaps dependsOn", () => {
    const items: TasksPlanItem[] = [
      {
        id: "T-010",
        title: "A",
        layer: "Backend",
        mddRefs: [],
        storyRefs: [],
        upstreamRefs: ["api-contracts:GET /a"],
        dependsOn: [],
        targetFilesHint: [],
      },
      {
        id: "T-020",
        title: "B",
        layer: "Backend",
        mddRefs: [],
        storyRefs: [],
        upstreamRefs: ["api-contracts:POST /b"],
        dependsOn: ["T-010"],
        targetFilesHint: [],
      },
    ];
    const out = renumberTasksPlanItems(items);
    assert.equal(out[0]!.id, "T-001");
    assert.equal(out[1]!.id, "T-002");
    assert.deepEqual(out[1]!.dependsOn, ["T-001"]);
  });

  it("mergeTasksPlanWithCoverageFloor adds missing heuristic items", () => {
    const primary = {
      sections: ["Backend"],
      items: [
        {
          id: "T-001",
          title: "Implementar POST /api/v1/tenants",
          layer: "Backend" as const,
          mddRefs: ["§4"],
          storyRefs: [],
          upstreamRefs: ["api-contracts:POST /api/v1/tenants"],
          dependsOn: [],
          targetFilesHint: [],
        },
      ],
    };
    const floor = {
      sections: ["Backend", "Frontend", "QA"],
      items: [
        ...primary.items,
        {
          id: "T-002",
          title: "Implementar GET /api/v1/tenants",
          layer: "Backend" as const,
          mddRefs: ["§4"],
          storyRefs: [],
          upstreamRefs: ["api-contracts:GET /api/v1/tenants"],
          dependsOn: [],
          targetFilesHint: [],
        },
        {
          id: "T-003",
          title: "Implementar pantalla /chat",
          layer: "Frontend" as const,
          mddRefs: ["§2"],
          storyRefs: [],
          upstreamRefs: ["pantallas:/chat"],
          dependsOn: [],
          targetFilesHint: [],
        },
        {
          id: "T-004",
          title: "Smoke tests E2E",
          layer: "QA" as const,
          mddRefs: [],
          storyRefs: [],
          upstreamRefs: ["spec:criterios-exito"],
          dependsOn: [],
          targetFilesHint: [],
        },
      ],
    };

    const merged = mergeTasksPlanWithCoverageFloor(primary, floor);
    assert.equal(merged.items.length, 4);
    assert.ok(merged.items.some((i) => i.upstreamRefs.includes("api-contracts:GET /api/v1/tenants")));
    assert.ok(merged.items.some((i) => i.upstreamRefs.includes("pantallas:/chat")));
    assert.ok(merged.items.some((i) => i.layer === "QA"));
    assert.equal(merged.items[0]!.id, "T-001");
    assert.equal(merged.items[merged.items.length - 1]!.id, "T-004");
  });
});
