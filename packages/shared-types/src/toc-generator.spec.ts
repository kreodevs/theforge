import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateToc, insertToc } from "./toc-generator.js";

describe("generateToc", () => {
  const sampleMd = `# Title

## Section A

Some text

### Sub A.1

More text

### Sub A.2

## Section B

### Sub B.1

#### Deep B.1.1

## Section C
`;

  it("generates TOC from headings", () => {
    const toc = generateToc(sampleMd);
    assert.ok(toc.includes("[Section A](#section-a)"));
    assert.ok(toc.includes("[Section B](#section-b)"));
    assert.ok(toc.includes("[Section C](#section-c)"));
  });

  it("includes subheadings with indent", () => {
    const toc = generateToc(sampleMd);
    assert.ok(toc.includes("  - [Sub A.1](#sub-a1)"));
    assert.ok(toc.includes("  - [Sub A.2](#sub-a2)"));
  });

  it("respects minDepth", () => {
    const toc = generateToc(sampleMd, { minDepth: 3 });
    assert.ok(!toc.includes("Section A"));
    assert.ok(toc.includes("Sub A.1"));
  });

  it("respects maxDepth", () => {
    const toc = generateToc(sampleMd, { maxDepth: 3 });
    assert.ok(!toc.includes("Deep B.1.1"));
    assert.ok(toc.includes("Sub B.1"));
  });

  it("returns empty for no matching headings", () => {
    const toc = generateToc("# Only H1\n\nSome text", { minDepth: 2 });
    assert.equal(toc, "");
  });

  it("generates anchors by default", () => {
    const toc = generateToc("## Hello World");
    assert.ok(toc.includes("[Hello World](#hello-world)"));
  });

  it("can disable anchors", () => {
    const toc = generateToc("## Hello World", { useAnchors: false });
    assert.ok(toc.includes("- Hello World"));
    assert.ok(!toc.includes("("));
  });
});

describe("insertToc", () => {
  it("inserts after H1", () => {
    const input = "# Title\n\nSome content\n\n## Section A\n";
    const result = insertToc(input);
    assert.ok(result.startsWith("# Title\n"));
    assert.ok(result.includes("[Section A](#section-a)"));
    assert.ok(result.includes("Some content"));
  });

  it("replaces <!-- toc --> marker", () => {
    const input = "# Title\n\n<!-- toc -->\n\n## Section A\n";
    const result = insertToc(input);
    assert.ok(!result.includes("<!-- toc -->"));
    assert.ok(result.includes("[Section A](#section-a)"));
  });
});
