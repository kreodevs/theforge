import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listGovernancePatternOptions } from "./mdd-governance-patterns.js";
import {
  GOVERNANCE_PATTERN_INCOMPATIBILITY_RULES,
  resolveGovernancePatternIncompatibilities,
} from "./mdd-governance-pattern-compat.js";

describe("mdd-governance-pattern-compat", () => {
  it("todas las reglas referencian ids del catálogo", () => {
    const valid = new Set(listGovernancePatternOptions().map((o) => o.id));
    for (const rule of GOVERNANCE_PATTERN_INCOMPATIBILITY_RULES) {
      assert.ok(valid.has(rule.a), `id desconocido en regla: ${rule.a}`);
      assert.ok(valid.has(rule.b), `id desconocido en regla: ${rule.b}`);
      assert.ok(valid.has(rule.keepId), `keepId desconocido: ${rule.keepId}`);
      assert.ok(rule.keepId === rule.a || rule.keepId === rule.b);
    }
  });

  it("elimina microservicios cuando también hay monolito modular", () => {
    const result = resolveGovernancePatternIncompatibilities(
      new Set(["microservicios", "monolito-modular", "repository"]),
    );
    assert.ok(!result.correctedIds.has("microservicios"));
    assert.ok(result.correctedIds.has("monolito-modular"));
    assert.ok(result.correctedIds.has("repository"));
    assert.equal(result.corrections.length, 1);
    assert.equal(result.corrections[0]!.removedId, "microservicios");
  });

  it("elimina active-record ante clean architecture", () => {
    const result = resolveGovernancePatternIncompatibilities(
      new Set(["clean-architecture-onion-architecture", "active-record", "repository"]),
    );
    assert.ok(!result.correctedIds.has("active-record"));
    assert.ok(result.correctedIds.has("clean-architecture-onion-architecture"));
    assert.ok(result.correctedIds.has("repository"));
  });

  it("no altera selección compatible", () => {
    const input = new Set(["arquitectura-hexagonal-ports-adapters", "repository", "strategy"]);
    const result = resolveGovernancePatternIncompatibilities(input);
    assert.deepEqual([...result.correctedIds].sort(), [...input].sort());
    assert.equal(result.corrections.length, 0);
  });
});
