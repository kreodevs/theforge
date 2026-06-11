import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  legacyDocumentationRepoIds,
  mergeLegacyDocumentationByRepo,
  repoLabelFromProjectsCatalog,
} from "./legacy-documentation-merge.util.js";

describe("legacyDocumentationRepoIds", () => {
  test("usa todos los repoIds del scope", () => {
    assert.deepEqual(
      legacyDocumentationRepoIds({ repoIds: ["repo-a", "repo-b", "repo-c"] }, "fallback"),
      ["repo-a", "repo-b", "repo-c"],
    );
  });

  test("deduplica y recorta espacios", () => {
    assert.deepEqual(
      legacyDocumentationRepoIds({ repoIds: [" a ", "a", "b"] }, "fallback"),
      ["a", "b"],
    );
  });

  test("sin scope usa graphProjectId", () => {
    assert.deepEqual(legacyDocumentationRepoIds(undefined, "graph-1"), ["graph-1"]);
  });

  test("scope vacío cae en graphProjectId", () => {
    assert.deepEqual(legacyDocumentationRepoIds({ repoIds: [] }, "graph-2"), ["graph-2"]);
  });
});

describe("repoLabelFromProjectsCatalog", () => {
  test("prefiere roots[].name", () => {
    const label = repoLabelFromProjectsCatalog(
      [{ id: "proj", name: "WS", roots: [{ id: "r1", name: "oohbp2" }] }],
      "r1",
    );
    assert.equal(label, "oohbp2");
  });

  test("fallback acortado si no hay nombre", () => {
    assert.equal(repoLabelFromProjectsCatalog([], "abcdef12-3456"), "repo:abcdef12…");
  });
});

describe("mergeLegacyDocumentationByRepo", () => {
  test("concatena secciones con separador y omite vacíos", () => {
    const out = mergeLegacyDocumentationByRepo([
      { repoId: "aaaaaaaa-bbbb", label: "erp", markdown: "## Evidencia\n\nback" },
      { repoId: "cccccccc-dddd", label: "front", markdown: "" },
      { repoId: "eeeeeeee-ffff", label: "lib", markdown: "### Resumen\n\nlib" },
    ]);
    assert.match(out, /^## Repositorio: erp/);
    assert.match(out, /back/);
    assert.doesNotMatch(out, /front/);
    assert.match(out, /\n\n---\n\n/);
    assert.match(out, /## Repositorio: lib/);
    assert.match(out, /lib/);
  });

  test("un solo repo devuelve una sección", () => {
    const out = mergeLegacyDocumentationByRepo([
      { repoId: "repo-1", label: "solo", markdown: "contenido" },
    ]);
    assert.equal(out, "## Repositorio: solo (`repo-1…`)\n\ncontenido");
  });

  test("todo vacío → cadena vacía", () => {
    assert.equal(
      mergeLegacyDocumentationByRepo([
        { repoId: "a", label: "x", markdown: "  " },
      ]),
      "",
    );
  });
});
