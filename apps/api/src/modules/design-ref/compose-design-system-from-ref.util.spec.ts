import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  composeDesignSystemFromRef,
  upsertLeadingYamlFields,
} from "./compose-design-system-from-ref.util.js";
import { resetDesignCatalogCache } from "./data/design-catalog.js";
import { resetDesignExtractorImportCache, designExtractorImportPresent } from "./data/design-extractor-import.loader.js";

describe("composeDesignSystemFromRef", () => {
  it("compone desde catálogo builtin (runwayml)", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const r = composeDesignSystemFromRef({
      projectName: "TheForge Investment System",
      storedRef: "runwayml",
      mddContext: "# Plataforma de inversión",
    });
    assert.ok(r);
    assert.equal(r!.effectiveSlug, "runwayml");
    assert.equal(r!.source, "builtin-catalog");
    assert.ok(r!.content.includes("name: \"TheForge Investment System\""));
    assert.ok(r!.content.includes("colors:"));
    assert.ok(r!.content.includes("6366F1") || r!.content.includes("#6366F1"));
    assert.ok(r!.content.includes("## Overview"));
  });

  it("auto-match sin LLM compone slug efectivo", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const r = composeDesignSystemFromRef({
      projectName: "Broker App",
      storedRef: "auto",
      mddContext: "Plataforma de inversión bursátil con broker Alpaca y dashboard TradingView",
    });
    assert.ok(r);
    assert.equal(r!.mode, "auto-matched");
    assert.ok(r!.content.includes("Broker App"));
  });

  it("usa DESIGN.md importado cuando existe (stripe)", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    if (!designExtractorImportPresent("stripe")) return;
    const r = composeDesignSystemFromRef({
      projectName: "Pagos ACME",
      storedRef: "stripe",
      mddContext: "# Fintech",
    });
    assert.ok(r);
    assert.equal(r!.source, "design-extractor-import");
    assert.ok(r!.content.includes("Pagos ACME"));
    assert.ok(r!.content.includes("DESIGN.md") || r!.content.includes("stripe-indigo"));
  });

  it("devuelve null si auto-match no encuentra referencia", () => {
    resetDesignCatalogCache();
    resetDesignExtractorImportCache();
    const r = composeDesignSystemFromRef({
      projectName: "X",
      storedRef: "auto",
      mddContext: "",
    });
    assert.equal(r, null);
  });
});

describe("upsertLeadingYamlFields", () => {
  it("añade name al front matter existente", () => {
    const raw = "---\nbrand: Stripe\n---\n\n# DESIGN.md\n";
    const out = upsertLeadingYamlFields(raw, { name: "Mi App" });
    assert.ok(out.includes('name: "Mi App"'));
    assert.ok(out.includes("brand: Stripe"));
  });
});
