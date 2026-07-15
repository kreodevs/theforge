import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderDocument, renderSection } from "../mdd-markdown-transpiler.js";
import {
  applyPatch,
} from "../document-patch-engine.js";
import {
  runValidationGates,
} from "../validation-gates.js";
import {
  parseDualOutputResponse,
} from "../document-response-parser.js";
import type { MddDocumentAst, DocumentSection } from "@theforge/shared-types/document-ast";

const minimalDocument: MddDocumentAst = {
  version: "2.0",
  documentId: "test-doc",
  title: "Test Document",
  sections: [
    {
      id: "sec-title",
      type: "title",
      heading: "Título",
      order: 0,
      title: "Test Document Title",
      subtitle: "A test",
    } as unknown as DocumentSection,
    {
      id: "sec-ctx",
      type: "context_map",
      heading: "Mapa de Contextos",
      order: 1,
      contexts: [
        {
          id: "ctx-1",
          name: "E-commerce",
          order: 1,
          description: "Ventas online",
          features: ["Catálogo", "Checkout"],
          entities: ["Product", "Order"],
        },
      ],
    } as unknown as DocumentSection,
  ],
};

// ── Transpiler ──────────────────────────────────────────────────────────────
describe("MddMarkdownTranspiler", () => {
  it("renders a title section", () => {
    const md = renderSection(minimalDocument.sections[0]!);
    assert.ok(md.includes("# Test Document Title"));
    assert.ok(md.includes("A test"));
  });

  it("renders a context map section", () => {
    const md = renderSection(minimalDocument.sections[1]!);
    assert.ok(md.includes("## Mapa de Contextos"));
    assert.ok(md.includes("### E-commerce"));
    assert.ok(md.includes("- Catálogo"));
    assert.ok(md.includes("- Checkout"));
  });

  it("renders full document", () => {
    const md = renderDocument(minimalDocument);
    assert.ok(md.includes("# Test Document Title"));
    assert.ok(md.includes("## Mapa de Contextos"));
    // Sections separated by ---
    assert.ok(md.includes("---"));
  });
});

// ── Patch Engine ────────────────────────────────────────────────────────────
describe("DocumentPatchEngine", () => {
  it("applies ADD_ENTITY operation", () => {
    const domainModelSec: DocumentSection = {
      id: "sec-model",
      type: "domain_model",
      heading: "Modelo de Dominio",
      order: 2,
      entities: [],
    } as any;

    const doc: MddDocumentAst = {
      ...minimalDocument,
      sections: [...minimalDocument.sections, domainModelSec],
    };

    const result = applyPatch(doc, [
      {
        id: "op-1",
        type: "ADD",
        target: { sectionId: "sec-model" },
        path: "sections[sec-model].entities",
        reason: "test add entity",
        value: {
          id: "ent-user",
          name: "User",
          fields: [{ id: "f-1", name: "id", type: "UUID" }],
        },
      },
    ]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.appliedOperations, 1);
    const model = result.ast.sections.find((s) => s.id === "sec-model") as any;
    assert.strictEqual(model.entities.length, 1);
    assert.strictEqual(model.entities[0].name, "User");
  });

  it("fails on duplicate entity ADD", () => {
    const domainModelSec: DocumentSection = {
      id: "sec-model2",
      type: "domain_model",
      heading: "Modelo 2",
      order: 2,
      entities: [{ id: "e-1", name: "User", fields: [] }],
    } as any;

    const doc: MddDocumentAst = { ...minimalDocument, sections: [...minimalDocument.sections, domainModelSec] };

    const result = applyPatch(doc, [
      {
        id: "op-dup",
        type: "ADD",
        target: { sectionId: "sec-model2" },
        path: "entities",
        reason: "test duplicate add",
        value: { id: "e-2", name: "User", fields: [] },
      },
    ]);

    assert.strictEqual(result.success, false);
    assert.ok(result.failedOperations[0]?.reason.includes("already exists"));
  });

  it("MODIFY updates entity description", () => {
    const ent = { id: "e-1", name: "Order", description: "Old", fields: [] };
    const domainModelSec: DocumentSection = {
      id: "sec-model3",
      type: "domain_model",
      heading: "Modelo 3",
      order: 2,
      entities: [ent],
    } as any;

    const doc: MddDocumentAst = { ...minimalDocument, sections: [...minimalDocument.sections, domainModelSec] };

    const result = applyPatch(doc, [
      {
        id: "op-mod",
        type: "MODIFY",
        target: { sectionId: "sec-model3", entityId: "Order" },
        path: "entities[Order].description",
        reason: "test modify desc",
        value: { description: "New desc" },
      },
    ]);

    assert.strictEqual(result.success, true);
    const model = result.ast.sections.find((s) => s.id === "sec-model3") as any;
    assert.strictEqual(model.entities[0].description, "New desc");
  });

  it("DELETE removes entity", () => {
    const ent = { id: "e-1", name: "Order", fields: [] };
    const domainModelSec: DocumentSection = {
      id: "sec-model4",
      type: "domain_model",
      heading: "Modelo 4",
      order: 2,
      entities: [ent],
    } as any;

    const doc: MddDocumentAst = { ...minimalDocument, sections: [...minimalDocument.sections, domainModelSec] };

    const result = applyPatch(doc, [
      {
        id: "op-del",
        type: "DELETE",
        target: { sectionId: "sec-model4", entityId: "Order" },
        path: "entities[Order]",
        reason: "test delete entity",
      },
    ]);

    assert.strictEqual(result.success, true);
    const model = result.ast.sections.find((s) => s.id === "sec-model4") as any;
    assert.strictEqual(model.entities.length, 0);
  });
});

// ── Validation Gates ─────────────────────────────────────────────────────────
describe("ValidationGates", () => {
  it("passes schema check on minimal document", () => {
    const res = runValidationGates(minimalDocument);
    assert.strictEqual(res.ok, false); // no domain/physical model = completeness fails
    // but schema gate itself should pass
    const schemaGate = res.gates.find((g) => g.gateName === "SCHEMA_CHECK");
    assert.ok(schemaGate?.ok);
  });

  it("fails completeness without model section", () => {
    const res = runValidationGates(minimalDocument);
    const comp = res.gates.find((g) => g.gateName === "COMPLETENESS_CHECK");
    assert.ok(comp && !comp.ok);
    assert.ok(comp.errors.some((e) => e.includes("modelo de entidades")));
  });

  it("fails unique check on duplicate entities", () => {
    const domainModelSec: DocumentSection = {
      id: "sec-m",
      type: "domain_model",
      heading: "Modelo",
      order: 2,
      entities: [
        { id: "e1", name: "User", fields: [] },
        { id: "e2", name: "User", fields: [] },
      ],
    } as any;

    const doc: MddDocumentAst = { ...minimalDocument, sections: [...minimalDocument.sections, domainModelSec] };
    const res = runValidationGates(doc);
    const uniq = res.gates.find((g) => g.gateName === "UNIQUE_CHECK");
    assert.ok(uniq && !uniq.ok);
  });
});

// ── Dual Output Parser ──────────────────────────────────────────────────────
describe("DocumentResponseParser", () => {
  it("parses fenced JSON dual-output", () => {
    const response = `Here is the document.

\`\`\`json
{
  "protocolVersion": "dual-output-v1",
  "documentVersion": 1,
  "documentType": "mdd",
  "documentAst": {
    "version": "2.0",
    "documentId": "doc-1",
    "title": "Doc",
    "sections": [
      {
        "id": "s1",
        "type": "title",
        "heading": "Title",
        "order": 0,
        "title": "Doc"
      }
    ]
  },
  "documentMarkdown": "# Doc\\n"
}
\`\`\`

Thank you.`;

    const result = parseDualOutputResponse(response, { enforceDeterminism: true });
    assert.strictEqual(result.success, true);
    assert.ok(result.response);
    assert.strictEqual(result.response!.documentType, "mdd");
    assert.ok(result.canonicalMarkdown); // because received markdown is shorter than transpiled
  });

  it("falls back to markdown when no JSON present", () => {
    const md = "Just markdown text.";
    const result = parseDualOutputResponse(md);
    assert.strictEqual(result.success, true);
    assert.ok(result.fallbackMarkdown);
    assert.strictEqual(result.fallbackMarkdown, md);
    assert.ok(result.error?.includes("No JSON dual-output block found"));
  });
});
