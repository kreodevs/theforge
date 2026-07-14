import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessMermaidFixStrategy,
  repairMermaidBlockBody,
} from "./mermaid.js";

describe("assessMermaidFixStrategy — license portal fixture", () => {
  it("detecta daño estructural en sequenceDiagram del portal de licencias", () => {
    const broken = `sequenceDiagram
    par ticipant User as Cliente
  end
User->>Web: Selecciona tier`;
    const assessment = assessMermaidFixStrategy(broken);
    assert.ok(assessment.reasons.includes("participant_keyword_split"));
    const repaired = repairMermaidBlockBody(broken);
    assert.match(repaired, /participant User/i);
    assert.doesNotMatch(repaired, /par ticipant/i);
  });
});
