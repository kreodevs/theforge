import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SECURITY_ARCHITECTURE_AUDIT_FAMILIES } from "../mdd-security-architecture-audit-catalog.js";
import { MddSecurityArchitectureAuditService } from "../mdd-security-architecture-audit.service.js";
import { SECURITY_AUDIT_LOW_COVERAGE_WARNING } from "../mdd-security-architecture-audit-parse.util.js";

const PROJECT_ID = "proj-test";
const STAGE_ID = "stage-test";
const USER_ID = "user-test";

function buildShallowAuditResponse(): string {
  return [
    "### 8.1 Veredicto",
    "Veredicto de puerta: `NO APTO PARA IMPLEMENTACIÓN`",
    "",
    "```json",
    JSON.stringify({
      veredicto: "NO_APTO",
      resumen: { bloqueante: 2, alto: 0, medio: 0, bajo: 0 },
      hallazgos: [
        {
          id: "GAP-001",
          severidad: "BLOQUEANTE",
          verificacion: "C03",
          titulo: "Inmutabilidad sin trigger",
          evidencia: "§5 declara inmutabilidad solo en prosa",
        },
        {
          id: "GAP-002",
          severidad: "BLOQUEANTE",
          verificacion: "E06",
          titulo: "JWT HS256",
          evidencia: "§5 especifica algoritmo HS256 compartido entre 3 réplicas",
        },
      ],
    }),
    "```",
  ].join("\n");
}

function createServiceWithMockLlm(
  onInvoke: (tag: string) => string,
): MddSecurityArchitectureAuditService {
  const service = new MddSecurityArchitectureAuditService(
    {
      resolveAuditorRuntime: async () => ({
        providerId: "openrouter",
        apiKey: "k",
        baseURL: "https://x",
        chatModel: "m",
        chatModelFallbacks: [],
        embeddingModel: null,
        embeddingDimension: null,
        embeddingsEnabled: false,
        sttModel: null,
        visionModel: "m",
      }),
    } as never,
    {
      project: {
        findUnique: async () => ({ userId: USER_ID }),
      },
      stage: {
        findUnique: async () => ({ shortTermContext: {} }),
        update: async () => ({}),
      },
    } as never,
    {
      getMddContentForProject: async () => null,
    } as never,
  );

  (service as unknown as { invokeAuditorLlm: typeof onInvoke }).invokeAuditorLlm = async (
    _llm,
    _content,
    tag,
  ) => onInvoke(tag);

  (service as unknown as { resolveStageId: () => Promise<string> }).resolveStageId = async () =>
    STAGE_ID;

  return service;
}

describe("MddSecurityArchitectureAuditService.audit", () => {
  it("default usa single-shot (1 llamada LLM en MDD moderado)", async () => {
    const tags: string[] = [];
    const service = createServiceWithMockLlm((tag) => {
      tags.push(tag);
      return buildShallowAuditResponse();
    });

    const mdd = "# MDD\n\n" + "contenido ".repeat(500);
    assert.ok(mdd.length < 30_000);

    const result = await service.audit(PROJECT_ID, STAGE_ID, mdd);

    assert.equal(result.error, undefined);
    assert.equal(tags.length, 1);
    assert.equal(tags[0], "SecurityArchitectureAuditor:single-shot");
    assert.ok(result.structured?.hallazgos?.length);
  });

  it("deepAudit usa multi-pase por familia (7 llamadas)", async () => {
    const tags: string[] = [];
    const service = createServiceWithMockLlm((tag) => {
      tags.push(tag);
      return buildShallowAuditResponse();
    });

    const mdd = "# MDD\n\n" + "x".repeat(5_000);

    const result = await service.audit(PROJECT_ID, STAGE_ID, mdd, { deepAudit: true });

    assert.equal(result.error, undefined);
    assert.equal(tags.length, SECURITY_ARCHITECTURE_AUDIT_FAMILIES.length);
    assert.ok(tags.every((tag) => tag.startsWith("SecurityArchitectureAuditor:family:")));
    assert.equal(tags.filter((tag) => tag.includes(":family:A")).length, 1);
  });

  it("depth warning en 1-shot sin escalar a multi-pase", async () => {
    const tags: string[] = [];
    const service = createServiceWithMockLlm((tag) => {
      tags.push(tag);
      return buildShallowAuditResponse();
    });

    const mdd = "# MDD KMS\n\n" + "cifrado ".repeat(5_500);
    assert.ok(mdd.length > 30_000);

    const result = await service.audit(PROJECT_ID, STAGE_ID, mdd);

    assert.equal(result.error, undefined);
    assert.equal(tags.length, 2);
    assert.ok(tags.every((tag) => tag === "SecurityArchitectureAuditor:single-shot"));
    assert.deepEqual(result.warnings, [SECURITY_AUDIT_LOW_COVERAGE_WARNING]);
  });
});
