import {
  normalizeMddJobProgressState,
  type MddJobProgressStep,
} from "@theforge/shared-types";

export type AgentProgressStatus = "active" | "done" | "generando" | "terminado";

export type AgentProgressItem = {
  agent: string;
  message: string;
  step?: string;
  status?: AgentProgressStatus;
};

export type { MddJobProgressStep };

/** Reconstruye la lista del panel desde el estado acumulado del job MDD. */
export function agentProgressFromMddJobProgress(raw: unknown): AgentProgressItem[] {
  const state = normalizeMddJobProgressState(raw);
  const items: AgentProgressItem[] = state.steps.map((s) => ({ ...s, status: "done" as const }));
  if (state.active) {
    items.push({ ...state.active, status: "generando" as const });
  }
  return items;
}

export function agentProgressFromMddJobSnapshot(snapshot: {
  progressSteps?: MddJobProgressStep[];
  progressActive?: MddJobProgressStep | null;
}): AgentProgressItem[] {
  return agentProgressFromMddJobProgress({
    steps: snapshot.progressSteps ?? [],
    active: snapshot.progressActive ?? null,
  });
}

/** Campos planos legacy en el payload `progress` del poll MDD (compat con número). */
export function mddJobProgressEventFields(raw: unknown): {
  agent?: string;
  message?: string;
  phase?: string;
} {
  if (raw == null || typeof raw === "number") return {};
  const o = raw as Record<string, unknown>;
  const latest =
    o.latest && typeof o.latest === "object" && !Array.isArray(o.latest)
      ? (o.latest as Record<string, unknown>)
      : null;
  return {
    agent:
      typeof o.agent === "string"
        ? o.agent
        : typeof latest?.agent === "string"
          ? latest.agent
          : undefined,
    message:
      typeof o.message === "string"
        ? o.message
        : typeof latest?.message === "string"
          ? latest.message
          : undefined,
    phase:
      typeof o.phase === "string"
        ? o.phase
        : typeof latest?.phase === "string"
          ? latest.phase
          : undefined,
  };
}

function sameAgentProgressStep(
  a: Pick<AgentProgressItem, "agent" | "message">,
  b: Pick<AgentProgressItem, "agent" | "message">,
): boolean {
  return a.agent === b.agent && a.message === b.message;
}

/** Paso ya ejecutado: marca el activo anterior como hecho y añade uno nuevo completado. */
export function appendAgentProgressDone(
  prev: readonly AgentProgressItem[],
  item: { agent: string; message: string },
): AgentProgressItem[] {
  const last = prev[prev.length - 1];
  if (last && sameAgentProgressStep(last, item)) {
    return prev.map((p) =>
      isAgentProgressActive(p) ? { ...p, status: "done" as const } : { ...p, status: p.status ?? "done" },
    );
  }
  const normalized = prev.map((p) =>
    isAgentProgressActive(p) ? { ...p, status: "done" as const } : { ...p, status: p.status ?? "done" },
  );
  return [...normalized, { ...item, status: "done" }];
}

export function isAgentProgressActive(item: AgentProgressItem): boolean {
  return item.status === "active" || item.status === "generando";
}
