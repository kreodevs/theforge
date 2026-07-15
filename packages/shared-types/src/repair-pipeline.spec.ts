import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runRepairPipeline, classifyAndRepair } from "./repair-pipeline.js";

describe("runRepairPipeline", () => {
  it("repairs mermaid code blocks", () => {
    const input = "```mermaid\ngraph TD\n  A -->B\n```";
    const { text, result } = runRepairPipeline(input);
    assert.equal(result.changed, true);
    assert.ok(result.byPattern.mermaid >= 1);
    assert.ok(text.includes("flowchart TD"));
  });

  it("repairs SQL code blocks", () => {
    const input = "```sql\nCREATE TABLE users(id SERIAL PRIMARY KEY, name TEXT)\n```";
    const { text, result } = runRepairPipeline(input);
    assert.equal(result.changed, true);
    assert.ok(result.byPattern.sql >= 1);
  });

  it("skips patterns in skipPatterns", () => {
    const input = "```mermaid\ngraph TD\n  A -->B\n```";
    const { result } = runRepairPipeline(input, { skipPatterns: ["mermaid"] });
    assert.equal(result.changed, false);
  });

  it("only repairs patterns in onlyPatterns", () => {
    const input = "```mermaid\ngraph TD\n  A -->B\n```\n\n```sql\nCREATE TABLE t(id INT)\n```";
    const { result } = runRepairPipeline(input, { onlyPatterns: ["mermaid"] });
    assert.ok(result.byPattern.mermaid >= 1);
    assert.equal(result.byPattern.sql, undefined);
  });

  it("handles multiple code blocks", () => {
    const input = [
      "```mermaid\ngraph TD\n  A -->B\n```",
      "Some text here",
      "```sql\nCREATE TABLE t(id INT)\n```",
    ].join("\n\n");
    const { result } = runRepairPipeline(input);
    assert.ok(result.repairedCount >= 1);
    assert.ok(result.byPattern.mermaid >= 1);
  });

  it("returns unchanged text for no repairs needed", () => {
    const input = "Just a simple paragraph with no code blocks.";
    const { text, result } = runRepairPipeline(input);
    assert.equal(result.changed, false);
    assert.equal(result.repairedCount, 0);
  });
});

describe("classifyAndRepair", () => {
  it("repairs a mermaid string", () => {
    const r = classifyAndRepair("graph TD\n  A -->B\n  B -->C");
    assert.equal(r.changed, true);
    assert.ok(r.text.includes("flowchart TD"));
  });

  it("returns unchanged for unknown pattern", () => {
    const r = classifyAndRepair("just some random text");
    assert.equal(r.changed, false);
  });
});
