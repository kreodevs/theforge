import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTheforgeDocConsumptionGuide,
  ROOT_THEFORGE_DOC_CONSUMPTION_GUIDE,
} from "./doc-consumption-guide.js";

describe("doc-consumption-guide", () => {
  it("genera guía spec-kit dual con IMPLEMENT.md primero", () => {
    const guide = buildTheforgeDocConsumptionGuide("specs/001-demo");
    assert.ok(guide.includes("IMPLEMENT.md"));
    assert.ok(guide.includes("specs/001-demo/spec.md"));
    assert.ok(guide.includes("pantallas.md"));
    assert.ok(guide.includes("gana sobre heurísticas de Blueprint §8"));
  });

  it("expone nombre de archivo raíz canónico", () => {
    assert.equal(ROOT_THEFORGE_DOC_CONSUMPTION_GUIDE, "THEFORGE-DOC-CONSUMPTION-GUIDE.md");
  });
});
