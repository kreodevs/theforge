import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkMissingDbgaCoreEntitiesInMdd,
  checkPlatformTablesOutsideBrd,
  collectDomainInventoryConformanceGaps,
} from "./domain-inventory-conformance.util.js";

const MDD_WITH_AUTH_ONLY = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE roles (id UUID PRIMARY KEY);
CREATE TABLE sessions (id UUID PRIMARY KEY);
\`\`\`
`;

const DBGA = `
CREATE TABLE watchlists (id UUID PRIMARY KEY);
CREATE TABLE operations (id UUID PRIMARY KEY);
CREATE TABLE credentials (id UUID PRIMARY KEY);
CREATE TABLE dashboard_configs (id UUID PRIMARY KEY);
CREATE TABLE otp_sessions (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
`;

describe("domain-inventory-conformance.util", () => {
  it("detects missing DBGA core entities in MDD §3", () => {
    const missing = checkMissingDbgaCoreEntitiesInMdd({
      dbgaMarkdown: DBGA,
      mddMarkdown: MDD_WITH_AUTH_ONLY,
    });
    assert.ok(missing.includes("watchlists"));
    assert.ok(missing.includes("users"));
  });

  it("does not flag platform tables when BRD mentions MCP/agente", () => {
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE mcp_plugins (id UUID PRIMARY KEY);
CREATE TABLE conversation_memory (id UUID PRIMARY KEY);
\`\`\`
`;
    const brd = `
## 3. Capacidades
### Integración MCP y agente IA
Orquestación de herramientas MCP con memoria del contexto conversacional.
`;
    const orphans = checkPlatformTablesOutsideBrd({
      brdMarkdown: brd,
      dbgaMarkdown: DBGA,
      mddMarkdown: mdd,
    });
    assert.deepEqual(orphans, []);
  });

  it("flags platform tables without BRD/DBGA justification", () => {
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE roles (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
CREATE TABLE mcp_plugins (id UUID PRIMARY KEY);
\`\`\`
`;
    const orphans = checkPlatformTablesOutsideBrd({
      brdMarkdown: "## 3 Capacidades\n### Gestión de leads",
      dbgaMarkdown: DBGA,
      mddMarkdown: mdd,
    });
    assert.deepEqual(orphans.sort(), ["mcp_plugins", "messages"].sort());
  });

  it("collectDomainInventoryConformanceGaps produces actionable messages", () => {
    const report = collectDomainInventoryConformanceGaps({
      dbgaMarkdown: DBGA,
      mddMarkdown: MDD_WITH_AUTH_ONLY,
    });
    assert.ok(report.gaps.some((g) => g.includes("DBGA faltantes")));
  });
});
