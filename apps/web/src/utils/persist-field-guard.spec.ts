import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeProjectBaselinesAfterPersist,
  shouldApplyPersistedFieldContent,
} from "./persist-field-guard.js";

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

describe("mergeProjectBaselinesAfterPersist", () => {
  it("conserva baseline local en campos no editados tras guardar otro campo", () => {
    const prevProject = {
      specContent: "spec A",
      apiContractsContent: "api B",
      stages: [],
    };
    const nextFromServer = {
      specContent: "spec A saved",
      apiContractsContent: "api B from server drift",
      stages: [],
    };
    const merged = mergeProjectBaselinesAfterPersist(nextFromServer, {
      savedField: "specContent",
      prevProject,
      activeStageId: null,
      localFields: {
        specContent: "spec A saved",
        apiContractsContent: "api B",
      },
    });
    assert.equal(merged.specContent, "spec A saved");
    assert.equal(merged.apiContractsContent, "api B");
  });

  it("no pisa baseline del servidor si el campo local fue editado", () => {
    const prevProject = {
      specContent: "spec A",
      apiContractsContent: "api B",
      stages: [],
    };
    const nextFromServer = {
      specContent: "spec A saved",
      apiContractsContent: "api B from server",
      stages: [],
    };
    const merged = mergeProjectBaselinesAfterPersist(nextFromServer, {
      savedField: "specContent",
      prevProject,
      activeStageId: null,
      localFields: {
        specContent: "spec A saved",
        apiContractsContent: "api B edited",
      },
    });
    assert.equal(merged.apiContractsContent, "api B from server");
  });
});
