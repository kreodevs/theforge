import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  annotateJustifiedPlatformTablesInMdd,
  isPlatformTableJustified,
  listUnjustifiedPlatformTables,
} from "./platform-table-justify.util.js";

const MDD = `
## 1. Contexto
Plataforma multi-agente con integración MCP y memoria contextual del chat.

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE mcp_plugins (id UUID PRIMARY KEY);
CREATE TABLE conversation_memory (id UUID PRIMARY KEY);
\`\`\`
`;

describe("platform-table-justify.util", () => {
  it("justifies platform tables when MDD §1 mentions MCP and memoria", () => {
    assert.equal(isPlatformTableJustified("mcp_plugins", { mddMarkdown: MDD }), true);
    assert.equal(isPlatformTableJustified("conversation_memory", { mddMarkdown: MDD }), true);
    assert.deepEqual(
      listUnjustifiedPlatformTables({ mddMarkdown: MDD }),
      [],
    );
  });

  it("annotates justified CREATE TABLE with platform comment", () => {
    const { markdown, annotated } = annotateJustifiedPlatformTablesInMdd(MDD, { mddMarkdown: MDD });
    assert.ok(annotated.includes("mcp_plugins"));
    assert.match(markdown, /\[platform:mcp_plugins\]/);
  });

  it("still flags orphans when no anchor in corpus", () => {
    const bare = `
## 3. Modelo
\`\`\`sql
CREATE TABLE mcp_plugins (id UUID PRIMARY KEY);
\`\`\`
`;
    assert.deepEqual(listUnjustifiedPlatformTables({ mddMarkdown: bare }), ["mcp_plugins"]);
  });
});
