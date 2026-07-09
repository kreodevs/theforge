import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  callUiMcpToolJson,
  callUiMcpToolText,
  clearUiMcpSession,
  isContext7RemoteUrl,
  isDsMcpRemoteUrl,
  listUiMcpTools,
  requiresMcpSession,
} from "./ui-mcp-transport.util.js";

type FetchArgs = { url: string; init: RequestInit };
const originalFetch = globalThis.fetch;
let fetchCalls: FetchArgs[] = [];

function stubFetch(responses: Array<{ status: number; body: string; sessionId?: string }>) {
  fetchCalls = [];
  let idx = 0;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init: init ?? {} });
    const next = responses[idx] ?? responses[responses.length - 1];
    idx += 1;
    const headers = new Headers();
    if (next.sessionId) headers.set("mcp-session-id", next.sessionId);
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers,
      text: async () => next.body,
    } as unknown as Response;
  }) as typeof fetch;
}

describe("ui-mcp-transport — listUiMcpTools", () => {
  beforeEach(() => {
    fetchCalls = [];
    clearUiMcpSession({ url: "https://mcp.example.com/rpc", token: "t" });
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("usa la URL de la conexión explícita (no env) y devuelve los nombres", async () => {
    stubFetch([
      {
        status: 200,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "x",
          result: { tools: [{ name: "describe_capabilities" }, { name: "list_components" }] },
        }),
      },
    ]);
    const tools = await listUiMcpTools({ url: "https://mcp.example.com/rpc", token: "t" });
    assert.deepEqual(tools, ["describe_capabilities", "list_components"]);
    assert.equal(fetchCalls[0]?.url, "https://mcp.example.com/rpc");
    const headers = fetchCalls[0]?.init.headers as Record<string, string>;
    assert.equal(headers["X-M2M-Token"], "t");
    assert.equal(headers.Authorization, "Bearer t");
  });

  it("parsea respuesta SSE (líneas data:)", async () => {
    stubFetch([
      {
        status: 200,
        body: `event: message\ndata: ${JSON.stringify({
          jsonrpc: "2.0",
          result: { tools: [{ name: "resolve_component" }] },
        })}\n\n`,
      },
    ]);
    const tools = await listUiMcpTools({ url: "https://mcp.example.com/rpc" });
    assert.deepEqual(tools, ["resolve_component"]);
  });

  it("lanza si HTTP no es ok", async () => {
    stubFetch([{ status: 500, body: "boom" }]);
    await assert.rejects(() => listUiMcpTools({ url: "https://mcp.example.com/rpc" }), /HTTP 500/);
  });
});

describe("ui-mcp-transport — ds-mcp session", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearUiMcpSession({
      url: "https://componentes.obp.mx/mcp",
      token: "secret",
    });
  });

  it("requiresMcpSession detecta componentes.obp.mx, Context7 y localhost:3100/mcp", () => {
    assert.equal(requiresMcpSession("https://componentes.obp.mx/mcp"), true);
    assert.equal(requiresMcpSession("https://mcp.context7.com/mcp"), true);
    assert.equal(requiresMcpSession("http://127.0.0.1:3100/mcp"), true);
    assert.equal(requiresMcpSession("https://kreo.example.com/mcp"), false);
    assert.equal(isDsMcpRemoteUrl("https://componentes.obp.mx/mcp"), true);
    assert.equal(isContext7RemoteUrl("https://mcp.context7.com/mcp"), true);
  });

  it("initialize + CONTEXT7_API_KEY en mcp.context7.com", async () => {
    stubFetch([
      {
        status: 200,
        sessionId: "ctx7-sess",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "context7" } } }),
      },
      { status: 202, body: "" },
      {
        status: 200,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tools",
          result: { tools: [{ name: "resolve-library-id" }, { name: "query-docs" }] },
        }),
      },
    ]);
    clearUiMcpSession({
      url: "https://mcp.context7.com/mcp",
      token: null,
      extraHeaders: { CONTEXT7_API_KEY: "c7-key" },
    });
    const tools = await listUiMcpTools({
      url: "https://mcp.context7.com/mcp",
      token: null,
      extraHeaders: { CONTEXT7_API_KEY: "c7-key" },
    });
    assert.deepEqual(tools, ["resolve-library-id", "query-docs"]);
    assert.equal(fetchCalls.length, 3);
    const initHeaders = fetchCalls[0]?.init.headers as Record<string, string>;
    assert.equal(initHeaders.CONTEXT7_API_KEY, "c7-key");
    assert.equal(initHeaders["X-M2M-Token"], undefined);
    const listHeaders = fetchCalls[2]?.init.headers as Record<string, string>;
    assert.equal(listHeaders["Mcp-Session-Id"], "ctx7-sess");
    assert.equal(listHeaders.CONTEXT7_API_KEY, "c7-key");
  });

  it("initialize + session id + X-IMJ-DS-MCP-Token en componentes.obp.mx", async () => {
    stubFetch([
      {
        status: 200,
        sessionId: "sess-abc",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "imj-ds-mcp" } } }),
      },
      { status: 202, body: "" },
      {
        status: 200,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tools",
          result: { tools: [{ name: "describe_capabilities" }] },
        }),
      },
    ]);
    const tools = await listUiMcpTools({
      url: "https://componentes.obp.mx/mcp",
      token: "secret",
    });
    assert.deepEqual(tools, ["describe_capabilities"]);
    assert.equal(fetchCalls.length, 3);
    assert.equal(fetchCalls[0]?.init.method, "POST");
    const initBody = JSON.parse(String(fetchCalls[0]?.init.body)) as { method: string };
    assert.equal(initBody.method, "initialize");
    const listHeaders = fetchCalls[2]?.init.headers as Record<string, string>;
    assert.equal(listHeaders["Mcp-Session-Id"], "sess-abc");
    assert.equal(listHeaders["X-IMJ-DS-MCP-Token"], "secret");
  });
});

describe("ui-mcp-transport — callUiMcpTool", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("callUiMcpToolText devuelve el texto del content", async () => {
    stubFetch([
      {
        status: 200,
        body: JSON.stringify({
          jsonrpc: "2.0",
          result: { content: [{ type: "text", text: "{\"ok\":true}" }] },
        }),
      },
    ]);
    const text = await callUiMcpToolText({ url: "https://mcp.example.com/rpc" }, "describe_capabilities");
    assert.equal(text, '{"ok":true}');
  });

  it("callUiMcpToolJson parsea el JSON del content", async () => {
    stubFetch([
      {
        status: 200,
        body: JSON.stringify({
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
      },
    ]);
    const json = await callUiMcpToolJson<{ contractVersion: string }>(
      { url: "https://mcp.example.com/rpc" },
      "describe_capabilities",
    );
    assert.equal(json?.contractVersion, "1.0.0");
  });

  it("lanza cuando el tool devuelve isError", async () => {
    stubFetch([
      {
        status: 200,
        body: JSON.stringify({
          jsonrpc: "2.0",
          result: { isError: true, content: [{ type: "text", text: "tool blew up" }] },
        }),
      },
    ]);
    await assert.rejects(
      () => callUiMcpToolText({ url: "https://mcp.example.com/rpc" }, "resolve_component"),
      /tool blew up/,
    );
  });
});
