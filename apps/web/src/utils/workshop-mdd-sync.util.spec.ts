import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveMddFetchMerge } from "./workshop-mdd-sync.util.js";

const SERVER = "# Master Design Document\n\n## 1. Contexto\n\nTexto servidor.";
const LOCAL_SAVED = SERVER;
const LOCAL_EDITED = "# Master Design Document\n\n## 1. Contexto\n\nEdición local.";
const PATTERN_BLOCK =
  "#### Patrones activos\n- [X] **Hexagonal:** …\n\n# Master Design Document\n\n## 1. Contexto\n";

describe("resolveMddFetchMerge", () => {
  it("refresh: local vacío → aplica servidor", () => {
    const r = resolveMddFetchMerge({
      switchingProject: false,
      sameProjectLoaded: false,
      mddPersisting: false,
      localMdd: "",
      persistedMdd: "",
      serverMdd: SERVER,
    });
    assert.equal(r.preserveMddLocal, false);
    assert.equal(r.nextMddContent, SERVER);
    assert.equal(r.updatePersistedBaseline, true);
  });

  it("tras grabar: fetch obsoleto → conserva local guardado", () => {
    const r = resolveMddFetchMerge({
      switchingProject: false,
      sameProjectLoaded: true,
      mddPersisting: false,
      localMdd: LOCAL_SAVED,
      persistedMdd: LOCAL_SAVED,
      serverMdd: LOCAL_EDITED,
    });
    assert.equal(r.preserveMddLocal, true);
    assert.equal(r.nextMddContent, LOCAL_SAVED);
    assert.equal(r.updatePersistedBaseline, true);
  });

  it("cambio de proyecto: no arrastra MDD del proyecto anterior", () => {
    const r = resolveMddFetchMerge({
      switchingProject: true,
      sameProjectLoaded: false,
      mddPersisting: false,
      localMdd: PATTERN_BLOCK,
      persistedMdd: PATTERN_BLOCK,
      serverMdd: "",
    });
    assert.equal(r.preserveMddLocal, false);
    assert.equal(r.nextMddContent, "");
    assert.equal(r.updatePersistedBaseline, true);
  });

  it("regeneración MDD en background: servidor nuevo reemplaza local guardado", () => {
    const serverNew =
      "# Master Design Document: Copiloto\n\n---\n\n## 1. Contexto\n\nTexto regenerado por worker.";
    const localOld = "# Master Design Document\n\n## 1. Contexto\n\nTexto anterior.";
    const r = resolveMddFetchMerge({
      switchingProject: false,
      sameProjectLoaded: true,
      mddPersisting: false,
      preferServerMdd: true,
      localMdd: localOld,
      persistedMdd: localOld,
      serverMdd: serverNew,
    });
    assert.equal(r.preserveMddLocal, false);
    assert.equal(r.nextMddContent, serverNew);
    assert.equal(r.updatePersistedBaseline, true);
  });

  it("mismo proyecto con cambios sin guardar → conserva local sin actualizar baseline", () => {
    const r = resolveMddFetchMerge({
      switchingProject: false,
      sameProjectLoaded: true,
      mddPersisting: false,
      localMdd: LOCAL_EDITED,
      persistedMdd: LOCAL_SAVED,
      serverMdd: LOCAL_SAVED,
    });
    assert.equal(r.preserveMddLocal, true);
    assert.equal(r.nextMddContent, LOCAL_EDITED);
    assert.equal(r.updatePersistedBaseline, false);
  });
});
