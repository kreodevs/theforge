#!/usr/bin/env node
/**
 * End-to-end smoke test for @theforge/docs-mcp-server.
 *
 * Spawns the built server over stdio using the official MCP SDK client and exercises:
 *   - resources/list + resources/templates/list
 *   - resources/read  docs://manifest
 *   - resources/read  docs://componentes/button
 *   - tools/call      search_docs
 *   - tools/call      get_component_api
 *   - error path      reading a non-existent page
 *
 * Exits non-zero on the first failed assertion.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(here, "../dist/index.js");
const docsDir = resolve(here, "../../../docs_mcp");

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log(`✓ ${msg}`);
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: { ...process.env, DOCS_MCP_DIR: docsDir },
  });
  const client = new Client({ name: "docs-mcp-smoke", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  // Resources
  const { resources } = await client.listResources();
  assert(resources.some((r) => r.uri === "docs://manifest"), "manifest resource is listed");
  assert(resources.some((r) => r.uri === "docs://componentes/button"), "button page is listed");

  const { resourceTemplates } = await client.listResourceTemplates();
  assert(
    resourceTemplates.some((t) => t.uriTemplate === "docs://{section}/{topic}"),
    "resource template is advertised",
  );

  // Manifest
  const manifestRes = await client.readResource({ uri: "docs://manifest" });
  const manifest = JSON.parse(manifestRes.contents[0].text);
  assert(manifest.totalPages >= 10, `manifest reports pages (got ${manifest.totalPages})`);
  assert(
    manifest.sections.some((s) => s.section === "componentes"),
    "manifest has a 'componentes' section",
  );
  assert(
    manifest.sections.some((s) => s.section === "arquitectura"),
    "manifest has an 'arquitectura' section",
  );

  // Page read
  const page = await client.readResource({ uri: "docs://componentes/button" });
  assert(/# Button/.test(page.contents[0].text), "button page renders markdown body");
  assert(!/^---/.test(page.contents[0].text.trim()), "page body has frontmatter stripped");

  // Tools
  const { tools } = await client.listTools();
  assert(tools.some((t) => t.name === "search_docs"), "search_docs tool is listed");
  assert(tools.some((t) => t.name === "get_component_api"), "get_component_api tool is listed");

  const search = await client.callTool({ name: "search_docs", arguments: { query: "estado de carga botón" } });
  assert(/docs:\/\/componentes\/button/.test(search.content[0].text), "search_docs finds the Button page");

  const api = await client.callTool({ name: "get_component_api", arguments: { componentName: "Button" } });
  const apiText = api.content[0].text;
  assert(/API/.test(apiText) && /variant/.test(apiText), "get_component_api returns the props contract");
  assert(/Decisiones|Restricciones|Regla/.test(apiText), "get_component_api returns design rules");

  // Error path
  const missing = await client.readResource({ uri: "docs://nope/nope" }).then(
    () => null,
    (err) => err,
  );
  assert(missing instanceof Error, "reading a missing page rejects with an error");

  await client.close();
  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error("\nSmoke test failed:", err?.message ?? err);
  process.exit(1);
});
