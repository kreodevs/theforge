/**
 * Tests for TheForge-specific entity gating in domain inventory.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDomainInventory,
  isTheForgeDomainProject,
  suggestEntitiesFromProse,
  THEFORGE_SPECIFIC_ENTITIES,
} from "./domain-inventory.util.js";

describe("isTheForgeDomainProject", () => {
  it("detects The Forge product markers", () => {
    assert.equal(isTheForgeDomainProject("Proyecto The Forge Workshop"), true);
    assert.equal(isTheForgeDomainProject("tabla conversation_memory en schema"), true);
  });

  it("returns false for generic projects mentioning memoria/llm", () => {
    assert.equal(
      isTheForgeDomainProject("Sistema CRM con memoria de clientes y configuración LLM externa"),
      false,
    );
  });
});

describe("suggestEntitiesFromProse — TheForge gating", () => {
  it("does not suggest conversation_memory for non-TheForge BRD", () => {
    const entities = suggestEntitiesFromProse(
      "Plataforma de reservas con memoria de preferencias del huésped y canal WhatsApp.",
    );
    for (const e of THEFORGE_SPECIFIC_ENTITIES) {
      assert.equal(entities.includes(e), false, `unexpected TheForge entity: ${e}`);
    }
  });

  it("suggests TheForge entities when domain is The Forge", () => {
    const brd = "The Forge: memoria conversacional (conversation_memory) y llm_configs.";
    const entities = suggestEntitiesFromProse(brd);
    assert.ok(entities.includes("conversation_memory"));
    assert.ok(entities.includes("llm_configs"));
  });

  it("buildDomainInventory excludes TheForge stubs for generic CRM", () => {
    const inv = buildDomainInventory({
      brdMarkdown: "## 3. Capacidades\n### Gestión de leads\nCRM con memoria de interacciones.",
    });
    for (const e of inv.suggestedEntities) {
      assert.equal(THEFORGE_SPECIFIC_ENTITIES.has(e), false, `unexpected: ${e}`);
    }
  });
});
