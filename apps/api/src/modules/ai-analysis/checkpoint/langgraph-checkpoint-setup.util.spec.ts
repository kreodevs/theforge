import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLangGraphCheckpointSetupRaceError } from "./langgraph-checkpoint-setup.util.js";

describe("langgraph-checkpoint-setup", () => {
  it("detecta race pg_type_typname_nsp_index", () => {
    assert.equal(
      isLangGraphCheckpointSetupRaceError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "pg_type_typname_nsp_index"',
      }),
      true,
    );
    assert.equal(isLangGraphCheckpointSetupRaceError(new Error("other")), false);
  });
});
