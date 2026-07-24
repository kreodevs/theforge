/**
 * Tests de la función pura de agregación de token usage.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateTokenUsageRows,
  type RawTokenUsageRow,
} from "./token-usage.service.js";

const t0 = new Date("2026-07-24T10:00:00Z");
const t1 = new Date("2026-07-24T10:05:00Z");
const t2 = new Date("2026-07-24T10:10:00Z");

describe("aggregateTokenUsageRows", () => {
  it("devuelve summary vacío para input vacío", () => {
    const summary = aggregateTokenUsageRows("p1", []);
    assert.equal(summary.projectId, "p1");
    assert.equal(summary.totalTokens, 0);
    assert.equal(summary.documents.length, 0);
    assert.equal(summary.mxnPerUsd, 20);
  });

  it("suma tokens y coste de una sola fila", () => {
    const rows: RawTokenUsageRow[] = [
      {
        projectId: "p1",
        stageId: null,
        documentField: "mddContent",
        context: "initial",
        node: "software_architect",
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 1_000,
        completionTokens: 500,
        totalTokens: 1_500,
        costUsd: 0.0075,
        costMxn: 0.15,
        jobId: "j1",
        createdAt: t0,
      },
    ];
    const summary = aggregateTokenUsageRows("p1", rows);
    assert.equal(summary.totalTokens, 1_500);
    assert.equal(summary.totalCostUsd, 0.0075);
    assert.equal(summary.totalCostMxn, 0.15);
    assert.equal(summary.documents.length, 1);
    const doc = summary.documents[0]!;
    assert.equal(doc.documentField, "mddContent");
    assert.equal(doc.generations, 1);
    assert.equal(doc.byModel.length, 1);
    assert.equal(doc.byModel[0]?.calls, 1);
  });

  it("agrupa múltiples generaciones del mismo documento", () => {
    const rows: RawTokenUsageRow[] = [
      {
        projectId: "p1",
        stageId: null,
        documentField: "specContent",
        context: "initial",
        node: null,
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 2_000,
        completionTokens: 1_000,
        totalTokens: 3_000,
        costUsd: 0.015,
        costMxn: 0.30,
        jobId: "j1",
        createdAt: t0,
      },
      {
        projectId: "p1",
        stageId: null,
        documentField: "specContent",
        context: "regenerate",
        node: null,
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 1_000,
        completionTokens: 500,
        totalTokens: 1_500,
        costUsd: 0.0075,
        costMxn: 0.15,
        jobId: "j2",
        createdAt: t1,
      },
    ];
    const summary = aggregateTokenUsageRows("p1", rows);
    assert.equal(summary.documents.length, 1);
    const doc = summary.documents[0]!;
    assert.equal(doc.documentField, "specContent");
    assert.equal(doc.generations, 2);
    assert.equal(doc.totalTokens, 4_500);
    assert.equal(Number(doc.totalCostUsd.toFixed(4)), 0.0225);
    assert.equal(Number(doc.totalCostMxn.toFixed(4)), 0.45);
    assert.equal(doc.firstAt.getTime(), t0.getTime());
    assert.equal(doc.lastAt.getTime(), t1.getTime());
  });

  it("separa por modelo cuando un documento usa varios", () => {
    const rows: RawTokenUsageRow[] = [
      {
        projectId: "p1",
        stageId: null,
        documentField: "mddContent",
        context: "initial",
        node: "software_architect",
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 1_000,
        completionTokens: 500,
        totalTokens: 1_500,
        costUsd: 0.0075,
        costMxn: 0.15,
        jobId: null,
        createdAt: t0,
      },
      {
        projectId: "p1",
        stageId: null,
        documentField: "mddContent",
        context: "initial",
        node: "auditor",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 500,
        completionTokens: 200,
        totalTokens: 700,
        costUsd: 0.000195,
        costMxn: 0.0039,
        jobId: null,
        createdAt: t1,
      },
    ];
    const summary = aggregateTokenUsageRows("p1", rows);
    const doc = summary.documents[0]!;
    assert.equal(doc.generations, 2);
    assert.equal(doc.byModel.length, 2);
    const gpt4o = doc.byModel.find((m) => m.modelId === "gpt-4o");
    const mini = doc.byModel.find((m) => m.modelId === "gpt-4o-mini");
    assert.ok(gpt4o);
    assert.ok(mini);
    assert.equal(gpt4o?.calls, 1);
    assert.equal(mini?.calls, 1);
  });

  it("documentos quedan ordenados alfabéticamente", () => {
    const rows: RawTokenUsageRow[] = [
      baseRow("mddContent", t0),
      baseRow("architectureContent", t1),
      baseRow("specContent", t2),
    ];
    const summary = aggregateTokenUsageRows("p1", rows);
    assert.deepEqual(
      summary.documents.map((d) => d.documentField),
      ["architectureContent", "mddContent", "specContent"],
    );
  });

  it("acepta un mxnPerUsd custom", () => {
    const rows: RawTokenUsageRow[] = [baseRow("mddContent", t0)];
    const summary = aggregateTokenUsageRows("p1", rows, 17.5);
    assert.equal(summary.mxnPerUsd, 17.5);
  });
});

function baseRow(documentField: string, createdAt: Date): RawTokenUsageRow {
  return {
    projectId: "p1",
    stageId: null,
    documentField,
    context: "initial",
    node: null,
    providerId: "openai",
    modelId: "gpt-4o",
    promptTokens: 1_000,
    completionTokens: 500,
    totalTokens: 1_500,
    costUsd: 0.0075,
    costMxn: 0.15,
    jobId: null,
    createdAt,
  };
}
