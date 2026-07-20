/**
 * SSOT resolver for tasks: prefer valid tasksJson v2, else parse tasksContent markdown.
 */

export type TasksJsonV2Shape = {
  version?: string;
  tasks?: unknown[];
  errors?: unknown[];
};

export type ResolvedTasksSource = "tasksJson" | "tasksContent" | "none";

export type ResolvedTasksBundle = {
  source: ResolvedTasksSource;
  markdown: string | null;
  tasksJson: TasksJsonV2Shape | null;
  taskCount: number;
  hasTasksJson: boolean;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseTasksJsonShape(raw: unknown): TasksJsonV2Shape | null {
  if (raw == null || typeof raw !== "object") return null;
  const obj = raw as TasksJsonV2Shape;
  if (!Array.isArray(obj.tasks)) return null;
  return obj;
}

/** True when structured tasksJson has at least one parsed task. */
export function hasValidTasksJson(tasksJson: unknown): boolean {
  const parsed = parseTasksJsonShape(tasksJson);
  return (parsed?.tasks?.length ?? 0) > 0;
}

/**
 * Resolves tasks for Workshop, spec-kit export and MCP.
 * `tasksJson` wins when valid; otherwise falls back to `tasksContent` markdown.
 */
export function resolveTasksForConsume(params: {
  tasksContent?: string | null;
  tasksJson?: unknown;
}): ResolvedTasksBundle {
  const markdown = isNonEmptyString(params.tasksContent) ? params.tasksContent.trim() : null;
  const json = parseTasksJsonShape(params.tasksJson);
  const jsonCount = json?.tasks?.length ?? 0;

  if (jsonCount > 0) {
    return {
      source: "tasksJson",
      markdown,
      tasksJson: json,
      taskCount: jsonCount,
      hasTasksJson: true,
    };
  }

  if (markdown) {
    const yamlBlocks = (markdown.match(/^---\s*$/gm) ?? []).length;
    const approxTasks = Math.max(0, Math.floor(yamlBlocks / 2));
    return {
      source: "tasksContent",
      markdown,
      tasksJson: null,
      taskCount: approxTasks,
      hasTasksJson: false,
    };
  }

  return {
    source: "none",
    markdown: null,
    tasksJson: null,
    taskCount: 0,
    hasTasksJson: false,
  };
}
