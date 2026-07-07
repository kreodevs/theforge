import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveUxGuideDesignRef } from "./ux-guide-design-ref.util.js";
import { resetDesignCatalogCache } from "./data/design-catalog.js";
import { resetDesignExtractorImportCache, designExtractorImportPresent } from "./data/design-extractor-import.loader.js";
import { getMergedDesignReferences } from "./data/design-catalog.js";

describe("resolveUxGuideDesignRef", () => {
  it("usa slug explícito del catálogo", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const r = resolveUxGuideDesignRef("stripe", "# App fintech");
    assert.equal(r.effectiveSlug, "stripe");
    assert.equal(r.mode, "explicit");
    assert.ok(r.promptBlock?.includes("Stripe"));
  });

  it("inyecta DESIGN.md importado cuando existe (stripe)", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    if (!designExtractorImportPresent("stripe")) {
      return; // imports no sincronizados en este entorno
    }
    const r = resolveUxGuideDesignRef("stripe", "# App");
    assert.ok(r.promptBlock?.includes("DESIGN.md importado"));
    assert.ok(r.promptBlock?.includes("generator: design-extractor"));
  });

  it("auto-match por dominio trading/inversión", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const r = resolveUxGuideDesignRef(
      "auto",
      "Plataforma de inversión bursátil con broker Alpaca y dashboard tipo TradingView",
    );
    assert.ok(r.effectiveSlug);
    assert.equal(r.mode, "auto-matched");
    assert.ok(r.promptBlock?.includes("Design Reference"));
  });

  it("null cae en auto-match cuando hay MDD", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const r = resolveUxGuideDesignRef(null, "SaaS fintech con pagos Stripe-like");
    assert.equal(r.mode, "auto-matched");
  });
});

describe("design-extractor gallery P1", () => {
  it("catálogo unificado incluye entradas gallery-only y gallery URLs", () => {
    resetDesignCatalogCache();
    const merged = getMergedDesignReferences();
    assert.ok(merged.some((r) => r.slug === "klarna"));
    assert.ok(merged.some((r) => r.slug === "dribbble"));
    const stripe = merged.find((r) => r.slug === "stripe");
    assert.ok(stripe?.galleryUrl?.includes("design-extractor.com/gallery/stripe"));
    const linear = merged.find((r) => r.slug === "linear-app");
    assert.ok(linear?.galleryUrl?.includes("linear-638bvy"));
  });
});
