import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSddGraphSyncState } from "./sdd-graph-sync.js";

describe("resolveSddGraphSyncState", () => {
  it("marca unavailable sin Falkor", () => {
    const status = resolveSddGraphSyncState({
      falkorAvailable: false,
      expectedEntities: 3,
      expectedEndpoints: 5,
      graphEntities: 0,
      graphEndpoints: 0,
      isCoherent: null,
    });
    assert.equal(status.state, "unavailable");
  });

  it("marca empty cuando no hay §3/§4 indexables ni nodos", () => {
    const status = resolveSddGraphSyncState({
      falkorAvailable: true,
      expectedEntities: 0,
      expectedEndpoints: 0,
      graphEntities: 0,
      graphEndpoints: 0,
      isCoherent: false,
    });
    assert.equal(status.state, "empty");
  });

  it("marca synced cuando conteos y coherencia coinciden", () => {
    const status = resolveSddGraphSyncState({
      falkorAvailable: true,
      expectedEntities: 4,
      expectedEndpoints: 8,
      graphEntities: 4,
      graphEndpoints: 8,
      isCoherent: true,
    });
    assert.equal(status.state, "synced");
  });

  it("marca stale cuando el MDD cambió tras la sync", () => {
    const status = resolveSddGraphSyncState({
      falkorAvailable: true,
      expectedEntities: 4,
      expectedEndpoints: 8,
      graphEntities: 4,
      graphEndpoints: 8,
      isCoherent: true,
      mddChangedSinceSync: true,
    });
    assert.equal(status.state, "stale");
  });
});
