import type { ChatImagePart } from "@theforge/shared-types";

export function pickEvaluatorCritique(data: Record<string, unknown>): string | null {
  const c = data.evaluatorCritique;
  return typeof c === "string" && c.trim().length > 0 ? c.trim() : null;
}

/** Body JSON para `POST /sessions/:id/messages` con `stageId` opcional. */
export function sessionMessageBody(
  base: { role: "user" | "assistant"; content: string; tab?: string; images?: ChatImagePart[] },
  stageId: string | null | undefined,
): string {
  return JSON.stringify({
    ...base,
    ...(stageId?.trim() ? { stageId: stageId.trim() } : {}),
  });
}

export function lastMddUserMessageContent(
  log: { role: string; content: string; tab?: string }[] | undefined,
): string | null {
  if (!log?.length) return null;
  for (let i = log.length - 1; i >= 0; i--) {
    const m = log[i];
    if (!m) continue;
    if (m.role === "user" && (m.tab ?? "mdd") === "mdd") return m.content;
  }
  return null;
}
