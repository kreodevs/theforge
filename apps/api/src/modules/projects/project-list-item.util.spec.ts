import { describe, it } from "node:test";
import assert from "node:assert";
import { StageStatus, Status } from "@theforge/database";
import { toApiProjectListItem } from "./project-list-item.util.js";

describe("toApiProjectListItem", () => {
  it("devuelve metadatos y semáforo sin documentos", () => {
    const item = toApiProjectListItem(
      {
        id: "p1",
        userId: "u1",
        name: "Demo",
        visibility: "PRIVATE",
        complexity: "HIGH",
        complexityPending: null,
        projectType: "NEW",
        theforgeProjectId: null,
        hasUxTeam: false,
        linkedLegacyProjectId: null,
        linkedNewProjectId: null,
        groupId: "00000000-0000-4000-8000-000000000001",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        stages: [
          {
            id: "s1",
            ordinal: 1,
            key: "main",
            name: "Etapa principal",
            workflowStatus: StageStatus.ACTIVE,
            status: Status.VERDE,
            precisionScore: 88,
            isLegacy: false,
            estimation: null,
          },
        ],
      },
      true,
    );

    assert.equal(item.name, "Demo");
    assert.equal(item.status, Status.VERDE);
    assert.equal(item.precisionScore, 88);
    assert.equal(item.isFavorite, true);
    assert.equal(item.mddContent, null);
    assert.equal(item.specContent, null);
    assert.equal(item.activeStageId, "s1");
    assert.equal(item.groupId, "00000000-0000-4000-8000-000000000001");
    assert.equal(item.stages?.length, 1);
    assert.equal(item.stages?.[0]?.status, Status.VERDE);
  });
});
