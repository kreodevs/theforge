import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectMergeBodySchema } from "./project-merge.js";

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";

describe("projectMergeBodySchema", () => {
  it("allows targetProjectId when it is also a source (merge A+B into A)", () => {
    const parsed = projectMergeBodySchema.parse({
      sourceProjectIds: [idA, idB],
      targetMode: "existing",
      targetProjectId: idA,
      deleteSources: "delete",
      preview: true,
    });
    assert.equal(parsed.targetProjectId, idA);
    assert.deepEqual(parsed.sourceProjectIds, [idA, idB]);
  });

  it("requires targetProjectId for existing mode", () => {
    const result = projectMergeBodySchema.safeParse({
      sourceProjectIds: [idA, idB],
      targetMode: "existing",
    });
    assert.equal(result.success, false);
  });
});
