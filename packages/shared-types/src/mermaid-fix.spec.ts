import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessMermaidFixStrategy,
  repairMermaidBlockBody,
  resolveMermaidBlockForRender,
} from "./mermaid.js";

describe("assessMermaidFixStrategy — license portal fixture", () => {
  it("repara localmente par ticipant y ends huérfanos sin pedir LLM", () => {
    const broken = `sequenceDiagram
    par ticipant User as Cliente
  end
User->>Web: Selecciona tier`;
    const assessment = assessMermaidFixStrategy(broken);
    assert.equal(assessment.strategy, "repair");
    assert.ok(assessment.reasons.includes("participant_keyword_split"));
    const repaired = repairMermaidBlockBody(broken);
    assert.match(repaired, /participant User/i);
    assert.doesNotMatch(repaired, /par ticipant/i);
  });
});

describe("resolveMermaidBlockForRender", () => {
  it("inyecta sequenceDiagram si faltaba la cabecera", () => {
    const out = resolveMermaidBlockForRender(`participant A as Alice\nA->>B: hi`);
    assert.match(out, /^sequenceDiagram\b/im);
    assert.match(out, /participant A/i);
  });
});
