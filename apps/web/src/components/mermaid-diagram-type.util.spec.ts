import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultMermaidViewMode,
  detectMermaidDiagramType,
  isExcalidrawSupported,
  isMermaidCodeBlock,
  isNativeExcalidraw,
  looksLikeMermaidSyntax,
  mermaidDiagramHeaderLine,
} from "./mermaid-diagram-type.util.js";

describe("mermaidDiagramHeaderLine", () => {
  it("returns first non-empty line", () => {
    assert.equal(mermaidDiagramHeaderLine("flowchart\n  A --> B"), "flowchart");
  });
});

describe("detectMermaidDiagramType", () => {
  it("detects flowchart without direction", () => {
    assert.equal(detectMermaidDiagramType("flowchart\n  A --> B"), "flowchart");
  });

  it("detects flowchart with direction", () => {
    assert.equal(detectMermaidDiagramType("flowchart TD\n  A --> B"), "flowchart");
    assert.equal(detectMermaidDiagramType("flowchart LR\n  A --> B"), "flowchart");
  });

  it("detects graph with direction as flowchart", () => {
    assert.equal(detectMermaidDiagramType("graph TD;\n  A-->B"), "flowchart");
  });

  it("detects ER, sequence, class, state diagrams", () => {
    assert.equal(
      detectMermaidDiagramType("erDiagram\n  USER ||--o{ ORDER : places"),
      "erDiagram",
    );
    assert.equal(detectMermaidDiagramType("sequenceDiagram\n  A->>B: hi"), "sequenceDiagram");
    assert.equal(detectMermaidDiagramType("classDiagram\n  class Foo"), "classDiagram");
    assert.equal(detectMermaidDiagramType("stateDiagram-v2\n  [*] --> Idle"), "stateDiagram");
  });

  it("returns unsupported for gantt and bare graph", () => {
    assert.equal(detectMermaidDiagramType("gantt\n  title Plan"), "unsupported");
    assert.equal(detectMermaidDiagramType("graph\n  A --> B"), "unsupported");
  });
});

describe("isExcalidrawSupported", () => {
  it("supports flowchart and ER/sequence/class", () => {
    assert.equal(isExcalidrawSupported("flowchart"), true);
    assert.equal(isExcalidrawSupported("erDiagram"), true);
    assert.equal(isExcalidrawSupported("sequenceDiagram"), true);
    assert.equal(isExcalidrawSupported("classDiagram"), true);
  });

  it("does not support state or unsupported", () => {
    assert.equal(isExcalidrawSupported("stateDiagram"), false);
    assert.equal(isExcalidrawSupported("unsupported"), false);
  });
});

describe("isNativeExcalidraw", () => {
  it("is true only for flowchart", () => {
    assert.equal(isNativeExcalidraw("flowchart"), true);
    assert.equal(isNativeExcalidraw("erDiagram"), false);
  });
});

describe("looksLikeMermaidSyntax", () => {
  it("matches flowchart without direction", () => {
    assert.equal(looksLikeMermaidSyntax("flowchart\n  A --> B"), true);
  });

  it("does not match prose or graph-internal paths", () => {
    assert.equal(looksLikeMermaidSyntax("graph-internal/foo"), false);
    assert.equal(looksLikeMermaidSyntax("Not a diagram"), false);
  });

  it("matches graph with direction", () => {
    assert.equal(looksLikeMermaidSyntax("graph LR\n  A --> B"), true);
  });
});

describe("isMermaidCodeBlock", () => {
  it("accepts language-mermaid class even with odd body", () => {
    assert.equal(isMermaidCodeBlock("some text", "language-mermaid"), true);
  });

  it("accepts syntax without mermaid class", () => {
    assert.equal(isMermaidCodeBlock("sequenceDiagram\n  A->>B: x"), true);
  });
});

describe("defaultMermaidViewMode", () => {
  it("prefers excalidraw for supported types", () => {
    assert.equal(defaultMermaidViewMode("flowchart\n  A --> B"), "excalidraw");
    assert.equal(defaultMermaidViewMode("sequenceDiagram\n  A->>B: hi"), "excalidraw");
  });

  it("uses svg for unsupported types", () => {
    assert.equal(defaultMermaidViewMode("stateDiagram-v2\n  [*] --> X"), "svg");
    assert.equal(defaultMermaidViewMode("gantt\n  title T"), "svg");
  });
});
