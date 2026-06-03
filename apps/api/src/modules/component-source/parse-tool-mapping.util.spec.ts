import test from "node:test";
import assert from "node:assert/strict";
import {
  isConfirmedToolMapping,
  parseToolMappingFromJson,
} from "./parse-tool-mapping.util.js";

const VALID_MAPPING = {
  "catalog.list": { toolName: "list_modules", description: "List DS modules" },
  "catalog.resolve": { toolName: "resolve_components" },
  "catalog.get": { toolName: "get_component" },
};

test("parseToolMappingFromJson — returns null for non-object input", () => {
  assert.equal(parseToolMappingFromJson(null), null);
  assert.equal(parseToolMappingFromJson(undefined), null);
  assert.equal(parseToolMappingFromJson("string"), null);
  assert.equal(parseToolMappingFromJson([]), null);
});

test("parseToolMappingFromJson — returns null when catalog.list is missing", () => {
  assert.equal(
    parseToolMappingFromJson({ "catalog.resolve": { toolName: "resolve_components" } }),
    null,
  );
  assert.equal(parseToolMappingFromJson({ "catalog.list": { toolName: "" } }), null);
  assert.equal(parseToolMappingFromJson({ "catalog.list": {} }), null);
});

test("parseToolMappingFromJson — parses catalog.list and optional roles", () => {
  const parsed = parseToolMappingFromJson(VALID_MAPPING);
  assert.ok(parsed);
  assert.equal(parsed!["catalog.list"].toolName, "list_modules");
  assert.equal(parsed!["catalog.list"].description, "List DS modules");
  assert.equal(parsed!["catalog.resolve"]?.toolName, "resolve_components");
  assert.equal(parsed!["catalog.get"]?.toolName, "get_component");
  assert.equal(parsed!["catalog.search"], undefined);
});

test("parseToolMappingFromJson — ignores unknown keys and trims tool names", () => {
  const parsed = parseToolMappingFromJson({
    "catalog.list": { toolName: "  list_modules  " },
    legacyTool: { toolName: "old_tool" },
  });
  assert.ok(parsed);
  assert.equal(parsed!["catalog.list"].toolName, "list_modules");
  assert.equal((parsed as Record<string, unknown>).legacyTool, undefined);
});

test("isConfirmedToolMapping — false without confirmation timestamp", () => {
  assert.equal(isConfirmedToolMapping(null, VALID_MAPPING), false);
  assert.equal(isConfirmedToolMapping(undefined, VALID_MAPPING), false);
});

test("isConfirmedToolMapping — false when mapping JSON is invalid", () => {
  assert.equal(isConfirmedToolMapping(new Date(), null), false);
  assert.equal(isConfirmedToolMapping(new Date(), { broken: true }), false);
});

test("isConfirmedToolMapping — true when confirmed and catalog.list present", () => {
  assert.equal(isConfirmedToolMapping(new Date(), VALID_MAPPING), true);
});
