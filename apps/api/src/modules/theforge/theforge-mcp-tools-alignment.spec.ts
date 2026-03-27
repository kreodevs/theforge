import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseMcpResponse } from "./mcp-http.util.js";
import {
  THEFORGE_MCP_CLIENT_ARG_KEYS,
  THEFORGE_MCP_TOOLS_WE_CALL,
} from "./theforge-mcp-client-contract.js";

type JsonSchema = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean | unknown;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function stripEnvQuotes(s: string | undefined): string | undefined {
  if (s == null) return undefined;
  let t = s.trim();
  if (t.length >= 2) {
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      t = t.slice(1, -1);
    }
  }
  return t;
}

async function postMcp(
  url: string,
  body: object,
  headers: Record<string, string>,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-03-26",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Ariadne MCP tools/list vs cliente TheForge", () => {
  test("required ⊆ claves que el cliente puede enviar (humo; requiere THEFORGE_MCP_URL)", async (t) => {
    const baseUrl = stripEnvQuotes(process.env.THEFORGE_MCP_URL);
    if (!baseUrl?.length) {
      t.skip("Sin THEFORGE_MCP_URL — exportar URL del MCP para ejecutar alineación");
      return;
    }

    const token = stripEnvQuotes(process.env.MCP_AUTH_TOKEN);
    const m2m = stripEnvQuotes(process.env.MCP_X_M2M_TOKEN);
    const authHeaders: Record<string, string> = {};
    if (m2m) authHeaders["X-M2M-Token"] = m2m;
    else if (token) authHeaders.Authorization = `Bearer ${token}`;

    const res = await postMcp(
      baseUrl,
      {
        jsonrpc: "2.0",
        id: "tools-list-alignment",
        method: "tools/list",
        params: {},
      },
      authHeaders,
    );

    assert.ok(
      res.ok,
      `tools/list HTTP ${res.status} ${res.statusText}. ¿token o URL?`,
    );
    const raw = await res.text();
    const parsed = parseMcpResponse(raw) as {
      result?: { tools?: unknown };
      error?: { message: string };
    } | null;
    assert.ok(parsed && !parsed.error, `JSON-RPC error: ${parsed?.error?.message ?? "parse nulo"}`);

    const tools = parsed?.result?.tools;
    assert.ok(Array.isArray(tools), "result.tools debe ser array");

    const byName = new Map<string, JsonSchema>();
    for (const item of tools) {
      if (!isRecord(item)) continue;
      const name = item.name;
      if (typeof name !== "string") continue;
      const schema = item.inputSchema;
      if (isRecord(schema)) byName.set(name, schema as JsonSchema);
      else byName.set(name, {});
    }

    const missingOnServer: string[] = [];
    for (const name of THEFORGE_MCP_TOOLS_WE_CALL) {
      if (!byName.has(name)) missingOnServer.push(name);
    }
    assert.deepEqual(
      missingOnServer,
      [],
      `Herramientas que el cliente llama pero no aparecen en tools/list: ${missingOnServer.join(", ")}`,
    );

    const mismatches: string[] = [];
    for (const [toolName, schema] of byName) {
      const clientKeys = THEFORGE_MCP_CLIENT_ARG_KEYS[toolName];
      if (!clientKeys) continue;

      const required = Array.isArray(schema.required)
        ? schema.required.filter((r): r is string => typeof r === "string")
        : [];

      for (const req of required) {
        if (!clientKeys.has(req)) {
          mismatches.push(
            `${toolName}: el MCP requiere argumento "${req}" pero THEFORGE_MCP_CLIENT_ARG_KEYS no lo incluye (revisa TheForgeService)`,
          );
        }
      }
    }

    assert.deepEqual(
      mismatches,
      [],
      `Desalineación nombre de argumentos:\n${mismatches.join("\n")}`,
    );
  });
});
