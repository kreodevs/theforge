import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNotionIndexHtml,
  notionExportId,
  notionPageBasename,
  notionSafeSegment,
  notionStageFolderName,
  parseCsv,
  resolveStageDocFieldFromBasename,
  serializeCsv,
} from "./project-notion-portability.js";

describe("project-notion-portability", () => {
  it("notionExportId strips dashes from uuid", () => {
    assert.equal(
      notionExportId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
      "a1b2c3d4e5f67890abcdef1234567890",
    );
  });

  it("notionPageBasename follows Notion title + id pattern", () => {
    assert.equal(
      notionPageBasename("MDD", "a1b2c3d4e5f67890abcdef1234567890"),
      "MDD a1b2c3d4e5f67890abcdef1234567890.md",
    );
  });

  it("notionSafeSegment removes illegal path chars", () => {
    assert.equal(notionSafeSegment('Proyecto: "Demo"'), 'Proyecto- -Demo-');
  });

  it("notionStageFolderName includes ordinal and export id", () => {
    assert.match(
      notionStageFolderName(2, "Delta", "a1b2c3d4e5f67890abcdef1234567890"),
      /^Etapa 2 — Delta a1b2c3d4e5f67890abcdef1234567890$/,
    );
  });

  it("serializeCsv and parseCsv round-trip quoted cells", () => {
    const csv = serializeCsv(["id", "title"], [["NEW-LEG-01", 'Linea con "comillas"']]);
    const parsed = parseCsv(csv);
    assert.deepEqual(parsed.headers, ["id", "title"]);
    assert.deepEqual(parsed.rows, [["NEW-LEG-01", 'Linea con "comillas"']]);
  });

  it("resolveStageDocFieldFromBasename maps known prefixes", () => {
    assert.equal(
      resolveStageDocFieldFromBasename("MDD a1b2c3d4e5f67890abcdef1234567890.md"),
      "mddContent",
    );
    assert.equal(resolveStageDocFieldFromBasename("Unknown page.md"), null);
  });

  it("buildNotionIndexHtml escapes html", () => {
    const html = buildNotionIndexHtml("<script>", [{ href: "x.md", label: "<b>" }]);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&lt;b&gt;/);
  });
});
