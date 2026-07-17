import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getMddTemplatePlaceholder } from "../state/mdd-structured.schema.js";

/** Espejo de la heurística del nodo Clarifier (§2 real vs esqueleto). */
function hasSubstantialSection2Body(draft: string): boolean {
  const match = draft.match(/##\s*2\.\s*Arquitectura[\s\S]*?(?=##\s*3\.|$)/i);
  if (!match) return false;
  const body = match[0]
    .replace(/^##\s*2\.[^\n]*\n?/i, "")
    .replace(/\(Pendiente[^)]*\)/gi, "")
    .trim();
  return body.length > 80;
}

function isSubstantialClarifierFallbackDraft(draft: string, existingScope?: string): boolean {
  if ((existingScope ?? "").trim().length > 300) return true;
  return hasSubstantialSection2Body(draft);
}

describe("isSubstantialClarifierFallbackDraft", () => {
  it("rejects ~800 char skeleton with only (Pendiente) in §2", () => {
    const skeleton = getMddTemplatePlaceholder(
      "### Propósito\n\nSistema de reservas para peluquerías con agenda compartida y recordatorios automáticos por WhatsApp.",
    );
    assert.ok(skeleton.length > 200);
    assert.equal(isSubstantialClarifierFallbackDraft(skeleton), false);
  });

  it("accepts draft with real §2 content", () => {
    const draft = getMddTemplatePlaceholder("### Propósito\n\nApp.").replace(
      "## 2. Arquitectura y Stack\n\n(Pendiente)",
      "## 2. Arquitectura y Stack\n\nNestJS 11 + PostgreSQL 16 + Redis para colas BullMQ, despliegue Docker Compose en Dokploy con health checks.",
    );
    assert.equal(isSubstantialClarifierFallbackDraft(draft), true);
  });

  it("accepts prior clarifiedScope even when draft is skeleton", () => {
    const skeleton = getMddTemplatePlaceholder("### Propósito\n\nCorto.");
    const scope = "x".repeat(350);
    assert.equal(isSubstantialClarifierFallbackDraft(skeleton, scope), true);
  });
});
