import test from "node:test";
import assert from "node:assert/strict";
import {
  isDisallowedCatalogListTool,
  pickBestCatalogListTool,
  resolveCatalogListToolName,
} from "./catalog-list-tool.util.js";

test("isDisallowedCatalogListTool — GitMCP doc/search tools", () => {
  assert.equal(isDisallowedCatalogListTool("fetch_ui_documentation"), true);
  assert.equal(isDisallowedCatalogListTool("search_ui_code"), true);
  assert.equal(isDisallowedCatalogListTool("search_ui_documentation"), true);
  assert.equal(isDisallowedCatalogListTool("list_modules"), false);
  assert.equal(isDisallowedCatalogListTool("list_items_in_registries"), false);
});

test("pickBestCatalogListTool — prefers DS list tools over generic list_", () => {
  assert.equal(
    pickBestCatalogListTool([
      "fetch_ui_documentation",
      "search_ui_code",
      "list_items_in_registries",
    ]),
    "list_items_in_registries",
  );
  assert.equal(
    pickBestCatalogListTool(["fetch_ui_documentation", "list_modules", "list_other"]),
    "list_modules",
  );
  assert.equal(pickBestCatalogListTool(["fetch_ui_documentation", "search_ui_code"]), null);
});

test("resolveCatalogListToolName — corrects LLM doc tool to heuristic", () => {
  const result = resolveCatalogListToolName("fetch_ui_documentation", [
    "fetch_ui_documentation",
    "search_ui_code",
    "list_items_in_registries",
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.toolName, "list_items_in_registries");
    assert.equal(result.correctedFrom, "fetch_ui_documentation");
  }
});

test("resolveCatalogListToolName — fails when only doc tools exist", () => {
  const result = resolveCatalogListToolName("fetch_ui_documentation", [
    "fetch_ui_documentation",
    "search_ui_code",
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /GitMCP|documentación/i);
  }
});
