import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldApplyPersistedFieldContent } from "./persist-field-guard.js";

describe("shouldApplyPersistedFieldContent", () => {
  it("aplica si el local no cambió desde el inicio del guardado", () => {
    assert.equal(shouldApplyPersistedFieldContent("hola", "hola", "hola"), true);
  });

  it("aplica si el local coincide con el payload enviado", () => {
    assert.equal(shouldApplyPersistedFieldContent("hola", "ho", "hola"), true);
  });

  it("no aplica si el usuario siguió escribiendo", () => {
    assert.equal(shouldApplyPersistedFieldContent("hola mundo", "hola", "hola"), false);
  });
});
