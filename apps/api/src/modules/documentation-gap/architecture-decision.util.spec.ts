import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeAgentGovernanceScaffold } from "../ai/utils/agent-governance.util.js";
import {
  ADR_DECISIONS_PREFIX,
  appendArchitectureDecisionToScaffold,
  architectureDecisionAlreadyRecorded,
  buildArchitectureDecisionFromGap,
  buildArchitectureDecisionFromSddConflict,
  listArchitectureDecisionFiles,
  splitAutoReconcileConflictDescription,
} from "./architecture-decision.util.js";

const TYPEORM_CONFLICT =
  "TypeORM vs Prisma: prioriza el ORM declarado en MDD §2/Blueprint; no mezcles ambos en el mismo servicio.";
const BULL_CONFLICT =
  "Cola/mensajería: prioriza BullMQ + Redis del MDD §2; ignora menciones sueltas de RabbitMQ/Kafka en Blueprint u otros entregables.";
const RABBITMQ_CONFLICT =
  "Cola/mensajería: prioriza RabbitMQ del MDD §2; no uses BullMQ/Bull en workers ni tasks.";
const JWT_CONFLICT =
  "JWT: prioriza RS256 con JWT_PRIVATE_KEY / JWT_PUBLIC_KEY (PEM); JWT_SECRET (HS256) quedó deprecado.";
const UI_CONFLICT =
  "Frontend: MVP API + CLI sin panel web; menciones a React Hook Form / UI web son post-MVP.";

describe("buildArchitectureDecisionFromSddConflict", () => {
  for (const [label, conflict] of [
    ["TypeORM", TYPEORM_CONFLICT],
    ["BullMQ", BULL_CONFLICT],
    ["JWT", JWT_CONFLICT],
    ["UI post-MVP", UI_CONFLICT],
  ] as const) {
    it(`genera ADR en español para conflicto ${label}`, () => {
      const adr = buildArchitectureDecisionFromSddConflict(conflict, "auto-deterministic");
      assert.match(adr.content, /^# ADR-\d{3}:/);
      assert.match(adr.content, /\*\*Estado:\*\* Aceptada/);
      assert.match(adr.content, /## Contexto/);
      assert.match(adr.content, /## Decisión/);
      assert.match(adr.content, /MDD wins|fuente de verdad/i);
      assert.match(adr.content, /## Consecuencias/);
      assert.match(adr.content, /## Artefactos afectados/);
      assert.match(adr.content, /## Referencia SDD/);
      assert.ok(adr.path.startsWith(ADR_DECISIONS_PREFIX));
      assert.equal(adr.graphPayload.status, "Accepted");
      assert.ok(adr.graphPayload.title.includes(adr.id));
    });
  }

  it("ADR RabbitMQ no confunde negación BullMQ/Bull con decisión Bull", () => {
    const adr = buildArchitectureDecisionFromSddConflict(RABBITMQ_CONFLICT, "auto-deterministic");
    assert.match(adr.title, /RabbitMQ/i);
    assert.match(adr.content, /RabbitMQ/);
    assert.ok(!/BullMQ \+ Redis/i.test(adr.content.split("## Decisión")[1] ?? ""));
  });

  it("numera ADRs secuencialmente en el scaffold", () => {
    const first = buildArchitectureDecisionFromSddConflict(TYPEORM_CONFLICT, "auto-reconcile");
    const scaffold = serializeAgentGovernanceScaffold({
      manifest: { templateVersion: "2.0.0", files: [first.path] },
      files: [{ path: first.path, content: first.content }],
    });
    const existing = listArchitectureDecisionFiles(scaffold);
    const second = buildArchitectureDecisionFromSddConflict(BULL_CONFLICT, "auto-reconcile", {
      existingFiles: existing,
    });
    assert.match(second.id, /ADR-002/);
  });
});

describe("buildArchitectureDecisionFromGap", () => {
  it("documenta gap HITL con evidencia y artefactos", () => {
    const adr = buildArchitectureDecisionFromGap(
      {
        description: "Tasks mencionan Prisma pero el MDD declara TypeORM en §2.",
        affectedArtifacts: ["tasks", "mdd"],
        evidence: {
          reference: "§2 Stack técnico (MDD)",
          snippet: "- ORM: TypeORM\n- tasks: Prisma Client",
        },
      },
      "hitl-approved",
    );
    assert.match(adr.content, /aprobación HITL/i);
    assert.match(adr.content, /TypeORM/);
    assert.match(adr.content, /§2 Stack técnico/);
    assert.deepEqual(adr.affectedArtifacts, ["tasks", "mdd"]);
  });
});

describe("appendArchitectureDecisionToScaffold", () => {
  it("añade archivo ADR y evita duplicados por dedupKey", () => {
    const adr = buildArchitectureDecisionFromSddConflict(JWT_CONFLICT, "auto-deterministic");
    const first = appendArchitectureDecisionToScaffold(null, adr);
    assert.equal(first.appended, true);
    assert.ok(first.serialized.includes(adr.path));

    const second = appendArchitectureDecisionToScaffold(first.serialized, adr);
    assert.equal(second.appended, false);
    assert.equal(
      architectureDecisionAlreadyRecorded(listArchitectureDecisionFiles(first.serialized), adr.dedupKey),
      true,
    );
  });
});

describe("splitAutoReconcileConflictDescription", () => {
  it("divide descripción compuesta de auto-reconcile", () => {
    const parts = splitAutoReconcileConflictDescription(
      `${TYPEORM_CONFLICT} | ${BULL_CONFLICT}`,
    );
    assert.equal(parts.length, 2);
    assert.match(parts[0]!, /TypeORM/);
    assert.match(parts[1]!, /BullMQ/);
  });
});
