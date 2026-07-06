import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectSddConflicts } from "../ai/utils/suggest-agent-governance-artifacts.js";
import { buildSddCorpusFromProject } from "./sdd-conflict-gap.util.js";
import {
  alignSddDeliverablesAtPersist,
} from "./sdd-align-at-persist.util.js";
import { mapSddConflictsToGapBodies } from "./sdd-conflict-gap.util.js";
import { isSddConflictHitlGapsEnabled } from "./documentation-gap.service.js";

const MDD = `## 2. Arquitectura y Stack

RabbitMQ como broker de mensajes. TypeORM con PostgreSQL.

## 6. Seguridad

Autenticación JWT RS256 con JWT_PRIVATE_KEY y JWT_PUBLIC_KEY (PEM).
`;

describe("SDD auto-reconcile path (deterministic)", () => {
  it("detectSddConflicts → align → corpus limpio sin HITL", () => {
    const projectFields = {
      tasksContent: "Implementar worker BullMQ y schema Prisma",
      userStoriesContent: "Publicar eventos vía Bull",
      blueprintContent: "JWT_SECRET en variables",
    };
    const corpusBefore = buildSddCorpusFromProject(MDD, projectFields);
    const conflictsBefore = detectSddConflicts(corpusBefore);
    assert.ok(conflictsBefore.length > 0);

    const aligned = alignSddDeliverablesAtPersist({
      mddContent: MDD,
      ...projectFields,
      infraContent: projectFields.blueprintContent,
    });
    assert.equal(aligned.changed, true);

    const corpusAfter = buildSddCorpusFromProject(aligned.mddContent, {
      tasksContent: aligned.tasksContent,
      userStoriesContent: aligned.userStoriesContent,
      blueprintContent: aligned.blueprintContent,
      infraContent: aligned.infraContent,
    });
    const conflictsAfter = detectSddConflicts(corpusAfter);
    assert.deepEqual(conflictsAfter, []);
  });

  it("sync HITL gaps desactivado por defecto (SDD_CONFLICT_HITL_GAPS)", () => {
    const prev = process.env.SDD_CONFLICT_HITL_GAPS;
    delete process.env.SDD_CONFLICT_HITL_GAPS;
    assert.equal(isSddConflictHitlGapsEnabled(), false);
    if (prev !== undefined) process.env.SDD_CONFLICT_HITL_GAPS = prev;
  });
});

describe("SDD conflict surfacing (sin auto-reconcile)", () => {
  it("detectSddConflicts → mapSddConflictsToGapBodies sin align ni reconcile", () => {
    const projectFields = {
      tasksContent: "Implementar worker BullMQ y schema Prisma",
      userStoriesContent: "Publicar eventos vía Bull",
      blueprintContent: "JWT_SECRET en variables",
    };
    const corpusBefore = buildSddCorpusFromProject(MDD, projectFields);
    const conflicts = detectSddConflicts(corpusBefore);
    assert.ok(conflicts.length > 0);

    const bodies = mapSddConflictsToGapBodies(conflicts, corpusBefore);
    assert.ok(bodies.length > 0);
    for (const body of bodies) {
      assert.ok(body.description.length > 8);
      assert.ok(body.affectedArtifacts.length > 0);
      assert.ok(body.evidence.reference.length > 0);
    }

    const aligned = alignSddDeliverablesAtPersist({
      mddContent: MDD,
      ...projectFields,
      infraContent: projectFields.blueprintContent,
    });
    assert.equal(aligned.changed, true);
    assert.notEqual(aligned.tasksContent, projectFields.tasksContent);
  });
});
