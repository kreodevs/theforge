import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildShadcnListModulesArgs,
  buildShadcnSearchModulesArgs,
  buildShadcnViewItemsArgs,
  isShadcnRegistryListTool,
  parseRegistriesFromProjectRegistriesText,
  toShadcnRegistryItems,
} from "./shadcn-registry-tools.js";

describe("shadcn-registry-tools", () => {
  it("isShadcnRegistryListTool matches list_items_in_registries", () => {
    assert.equal(isShadcnRegistryListTool("list_items_in_registries"), true);
    assert.equal(isShadcnRegistryListTool("list_modules"), false);
  });

  it("buildShadcnListModulesArgs adds registries and limit", () => {
    assert.deepEqual(buildShadcnListModulesArgs("list_items_in_registries", ["@shadcn"]), {
      registries: ["@shadcn"],
      limit: 1000,
    });
    assert.deepEqual(buildShadcnListModulesArgs("list_modules", ["@shadcn"]), {});
  });

  it("buildShadcnSearchModulesArgs adds registries and query", () => {
    assert.deepEqual(
      buildShadcnSearchModulesArgs("search_items_in_registries", ["@shadcn"], "button"),
      { registries: ["@shadcn"], query: "button", limit: 100 },
    );
  });

  it("parseRegistriesFromProjectRegistriesText extracts @-prefixed names", () => {
    const text = `Configured registries:\n\n- @shadcn\n- @acme\n`;
    assert.deepEqual(parseRegistriesFromProjectRegistriesText(text), ["@shadcn", "@acme"]);
  });

  it("toShadcnRegistryItems prefixes plain ids", () => {
    assert.deepEqual(toShadcnRegistryItems(["button", "@acme/card"]), [
      "@shadcn/button",
      "@acme/card",
    ]);
  });

  it("buildShadcnViewItemsArgs maps names to items", () => {
    assert.deepEqual(buildShadcnViewItemsArgs("view_items_in_registries", ["button"], ["@shadcn"]), {
      items: ["@shadcn/button"],
    });
  });
});
