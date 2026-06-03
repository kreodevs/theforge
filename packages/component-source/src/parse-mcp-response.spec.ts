import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseMcpResponse } from "../src/parse-mcp-response.js";
import { NullComponentSource } from "../src/null-component-source.js";

describe("parseMcpResponse", () => {
  test("parses direct JSON", () => {
    const raw = '{"jsonrpc":"2.0","id":1,"result":{"content":[]}}';
    const parsed = parseMcpResponse(raw) as { result?: { content: unknown[] } };
    assert.ok(parsed?.result);
    assert.deepEqual(parsed.result.content, []);
  });

  test("parses SSE data line", () => {
    const raw = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{}}\n\n";
    const parsed = parseMcpResponse(raw) as { id?: number };
    assert.equal(parsed?.id, 2);
  });

  test("returns null for unparseable body", () => {
    assert.equal(parseMcpResponse("not json"), null);
  });
});

describe("NullComponentSource", () => {
  test("checkHealth reports unavailable", async () => {
    const source = new NullComponentSource();
    const health = await source.checkHealth();
    assert.equal(health.ok, false);
    assert.match(health.error ?? "", /not configured/i);
  });

  test("tool calls return unavailable envelope", async () => {
    const source = new NullComponentSource();
    const result = await source.listModules("user-1");
    const text = result.content[0]?.text ?? "";
    assert.match(text, /component_source_unavailable/);
  });
});
