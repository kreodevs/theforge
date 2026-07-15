import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyPattern, classifyCodeBlock, type ContentPattern } from "./pattern-classifier.js";

describe("classifyPattern", () => {
  it("classifies mermaid flowchart", () => {
    const r = classifyPattern("graph TD\n  A --> B\n  B --> C");
    assert.equal(r.pattern, "mermaid");
    assert.equal(r.meta?.diagramType, "flowchart");
  });

  it("classifies mermaid sequence diagram", () => {
    const r = classifyPattern("sequenceDiagram\n  Alice->>Bob: Hello");
    assert.equal(r.pattern, "mermaid");
    assert.equal(r.meta?.diagramType, "sequence");
  });

  it("classifies SQL CREATE TABLE", () => {
    const r = classifyPattern("CREATE TABLE usuarios (\n  id SERIAL PRIMARY KEY,\n  nombre VARCHAR(100) NOT NULL\n)");
    assert.equal(r.pattern, "sql");
  });

  it("classifies SQL with ALTER TABLE", () => {
    const r = classifyPattern("ALTER TABLE usuarios ADD COLUMN email TEXT");
    assert.equal(r.pattern, "sql");
  });

  it("classifies Dockerfile", () => {
    const r = classifyPattern("FROM node:22-alpine\nWORKDIR /app\nCOPY package.json .");
    assert.equal(r.pattern, "dockerfile");
  });

  it("classifies docker-compose", () => {
    const r = classifyPattern("services:\n  api:\n    image: node:22\n    ports:\n      - 3000:3000");
    assert.equal(r.pattern, "docker-compose");
  });

  it("classifies env file", () => {
    const r = classifyPattern("DATABASE_URL=postgres://localhost/db\nAPI_KEY=secret123\nPORT=3000");
    assert.equal(r.pattern, "env");
  });

  it("classifies JSON", () => {
    const r = classifyPattern('{"name": "test", "version": "1.0"}');
    assert.equal(r.pattern, "json");
  });

  it("classifies directory tree", () => {
    const r = classifyPattern("├── apps/\n│   ├── web/\n│   └── api/\n└── packages/\n    └── shared-types/");
    assert.equal(r.pattern, "directory-tree");
  });

  it("classifies markdown with headings and lists", () => {
    const r = classifyPattern("## Section\n\n- Item 1\n- Item 2\n\n**Bold text** here");
    assert.equal(r.pattern, "markdown");
  });

  it("returns unknown for gibberish", () => {
    const r = classifyPattern("xkcd 1234 random stuff");
    assert.equal(r.pattern, "unknown");
  });

  it("returns unknown for empty string", () => {
    const r = classifyPattern("");
    assert.equal(r.pattern, "unknown");
  });
});

describe("classifyCodeBlock", () => {
  it("classifies mermaid from lang tag", () => {
    const r = classifyCodeBlock("mermaid", "graph TD\n  A --> B");
    assert.equal(r.pattern, "mermaid");
    assert.equal(r.confidence, 0.99);
  });

  it("classifies SQL from lang tag", () => {
    const r = classifyCodeBlock("sql", "SELECT * FROM users");
    assert.equal(r.pattern, "sql");
  });

  it("classifies dockerfile from lang tag", () => {
    const r = classifyCodeBlock("dockerfile", "FROM node:22");
    assert.equal(r.pattern, "dockerfile");
  });

  it("classifies json from lang tag", () => {
    const r = classifyCodeBlock("json", '{"key": "value"}');
    assert.equal(r.pattern, "json");
  });

  it("classifies yaml from lang tag", () => {
    const r = classifyCodeBlock("yaml", "key: value");
    assert.equal(r.pattern, "yaml");
  });

  it("classifies env from lang tag", () => {
    const r = classifyCodeBlock("env", "PORT=3000");
    assert.equal(r.pattern, "env");
  });

  it("falls back to body analysis when no lang tag", () => {
    const r = classifyCodeBlock(null, "graph TD\n  A --> B\n  B --> C");
    assert.equal(r.pattern, "mermaid");
  });

  it("detects directory tree in text fence", () => {
    const r = classifyCodeBlock("text", "├── apps/\n│   └── web/");
    assert.equal(r.pattern, "directory-tree");
  });
});
