import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildWireframesPreviewCachePayload,
  isWireframesPreviewCacheValid,
  previewCacheMcpKey,
  readWireframesPreviewCacheV1,
  wireframesPreviewCacheKeys,
} from "./wireframe-preview-cache.util.js";

describe("wireframe-preview-cache.util", () => {
  it("validates cache when hash and mcpKey match", () => {
    const { wireframesHash, mcpKey } = wireframesPreviewCacheKeys("# doc", "https://mcp.example");
    const payload = buildWireframesPreviewCachePayload(wireframesHash, mcpKey, [
      { screenName: "Login", components: [] },
    ]);
    assert.equal(isWireframesPreviewCacheValid(payload, wireframesHash, mcpKey), true);
    assert.equal(isWireframesPreviewCacheValid(payload, "other", mcpKey), false);
  });

  it("reads v1 payload and ignores invalid", () => {
    const { wireframesHash, mcpKey } = wireframesPreviewCacheKeys("x", null);
    const raw = { v: 1, wireframesHash, mcpKey, screens: [{ screenName: "A", components: [] }] };
    assert.equal(readWireframesPreviewCacheV1(raw)?.screens.length, 1);
    assert.equal(readWireframesPreviewCacheV1({ v: 2 }), null);
  });

  it("mcpKey differs when url changes", () => {
    assert.notEqual(previewCacheMcpKey("https://a"), previewCacheMcpKey("https://b"));
    assert.equal(previewCacheMcpKey(""), "no-mcp");
  });
});
