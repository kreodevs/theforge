import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  callUiMcpToolJson,
  callUiMcpToolText,
  listUiMcpTools,
} from "./ui-mcp-transport.util.js";

type FetchArgs = { url: string; init: RequestInit };
const originalFetch = globalThis.fetch;
let lastCall: FetchArgs | null = null;

function stubFetch(status: number, body: string) {
  lastCall = null;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    lastCall = { url: String(input), init: init ?? {} };
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    } as unknown as Response;
  }) as typeof fetch;
}

describe("ui-mcp-transport — listUiMcpTools", () => {
  beforeEach(() => {
    lastCall = null;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("usa la URL de la conexión explícita (no env) y devuelve los nombres", async () => {
    stubFetch(
      200,
      JSON.stringify({
        jsonrpc: "2.0",
        id: "x",
        result: { tools: [{ name: "describe_capabilities" }, { name: "list_components" }] },
      }),
    );
    const tools = await listUiMcpTools({ url: "https://mcp.example.com/rpc", token: "t" });
    assert.deepEqual(tools, ["describe_capabilities", "list_components"]);
    assert.equal(lastCall?.url, "https://mcp.example.com/rpc");
    const headers = lastCall?.init.headers as Record<string, string>;
    assert.equal(headers["X-M2M-Token"], "t");
    assert.equal(headers.Authorization, "Bearer t");
  });

  it("parsea respuesta SSE (líneas data:)", async () => {
    stubFetch(
      200,
      `event: message\ndata: ${JSON.stringify({
        jsonrpc: "2.0",
        result: { tools: [{ name: "resolve_component" }] },
      })}\n\n`,
    );
    const tools = await listUiMcpTools({ url: "https://mcp.example.com/rpc" });
    assert.deepEqual(tools, ["resolve_component"]);
  });

  it("lanza si HTTP no es ok", async () => {
    stubFetch(500, "boom");
    await assert.rejects(() => listUiMcpTools({ url: "https://mcp.example.com/rpc" }), /HTTP 500/);
  });
});

describe("ui-mcp-transport — callUiMcpTool", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("callUiMcpToolText devuelve el texto del content", async () => {
    stubFetch(
      200,
      JSON.stringify({
        jsonrpc: "2.0",
        result: { content: [{ type: "text", text: "{\"ok\":true}" }] },
      }),
    );
    const text = await callUiMcpToolText({ url: "https://mcp.example.com/rpc" }, "describe_capabilities");
    assert.equal(text, '{"ok":true}');
  });

  it("callUiMcpToolJson parsea el JSON del content", async () => {
    stubFetch(
      200,
      JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ contractVersion: "1.0.0" }),
            },
          ],
        },
      }),
    );
    const json = await callUiMcpToolJson<{ contractVersion: string }>(
      { url: "https://mcp.example.com/rpc" },
      "describe_capabilities",
    );
    assert.equal(json?.contractVersion, "1.0.0");
  });

  it("lanza cuando el tool devuelve isError", async () => {
    stubFetch(
      200,
      JSON.stringify({
        jsonrpc: "2.0",
        result: { isError: true, content: [{ type: "text", text: "tool blew up" }] },
      }),
    );
    await assert.rejects(
      () => callUiMcpToolText({ url: "https://mcp.example.com/rpc" }, "resolve_component"),
      /tool blew up/,
    );
  });
});
