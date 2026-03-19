import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSddReadQuery } from "./sdd-query-guard.js";

test("rechaza escritura", () => {
  assert.throws(() => validateSddReadQuery("CREATE (n:Foo)", { projectId: "p1" }), /solo lectura/);
});

test("exige projectId o stageId", () => {
  assert.throws(() => validateSddReadQuery("MATCH (p:Project) RETURN p"), /projectId|stageId/);
});

test("acepta lectura con projectId", () => {
  validateSddReadQuery("MATCH (p:Project {id: $projectId}) RETURN p", { projectId: "uuid-here" });
});

test("acepta lectura con stageId", () => {
  validateSddReadQuery("MATCH (s:Stage {id: $stageId}) RETURN s", { stageId: "uuid-here" });
});
