import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveMcpHealthUrl,
  shouldFallbackHealthToMcpTools,
} from "./mcp-health-probe.js";

describe("mcp-health-probe", () => {
  it("deriveMcpHealthUrl sustituye /mcp por /health", () => {
    assert.equal(deriveMcpHealthUrl("https://ui.nuxt.com/mcp"), "https://ui.nuxt.com/health");
    assert.equal(deriveMcpHealthUrl("https://host.example/mcp/"), "https://host.example/health");
  });

  it("shouldFallbackHealthToMcpTools ante 404 de /health", () => {
    assert.equal(
      shouldFallbackHealthToMcpTools('HTTP 404: { "message": "Page not found: /health" }'),
      true,
    );
  });
});
