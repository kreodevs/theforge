/**
 * Cliente Workshop — Modo asistido Fase 0 (API + mensajes de sesión).
 */

import { apiFetch, API_BASE } from "../../../utils/apiClient";
import { sessionMessageBody } from "../helpers/session-message";
import type { Session } from "../types";

export type Phase0AssistedTargetField = "dbgaContent" | "phase0SummaryContent";

export type Phase0AssistedApiEvent = {
  type?: string;
  message?: string;
  code?: string;
  threadId?: string;
  templateKind?: string;
  templateLabel?: string;
  targetField?: Phase0AssistedTargetField;
  markdown?: string;
  reformatted?: boolean;
  question?: string;
  n?: number;
  total?: number;
  impacto?: string;
  cambios?: string[];
  done?: boolean;
  awaitingSeed?: boolean;
};

export async function postPhase0AssistedStart(
  projectId: string,
  idea?: string,
): Promise<Phase0AssistedApiEvent> {
  const res = await apiFetch(`${API_BASE}/ai-analysis/phase0/assisted/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      ...(idea?.trim() ? { idea: idea.trim() } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Phase0AssistedApiEvent;
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message
        : "No se pudo activar el modo asistido",
    );
  }
  return data;
}

export async function postPhase0AssistedAnswer(opts: {
  projectId: string;
  answer: string;
  threadId?: string | null;
}): Promise<Phase0AssistedApiEvent> {
  const res = await apiFetch(`${API_BASE}/ai-analysis/phase0/assisted/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: opts.projectId,
      answer: opts.answer,
      ...(opts.threadId?.trim() ? { threadId: opts.threadId.trim() } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Phase0AssistedApiEvent;
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message
        : "No se pudo procesar la respuesta del modo asistido",
    );
  }
  return data;
}

export async function postPhase0AssistedStop(projectId: string): Promise<Phase0AssistedApiEvent> {
  const res = await apiFetch(`${API_BASE}/ai-analysis/phase0/assisted/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const data = (await res.json().catch(() => ({}))) as Phase0AssistedApiEvent;
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message
        : "No se pudo desactivar el modo asistido",
    );
  }
  return data;
}

export function countWorkshopTabMessages(
  session: Session | null | undefined,
  tab: string,
): number {
  return (session?.chatLog ?? []).filter((m) => (m.tab ?? "mdd") === tab).length;
}

/** Crea sesión de chat vía welcome si el Workshop aún no tiene `session.id`. */
export async function ensureWorkshopChatSession(opts: {
  projectId: string;
  tab: string;
  fetchWelcome: (
    projectId: string,
    activeTab?: string,
    options?: { skipLoading?: boolean },
  ) => Promise<void>;
  getSession: () => Session | null;
}): Promise<Session | null> {
  const existing = opts.getSession();
  if (existing?.id) return existing;
  await opts.fetchWelcome(opts.projectId, opts.tab, { skipLoading: true });
  return opts.getSession();
}

export async function appendWorkshopChatPair(opts: {
  session: Session | null;
  stageId: string | null | undefined;
  tab: string;
  userContent?: string;
  assistantContent: string;
}): Promise<Session | null> {
  const { session, stageId, tab, userContent, assistantContent } = opts;
  if (!session?.id) return null;
  let next = session;
  if (userContent?.trim()) {
    const userRes = await apiFetch(`${API_BASE}/sessions/${session.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: sessionMessageBody({ role: "user", content: userContent.trim(), tab }, stageId),
    });
    if (userRes.ok) next = (await userRes.json()) as Session;
  }
  const asstRes = await apiFetch(`${API_BASE}/sessions/${next.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: sessionMessageBody(
      { role: "assistant", content: assistantContent, tab },
      stageId,
    ),
  });
  if (asstRes.ok) next = (await asstRes.json()) as Session;
  return next;
}

export function applyAssistedMarkdownToState(
  set: (partial: Record<string, unknown>) => void,
  event: Phase0AssistedApiEvent,
): void {
  const md = typeof event.markdown === "string" ? event.markdown : "";
  if (!md.trim()) return;
  if (event.targetField === "phase0SummaryContent") {
    set({ phase0SummaryContent: md });
  } else {
    set({ dbgaContent: md });
  }
}
