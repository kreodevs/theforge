import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendAgentProgressDone } from "./agentProgress.js";

describe("appendAgentProgressDone", () => {
  it("deduplicates consecutive identical poll progress (same agent + message)", () => {
    const first = appendAgentProgressDone([], {
      agent: "Inyector de diagramas (MDD)",
      message: "Diagramas Mermaid añadidos",
    });
    assert.equal(first.length, 1);

    const second = appendAgentProgressDone(first, {
      agent: "Inyector de diagramas (MDD)",
      message: "Diagramas Mermaid añadidos",
    });
    assert.equal(second.length, 1);
  });

  it("appends again when the same step runs after other nodes (delivery gate loop)", () => {
    let progress = appendAgentProgressDone([], {
      agent: "Arquitecto de Software",
      message: "Schema SQL y contratos de API definidos",
    });
    progress = appendAgentProgressDone(progress, {
      agent: "Auditor (calidad MDD)",
      message: "Calidad del MDD evaluada",
    });
    progress = appendAgentProgressDone(progress, {
      agent: "Arquitecto de Software",
      message: "Schema SQL y contratos de API definidos",
    });
    assert.equal(progress.length, 3);
  });
});
