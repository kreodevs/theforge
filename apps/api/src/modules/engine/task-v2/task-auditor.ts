/**
 * Task Auditor Node — valida la calidad de tasks generadas antes de persistir.
 * Equivalente al MDD Auditor pero para el artefacto tasks.md/tasks.json.
 */

import { ParsedTaskV2, TaskParseResult } from "./tasks-parser-v2.js";

export interface TaskAuditResult {
  score: number; // 0-100
  passed: boolean;
  errors: TaskAuditError[];
  warnings: TaskAuditWarning[];
  fixes: TaskAuditFix[];
}

export interface TaskAuditError {
  taskId?: string;
  message: string;
  severity: "error" | "critical";
  rule: string;
}

export interface TaskAuditWarning {
  taskId?: string;
  message: string;
  rule: string;
}

export interface TaskAuditFix {
  taskId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

// ---- Reglas de auditoría ----

const RULES = {
  // Estructura obligatoria
  HAS_ID: { id: "T-AUD-001", weight: 5, message: "Tarea debe tener id" },
  HAS_TITLE: { id: "T-AUD-002", weight: 5, message: "Tarea debe tener título" },
  HAS_CHANGE_TYPE: { id: "T-AUD-003", weight: 10, message: "Tarea debe especificar change_type" },
  HAS_TARGET_FILES: { id: "T-AUD-004", weight: 10, message: "Tarea debe tener al menos un target_file" },

  // Calidad de ejecución
  HAS_VERIFICATION: { id: "T-AUD-005", weight: 10, message: "Tarea debería tener test_command o verification" },
  HAS_CODE_EXPECTED: { id: "T-AUD-006", weight: 5, message: "Tarea debería incluir Código Esperado" },
  HAS_INFERENCE_RULES: { id: "T-AUD-007", weight: 5, message: "Tarea debería tener al menos una regla de inferencia" },

  // Consistencia
  DEPENDENCIES_EXIST: { id: "T-AUD-008", weight: 10, message: "Las dependencias deben referenciar tasks existentes" },
  NO_CIRCULAR_DEPS: { id: "T-AUD-009", weight: 15, message: "No debe haber dependencias circulares" },
  COVERAGE_CHECK: { id: "T-AUD-010", weight: 20, message: "Cada entidad CRUD debe tener cobertura completa" },

  // Trazabilidad
  HAS_MDD_REF: { id: "T-AUD-011", weight: 5, message: "Tarea debería referenciar MDD §3" },
  HAS_ENTITY: { id: "T-AUD-012", weight: 5, message: "Tarea backend debería declarar entity" },
};

const BASE_SCORE = 100;
const GREEN_THRESHOLD = 90;
const YELLOW_THRESHOLD = 75;

// ---- Motor de auditoría ----

export function auditTasks(parseResult: TaskParseResult): TaskAuditResult {
  const errors: TaskAuditError[] = [];
  const warnings: TaskAuditWarning[] = [];
  const fixes: TaskAuditFix[] = [];
  let score = BASE_SCORE;

  const { tasks } = parseResult;
  const taskIds = new Set(tasks.map((t) => t.id));

  // 1. Estructura por tarea
  for (const task of tasks) {
    checkStructure(task, errors, warnings, fixes);
  }

  // 2. Dependencias
  checkDependencies(tasks, taskIds, errors, warnings);

  // 3. Ciclos
  const cycles = detectCycles(tasks);
  for (const cycle of cycles) {
    errors.push({
      severity: "critical",
      message: `Dependencia circular detectada: ${cycle.join(" → ")}`,
      rule: RULES.NO_CIRCULAR_DEPS.id,
    });
    score -= RULES.NO_CIRCULAR_DEPS.weight;
  }

  // 4. Cobertura CRUD
  const coverageResult = checkCrudCoverage(tasks);
  if (!coverageResult.complete) {
    errors.push({
      severity: "error",
      message: `Faltan ${coverageResult.missing.length} tareas de CRUD para entidades: ${coverageResult.missing.join(", ")}`,
      rule: RULES.COVERAGE_CHECK.id,
    });
    score -= RULES.COVERAGE_CHECK.weight;
  }

  // 5. Estimación de precisión (reservado para futura expansión)
  // const accuracyHints = estimateCodeAccuracy(tasks);

  return {
    score: Math.max(0, score),
    passed: score >= GREEN_THRESHOLD && errors.filter((e) => e.severity === "critical").length === 0,
    errors,
    warnings,
    fixes,
  };
}

// ---- Checks individuales ----

function checkStructure(
  task: ParsedTaskV2,
  errors: TaskAuditError[],
  warnings: TaskAuditWarning[],
  fixes: TaskAuditFix[],
): void {
  if (!task.id || task.id.trim() === "") {
    errors.push({
      taskId: task.id,
      message: RULES.HAS_ID.message,
      severity: "error",
      rule: RULES.HAS_ID.id,
    });
  }

  if (!task.title || task.title.trim().length < 5) {
    errors.push({
      taskId: task.id,
      message: RULES.HAS_TITLE.message,
      severity: "critical",
      rule: RULES.HAS_TITLE.id,
    });
  }

  if (!task.changeType) {
    errors.push({
      taskId: task.id,
      message: RULES.HAS_CHANGE_TYPE.message,
      severity: "critical",
      rule: RULES.HAS_CHANGE_TYPE.id,
    });
    fixes.push({
      taskId: task.id,
      field: "changeType",
      oldValue: `${task.changeType}`,
      newValue: "create",
      reason: "change_type obligatorio; asumido create por defecto",
    });
  }

  if (!task.targetFiles || task.targetFiles.length === 0) {
    warnings.push({
      taskId: task.id,
      message: RULES.HAS_TARGET_FILES.message,
      rule: RULES.HAS_TARGET_FILES.id,
    });
  }

  if (!task.testCommand && !task.verification?.command && !task.verification?.checklist?.length) {
    warnings.push({
      taskId: task.id,
      message: RULES.HAS_VERIFICATION.message,
      rule: RULES.HAS_VERIFICATION.id,
    });
  }

  if (!task.codeExpected && !task.diffExpected) {
    warnings.push({
      taskId: task.id,
      message: RULES.HAS_CODE_EXPECTED.message,
      rule: RULES.HAS_CODE_EXPECTED.id,
    });
  }

  if (task.inferenceRules.length === 0) {
    warnings.push({
      taskId: task.id,
      message: RULES.HAS_INFERENCE_RULES.message,
      rule: RULES.HAS_INFERENCE_RULES.id,
    });
  }

  if (!task.mddRef) {
    warnings.push({
      taskId: task.id,
      message: RULES.HAS_MDD_REF.message,
      rule: RULES.HAS_MDD_REF.id,
    });
  }

  if (!task.entity && task.section?.toLowerCase().includes("backend")) {
    warnings.push({
      taskId: task.id,
      message: RULES.HAS_ENTITY.message,
      rule: RULES.HAS_ENTITY.id,
    });
  }
}

function checkDependencies(
  tasks: ParsedTaskV2[],
  taskIds: Set<string>,
  errors: TaskAuditError[],
  _warnings: TaskAuditWarning[],
): void {
  for (const task of tasks) {
    for (const dep of task.dependencies ?? []) {
      if (!taskIds.has(dep)) {
        errors.push({
          taskId: task.id,
          message: `Dependencia inexistente: ${dep} no encontrado en tasks`,
          severity: "critical",
          rule: RULES.DEPENDENCIES_EXIST.id,
        });
      }
    }
  }
}

function detectCycles(tasks: ParsedTaskV2[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const t of tasks) {
    graph.set(t.id, t.dependencies ?? []);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      if (idx >= 0) cycles.push([...path.slice(idx), node]);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const dep of graph.get(node) ?? []) {
      dfs(dep);
    }

    path.pop();
    stack.delete(node);
  }

  for (const [node] of graph) {
    if (!visited.has(node)) dfs(node);
  }

  return cycles;
}

function checkCrudCoverage(tasks: ParsedTaskV2[]): { complete: boolean; missing: string[] } {
  const entityOps = new Map<string, Set<string>>();

  for (const task of tasks) {
    if (!task.entity) continue;
    const ops = entityOps.get(task.entity) ?? new Set<string>();
    for (const op of task.operations ?? []) {
      ops.add(op);
    }
    entityOps.set(task.entity, ops);
  }

  const missing: string[] = [];
  for (const [entity, ops] of entityOps) {
    if (!ops.has("create")) missing.push(`${entity}:create`);
    if (!ops.has("read")) missing.push(`${entity}:read`);
    if (!ops.has("update")) missing.push(`${entity}:update`);
    if (!ops.has("delete")) missing.push(`${entity}:delete`);
    if (!ops.has("list")) missing.push(`${entity}:list`);
  }

  return { complete: missing.length === 0, missing };
}

// ---- Export ----
export default {
  auditTasks,
  RULES,
  GREEN_THRESHOLD,
  YELLOW_THRESHOLD,
};
