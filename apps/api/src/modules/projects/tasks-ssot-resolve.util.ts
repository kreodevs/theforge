/**
 * Resuelve SSOT tasks (tasksJson v2 + fallback tasksContent) para next-task, export y MCP.
 */

import { resolveTasksForConsume, type ResolvedTasksBundle } from "@theforge/shared-types";
import { convertTasksJsonV2ToTasksMdV1 } from "../engine/task-v2/tasks-json-v2-to-md-v1.js";

export type ProjectTasksSsotInput = {
  tasksContent?: string | null;
  tasksJson?: unknown;
  /** Stage-level JSON gana sobre project cuando ambos existen. */
  stageTasksJson?: unknown;
};

export type ProjectTasksSsot = ResolvedTasksBundle & {
  /** Markdown listo para parseTasksMarkdown / spec-kit (JSON→v1 si hace falta). */
  markdown: string | null;
};

/** Resuelve tasks con SSOT: preferir tasksJson válido; markdown desde content o conversión v2→v1. */
export function resolveProjectTasksSsot(input: ProjectTasksSsotInput): ProjectTasksSsot {
  const tasksJson = input.stageTasksJson ?? input.tasksJson;
  const resolved = resolveTasksForConsume({
    tasksContent: input.tasksContent,
    tasksJson,
  });

  let markdown = resolved.markdown?.trim() ?? "";
  if (!markdown && resolved.hasTasksJson && resolved.tasksJson) {
    markdown = convertTasksJsonV2ToTasksMdV1(resolved.tasksJson).trim();
  }

  return {
    ...resolved,
    markdown: markdown.length > 0 ? markdown : null,
  };
}
