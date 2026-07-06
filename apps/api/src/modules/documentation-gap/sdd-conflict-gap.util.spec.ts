import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reportDocumentationGapBodySchema } from "@theforge/shared-types";
import {
  computeDocumentationGapDedupHash,
  mapSddConflictToGapBody,
  mapSddConflictsToGapBodies,
  resolveSddConflictGapMapping,
} from "./sdd-conflict-gap.util.js";

const TYPEORM_CONFLICT =
  "TypeORM vs Prisma: prioriza el ORM declarado en MDD §2/Blueprint; no mezcles ambos en el mismo servicio.";
const BULL_CONFLICT =
  "Cola/mensajería: prioriza BullMQ + Redis del MDD §2; ignora menciones sueltas de RabbitMQ/Kafka en Blueprint u otros entregables.";
const JWT_CONFLICT =
  "JWT: prioriza RS256 con JWT_PRIVATE_KEY / JWT_PUBLIC_KEY (PEM); JWT_SECRET (HS256) quedó deprecado.";
const UI_CONFLICT =
  "Frontend: MVP API + CLI sin panel web; menciones a React Hook Form / UI web son post-MVP.";

describe("resolveSddConflictGapMapping", () => {
  it("mapea TypeORM vs Prisma a tasks, mdd y blueprint", () => {
    const m = resolveSddConflictGapMapping(TYPEORM_CONFLICT);
    assert.deepEqual(m.affectedArtifacts, ["tasks", "mdd", "blueprint"]);
    assert.match(m.reference, /§2/);
  });

  it("mapea BullMQ vs RabbitMQ a tasks, userStories y mdd", () => {
    const m = resolveSddConflictGapMapping(BULL_CONFLICT);
    assert.deepEqual(m.affectedArtifacts, ["tasks", "userStories", "mdd"]);
    assert.match(m.reference, /§2/);
  });

  it("mapea JWT RS256 vs JWT_SECRET a tasks y mdd §6", () => {
    const m = resolveSddConflictGapMapping(JWT_CONFLICT);
    assert.deepEqual(m.affectedArtifacts, ["tasks", "mdd"]);
    assert.match(m.reference, /§6/);
  });

  it("mapea UI post-MVP a blueprint y uxUiGuide", () => {
    const m = resolveSddConflictGapMapping(UI_CONFLICT);
    assert.deepEqual(m.affectedArtifacts, ["blueprint", "uxUiGuide"]);
    assert.match(m.reference, /§1/);
  });
});

describe("mapSddConflictToGapBody", () => {
  it("produce cuerpos válidos según reportDocumentationGapBodySchema", () => {
    for (const conflict of [TYPEORM_CONFLICT, BULL_CONFLICT, JWT_CONFLICT, UI_CONFLICT]) {
      const body = mapSddConflictToGapBody(conflict);
      const parsed = reportDocumentationGapBodySchema.safeParse(body);
      assert.equal(parsed.success, true, conflict);
      assert.ok(body.description.length >= 40, conflict);
    }
  });

  it("dedupHash estable para el mismo conflicto", () => {
    const body = mapSddConflictToGapBody(TYPEORM_CONFLICT);
    const h1 = computeDocumentationGapDedupHash("proj-1", "stage-1", body.evidence.reference, body.description);
    const h2 = computeDocumentationGapDedupHash("proj-1", "stage-1", body.evidence.reference, body.description);
    assert.equal(h1, h2);
  });

  it("mapSddConflictsToGapBodies no duplica el mismo conflicto en el lote", () => {
    const bodies = mapSddConflictsToGapBodies([
      TYPEORM_CONFLICT,
      TYPEORM_CONFLICT,
      BULL_CONFLICT,
    ]);
    assert.equal(bodies.length, 2);
  });
});
