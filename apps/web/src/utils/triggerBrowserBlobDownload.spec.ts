import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("triggerBrowserBlobDownload", () => {
  it("module exporta función", async () => {
    const mod = await import("./triggerBrowserBlobDownload.js");
    assert.equal(typeof mod.triggerBrowserBlobDownload, "function");
  });
});
