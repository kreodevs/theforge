import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMagicUiGetComponentArgs,
  buildMagicUiListModulesArgs,
  isMagicUiListTool,
} from "./magic-ui-registry-tools.js";

describe("magic-ui-registry-tools", () => {
  it("isMagicUiListTool matches listRegistryItems", () => {
    assert.equal(isMagicUiListTool("listRegistryItems"), true);
  });

  it("buildMagicUiListModulesArgs sets limit 150", () => {
    assert.deepEqual(buildMagicUiListModulesArgs("listRegistryItems"), { limit: 150 });
  });

  it("buildMagicUiGetComponentArgs uses name", () => {
    assert.deepEqual(buildMagicUiGetComponentArgs("getRegistryItem", "marquee"), { name: "marquee" });
  });
});
