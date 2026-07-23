/** Paso completado del pipeline MDD (agente + mensaje en pasado). */
export type MddJobProgressStep = {
  agent: string;
  message: string;
};

/** Evento parcial emitido por el pipeline o la cola. */
export type MddJobProgressPatch = {
  agent?: string;
  message?: string;
  phase?: string;
  mddLength?: number;
  section?: number;
  /** Fase agregada del pipeline MDD HIGH (UI: «Fase 2/4: Modelo de datos»). */
  phaseGroup?: {
    current: number;
    total: number;
    label: string;
  };
};

/** Estado acumulado de progreso de un job MDD (polling / generation-status). */
export type MddJobProgressState = {
  latest?: MddJobProgressPatch;
  steps: MddJobProgressStep[];
  active: MddJobProgressStep | null;
  phaseGroup?: MddJobProgressPatch["phaseGroup"] | null;
};

export function createEmptyMddJobProgressState(): MddJobProgressState {
  return { steps: [], active: null, phaseGroup: null };
}

function isProgressStep(value: unknown): value is MddJobProgressStep {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.agent === "string" && typeof o.message === "string";
}

/** Normaliza progreso legacy (solo último evento) o estado acumulado. */
export function normalizeMddJobProgressState(raw: unknown): MddJobProgressState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return createEmptyMddJobProgressState();
  }
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.steps)) {
    const steps = o.steps.filter(isProgressStep);
    const active = isProgressStep(o.active) ? o.active : null;
    const phaseGroup =
      o.phaseGroup &&
      typeof o.phaseGroup === "object" &&
      typeof (o.phaseGroup as Record<string, unknown>).current === "number" &&
      typeof (o.phaseGroup as Record<string, unknown>).total === "number" &&
      typeof (o.phaseGroup as Record<string, unknown>).label === "string"
        ? (o.phaseGroup as MddJobProgressPatch["phaseGroup"])
        : null;
    return {
      steps,
      active,
      phaseGroup,
      latest:
        o.latest && typeof o.latest === "object" && !Array.isArray(o.latest)
          ? (o.latest as MddJobProgressPatch)
          : undefined,
    };
  }
  const patch = raw as MddJobProgressPatch;
  if (patch.agent && patch.message) {
    return applyMddJobProgress(createEmptyMddJobProgressState(), patch);
  }
  if (patch.phase || patch.mddLength != null || patch.section != null) {
    return { steps: [], active: null, latest: patch };
  }
  return createEmptyMddJobProgressState();
}

/** Acumula un evento de progreso sin perder pasos entre polls. */
export function applyMddJobProgress(
  state: MddJobProgressState,
  patch: MddJobProgressPatch,
): MddJobProgressState {
  const next: MddJobProgressState = {
    ...state,
    latest: patch,
    ...(patch.phaseGroup ? { phaseGroup: patch.phaseGroup } : {}),
  };

  if (patch.phase === "active" && patch.agent && patch.message) {
    return {
      ...next,
      active: { agent: patch.agent, message: patch.message },
    };
  }

  if (patch.agent && patch.message && patch.phase !== "draft" && patch.phase !== "persisted") {
    const step: MddJobProgressStep = { agent: patch.agent, message: patch.message };
    const last = state.steps[state.steps.length - 1];
    const steps =
      last && last.agent === step.agent && last.message === step.message
        ? state.steps
        : [...state.steps, step];
    return { ...next, steps, active: null };
  }

  return next;
}
