import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExistingConformanceGapsMap } from "./deliverables-cascade-gaps.util.js";

describe("deliverables-cascade-gaps.util", () => {
  it("buildExistingConformanceGapsMap skips ui_screens_sync", () => {
    const map = buildExistingConformanceGapsMap(
      { blueprintContent: "# bp\n".repeat(40) } as Parameters<
        typeof buildExistingConformanceGapsMap
      >[0],
      "## 3 Modelo\nentidad Foo",
      ["ui_screens_sync", "blueprint"],
    );
    assert.equal(map.has("ui_screens_sync"), false);
  });
});
