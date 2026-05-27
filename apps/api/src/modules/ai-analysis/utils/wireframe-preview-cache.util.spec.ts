import { describe, expect, it } from "vitest";
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
    expect(isWireframesPreviewCacheValid(payload, wireframesHash, mcpKey)).toBe(true);
    expect(isWireframesPreviewCacheValid(payload, "other", mcpKey)).toBe(false);
  });

  it("reads v1 payload and ignores invalid", () => {
    const { wireframesHash, mcpKey } = wireframesPreviewCacheKeys("x", null);
    const raw = { v: 1, wireframesHash, mcpKey, screens: [{ screenName: "A", components: [] }] };
    expect(readWireframesPreviewCacheV1(raw)?.screens).toHaveLength(1);
    expect(readWireframesPreviewCacheV1({ v: 2 })).toBeNull();
  });

  it("mcpKey differs when url changes", () => {
    expect(previewCacheMcpKey("https://a")).not.toBe(previewCacheMcpKey("https://b"));
    expect(previewCacheMcpKey("")).toBe("no-mcp");
  });
});
