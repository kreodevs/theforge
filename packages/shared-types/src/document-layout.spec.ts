import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCUMENT_PATH_MAP_STATIC,
  formatDocumentPathMapTable,
  formatDocumentPathMapTableStatic,
  formatWorkshopSupplementSection,
  resolveDocumentPathMap,
} from "./document-layout.js";

describe("document-layout", () => {
  it("includes full Workshop spec-kit map (not only MDD/Spec/Plan/Tasks)", () => {
    const labels = DOCUMENT_PATH_MAP_STATIC.map((e) => e.label);
    assert.ok(labels.includes("Constitución (MDD)"));
    assert.ok(labels.includes("Arquitectura"));
    assert.ok(labels.includes("Casos de uso"));
    assert.ok(labels.includes("Historias de usuario"));
    assert.ok(labels.includes("Design System"));
    assert.ok(labels.includes("Contratos API"));
    assert.ok(labels.includes("Flujos lógicos"));
    assert.ok(labels.includes("Infra"));
    assert.ok(labels.includes("ADRs"));
    assert.ok(DOCUMENT_PATH_MAP_STATIC.length >= 15);
  });

  it("resolves featureDir in primary and mirror paths", () => {
    const featureDir = "specs/042-demo";
    const resolved = resolveDocumentPathMap(featureDir);
    const architecture = resolved.find((e) => e.label === "Arquitectura");
    assert.equal(architecture?.primary, `${featureDir}/architecture.md`);
    assert.equal(architecture?.mirror, "docs/sdd/architecture.md");
  });

  it("formatDocumentPathMapTable includes resolved paths and optional labels", () => {
    const table = formatDocumentPathMapTable("specs/001-kms");
    assert.ok(table.includes("specs/001-kms/architecture.md"));
    assert.ok(table.includes("docs/sdd/api-contracts.md"));
    assert.ok(table.includes("(si existe)"));
  });

  it("formatDocumentPathMapTableStatic keeps featureDir placeholder", () => {
    const table = formatDocumentPathMapTableStatic();
    assert.ok(table.includes("{featureDir}/spec.md"));
    assert.ok(table.includes("docs/sdd/blueprint.md"));
  });

  it("formatWorkshopSupplementSection documents BRD and Gobernanza IA", () => {
    const section = formatWorkshopSupplementSection("specs/001-demo");
    assert.ok(section.includes("Artefactos Workshop"));
    assert.ok(section.includes("BRD"));
    assert.ok(section.includes("Gobernanza IA"));
    assert.ok(section.includes("specs/001-demo/research.md"));
  });
});
