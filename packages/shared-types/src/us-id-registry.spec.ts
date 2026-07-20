import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  stableCrudUserStoryId,
  stableJourneyUserStoryId,
  userStoryNamespace,
} from "./us-id-registry.js";

describe("us-id-registry", () => {
  it("CRUD IDs are stable regardless of sort order", () => {
    const a = stableCrudUserStoryId("orders");
    const b = stableCrudUserStoryId("orders");
    assert.equal(a, b);
    assert.equal(a, "US-CRUD-ORDERS");
    assert.equal(userStoryNamespace(a), "crud");
  });

  it("journey IDs use process id namespace", () => {
    const id = stableJourneyUserStoryId("proc-cap-whatsapp");
    assert.equal(id, "US-JRN-CAP_WHATSAPP");
    assert.equal(userStoryNamespace(id), "journey");
  });

  it("CRUD and journey namespaces never collide on suffix alone", () => {
    assert.notEqual(stableCrudUserStoryId("orders"), stableJourneyUserStoryId("orders"));
  });
});
