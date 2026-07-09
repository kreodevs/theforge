import { Controller, Post, Body } from "@nestjs/common";
import { listUiMcpTools } from "../ui-mcp/ui-mcp-transport.util.js";
import { DEFAULT_TECH_DOCS_MCP_URL } from "../technology-docs-mcp/technology-docs-mcp-client.service.js";

@Controller("admin")
export class AdminController {
  @Post("ariadne-config/test")
  async testAriadneConnection(
    @Body() body: { url: string; token: string },
  ): Promise<{ ok: boolean; error?: string }> {
    return testMcpToolsList(body.url, body.token, { useM2mToken: true });
  }

  @Post("tech-docs-config/test")
  async testTechDocsConnection(
    @Body() body: { url?: string; token: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const url = body.url?.trim() || DEFAULT_TECH_DOCS_MCP_URL;
    const apiKey = body.token?.trim();
    if (!apiKey) return { ok: false, error: "API key es requerida" };
    try {
      await listUiMcpTools({
        url,
        token: null,
        extraHeaders: { CONTEXT7_API_KEY: apiKey },
        timeoutMs: 15_000,
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Error de conexión",
      };
    }
  }
}

async function testMcpToolsList(
  url: string,
  token: string,
  opts: { useM2mToken?: boolean; extraHeaders?: Record<string, string> },
): Promise<{ ok: boolean; error?: string }> {
  if (!url) return { ok: false, error: "URL es requerida" };
  if (!token) return { ok: false, error: "Token es requerido" };
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-03-26",
      ...(opts.extraHeaders ?? {}),
    };
    if (opts.useM2mToken) {
      headers["X-M2M-Token"] = token;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "test-1",
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "sin cuerpo");
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    const raw = await response.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const lines = raw.split("\n");
      const jsonBlocks: string[] = [];
      let buf = "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          buf = line.slice(6).trim();
        } else if (line.trim() === "" && buf) {
          jsonBlocks.push(buf);
          buf = "";
        }
      }
      if (buf) jsonBlocks.push(buf);
      for (const block of jsonBlocks) {
        try {
          data = JSON.parse(block) as Record<string, unknown>;
          break;
        } catch {
          continue;
        }
      }
    }
    if (!data) {
      return { ok: false, error: `Respuesta inesperada (${raw.slice(0, 200)})` };
    }
    if (data.error) {
      return {
        ok: false,
        error: typeof data.error === "object" ? JSON.stringify(data.error) : String(data.error),
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de conexión" };
  }
}
