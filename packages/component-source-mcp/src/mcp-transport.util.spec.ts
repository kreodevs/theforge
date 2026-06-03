import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STATELESS_MCP_SESSION,
  buildMcpHttpHeaders,
  isStatelessMcpSession,
} from "./mcp-transport.util.js";

describe("mcp-transport.util", () => {
  it("stateless session omite mcp-session-id en headers", () => {
    const headers = buildMcpHttpHeaders(STATELESS_MCP_SESSION);
    assert.equal(headers["mcp-session-id"], undefined);
    assert.ok(headers.Accept.includes("text/event-stream"));
  });

  it("session con id incluye mcp-session-id", () => {
    const headers = buildMcpHttpHeaders("abc-123", "tok");
    assert.equal(headers["mcp-session-id"], "abc-123");
    assert.equal(headers.Authorization, "Bearer tok");
  });

  it("isStatelessMcpSession detecta marcador interno", () => {
    assert.equal(isStatelessMcpSession(STATELESS_MCP_SESSION), true);
    assert.equal(isStatelessMcpSession("real-session"), false);
  });
});
