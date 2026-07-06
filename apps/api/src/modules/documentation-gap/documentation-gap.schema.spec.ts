import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reportDocumentationGapBodySchema } from "@theforge/shared-types";
import {
  buildTheforgeProjectJson,
  theforgeProjectJsonSpecKitFile,
} from "../projects/handoff-export.util.js";

describe("documentation-gap schemas", () => {
  it("rechaza description corta sin referencia válida", () => {
    const result = reportDocumentationGapBodySchema.safeParse({
      description: "too short",
      evidence: { reference: "random text" },
      affectedArtifacts: ["blueprint"],
    });
    assert.equal(result.success, false);
  });

  it("acepta body válido con referencia § y artefactos", () => {
    const result = reportDocumentationGapBodySchema.safeParse({
      description:
        "El Blueprint omite la entidad Pagos descrita en §3 del MDD; el código ya implementa el módulo correctamente.",
      evidence: { reference: "§3 Modelo de Datos", codePaths: ["src/payments/"] },
      affectedArtifacts: ["blueprint", "apiContracts"],
    });
    assert.equal(result.success, true);
  });

  it("acepta referencia docs/sdd/tasks.md", () => {
    const result = reportDocumentationGapBodySchema.safeParse({
      description:
        "La tarea T-04 en tasks.md describe un endpoint DELETE que no existe en el MDD ni en contratos API.",
      evidence: { reference: "docs/sdd/tasks.md T-04" },
      affectedArtifacts: ["tasks"],
    });
    assert.equal(result.success, true);
  });
});

describe("handoff .theforge-project.json", () => {
  const project = {
    id: "proj-abc",
    name: "Demo",
    complexity: "MEDIUM" as const,
    stages: [{ id: "stage-1", projectId: "proj-abc", ordinal: 1, mddContent: "# MDD\n" }],
  };

  it("buildTheforgeProjectJson incluye deliveryGate cuando hay MDD sustancial", () => {
    const longMdd = `# MDD\n\n## 1. Contexto\n\n${"x".repeat(90)}`;
    const json = buildTheforgeProjectJson({
      ...project,
      stages: [{ ...project.stages[0], mddContent: longMdd }],
    } as never);
    assert.ok(json.deliveryGate);
    assert.equal(typeof json.deliveryGate.ok, "boolean");
    assert.ok(Array.isArray(json.deliveryGate.blockers));
  });

  it("buildTheforgeProjectJson incluye projectId, stageId y mcp.tool", () => {
    const json = buildTheforgeProjectJson(project as never);
    assert.equal(json.projectId, "proj-abc");
    assert.equal(json.stageId, "stage-1");
    assert.equal(json.mcp.tool, "report_documentation_gap");
    assert.ok(json.artifactPaths["Constitución (MDD)"]);
  });

  it("theforgeProjectJsonSpecKitFile genera path raíz", () => {
    const file = theforgeProjectJsonSpecKitFile(project as never);
    assert.equal(file.path, ".theforge-project.json");
    const parsed = JSON.parse(file.content) as ReturnType<typeof buildTheforgeProjectJson>;
    assert.equal(parsed.projectName, "Demo");
  });
});
