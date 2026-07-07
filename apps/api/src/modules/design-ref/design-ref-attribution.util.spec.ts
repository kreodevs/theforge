import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendUxGuideDesignAttribution,
  formatUxGuideAttributionFooter,
} from "./design-ref-attribution.util.js";
import { getDesignRefInspiration } from "./design-ref-inspiration.util.js";
import { resolveUxGuideDesignRef } from "./ux-guide-design-ref.util.js";
import { resetDesignCatalogCache } from "./data/design-catalog.js";
import { resetDesignExtractorImportCache } from "./data/design-extractor-import.loader.js";
import { getDesignBySlugFromCatalog } from "./data/design-catalog.js";

describe("design-ref-attribution", () => {
  it("marca inspiración design-extractor en refs con galería/import", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const stripe = getDesignBySlugFromCatalog("stripe");
    assert.ok(stripe);
    const inspiration = getDesignRefInspiration(stripe!);
    assert.equal(inspiration.inspirationSource, "design-extractor");
    assert.ok(inspiration.inspirationUrl?.includes("stripe"));
    assert.ok(inspiration.attributionNote?.includes("inspiradas"));
  });

  it("genera pie ## Atribución para stripe", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const resolved = resolveUxGuideDesignRef("stripe", "# Fintech");
    const footer = formatUxGuideAttributionFooter(resolved);
    assert.ok(footer?.includes("## Atribución"));
    assert.ok(footer?.includes("inspirada en"));
    assert.ok(footer?.includes("design-extractor.com/gallery/stripe"));
  });

  it("appendUxGuideDesignAttribution es idempotente", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const base = "# Guía UX/UI\n\nContenido.";
    const once = appendUxGuideDesignAttribution(base, "stripe", "# Fintech");
    assert.ok(once.includes("## Atribución"));
    const twice = appendUxGuideDesignAttribution(once, "stripe", "# Fintech");
    assert.equal((twice.match(/## Atribución/g) ?? []).length, 1);
  });
});
