import test from "node:test";
import assert from "node:assert/strict";
import { inferCapabilitiesFromMapping } from "./types.js";

test("inferCapabilitiesFromMapping — catalog.list always true; optional roles from mapping", () => {
  const caps = inferCapabilitiesFromMapping({
    "catalog.list": { toolName: "list_modules" },
    "catalog.resolve": { toolName: "resolve_components" },
    "preview.single": { toolName: "get_component_preview" },
  });

  assert.equal(caps.catalog.list, true);
  assert.equal(caps.catalog.resolve, true);
  assert.equal(caps.catalog.search, false);
  assert.equal(caps.preview?.single, true);
  assert.equal(caps.preview?.batch, false);
  assert.equal(caps.designSystem, undefined);
});

test("inferCapabilitiesFromMapping — designSystem block when any DS role mapped", () => {
  const caps = inferCapabilitiesFromMapping({
    "catalog.list": { toolName: "list_modules" },
    "designSystem.get": { toolName: "get_design_system" },
  });

  assert.equal(caps.designSystem?.get, true);
  assert.equal(caps.designSystem?.styleRules, false);
});

test("inferCapabilitiesFromMapping — ignores empty tool names", () => {
  const caps = inferCapabilitiesFromMapping({
    "catalog.list": { toolName: "list_modules" },
    "catalog.search": { toolName: "   " },
  });

  assert.equal(caps.catalog.search, false);
});
