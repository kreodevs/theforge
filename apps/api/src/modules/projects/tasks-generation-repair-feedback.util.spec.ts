import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeTasksRedactorRetryFeedback,
  composeTasksRepairFeedbackLines,
} from "./tasks-generation-repair-feedback.util.js";
import type { TasksLlmAuditorOutput } from "@theforge/shared-types";
import type { TasksQualityReport } from "./tasks-generation-quality.util.js";

const baseQuality = (overrides: Partial<TasksQualityReport> = {}): TasksQualityReport =>
  ({
    ok: false,
    score: 70,
    accuracyScore: 70,
    auditScore: 70,
    taskCount: 10,
    feedback: "Falta ## Testing tasks",
    ...overrides,
  }) as TasksQualityReport;

const baseAuditor = (overrides: Partial<TasksLlmAuditorOutput> = {}): TasksLlmAuditorOutput => ({
  score: 48,
  passed: false,
  missing_coverage: ["POST /api/v1/auth/login"],
  conflicts: [],
  traceability_gaps: [],
  dependency_issues: [],
  executable_gaps: [],
  feedback: "Cobertura API incompleta.",
  ...overrides,
});

describe("tasks-generation-repair-feedback", () => {
  it("composeTasksRepairFeedbackLines deduplica líneas", () => {
    const lines = composeTasksRepairFeedbackLines(
      baseQuality({ feedback: "gap A" }),
      baseAuditor({ feedback: "gap A", missing_coverage: ["endpoint X"] }),
      "gap externo",
    );
    assert.match(lines, /gap externo/);
    assert.match(lines, /Cobertura: endpoint X/);
    assert.equal(lines.split("\n").filter((l) => l === "gap A").length, 1);
  });

  it("composeTasksRedactorRetryFeedback incluye rechazo, historial y auditor", () => {
    const result = composeTasksRedactorRetryFeedback({
      repairAttempt: 2,
      maxRepairs: 5,
      repairFeedbackLines: "Falta sección Testing",
      llmAuditor: baseAuditor(),
      priorAttemptSummaries: ["intento 1: truncado"],
      documentTruncated: true,
    });

    assert.match(result.gapsFeedback, /Intento anterior RECHAZADO.*\(2\/5\)/);
    assert.match(result.gapsFeedback, /truncado/);
    assert.match(result.gapsFeedback, /NO debes repetir/);
    assert.match(result.gapsFeedback, /intento 1: truncado/);
    assert.match(result.tasksAuditorFeedback, /Cobertura API incompleta/);
    assert.match(result.tasksAuditorFeedback, /48\/100/);
    assert.match(result.tasksAuditorFeedback, /POST \/api\/v1\/auth\/login/);
  });
});
