import { HttpException, Logger } from "@nestjs/common";
import { type Project as DbProject } from "@theforge/database";
import type { DeliverableKind } from "@theforge/shared-types";
import { compactCodebaseDocForMddPrompt } from "../theforge/legacy-mdd-v1-markdown.util.js";
import type { TheForgeFileToModify } from "../theforge/theforge.service.js";
import { loadLegacyKnowledgePack } from "./knowledge-loader.js";
import type { LegacyDeliverablesDebugReport, LegacyFlowState } from "./legacy-coordinator.types.js";

const KNOWLEDGE = loadLegacyKnowledgePack();

export const COORDINATOR_SYSTEM =
  "Eres el coordinador del flujo legacy. Orquestas análisis del código (TheForge), preguntas al usuario y generación de documentos (MDD, SPEC, etc.). " +
  "Usa el conocimiento base para mantener coherencia y cascada specification-driven.\n\n" +
  "Cuando el análisis deba anclarse a interfaces reales (manual To-Be, MDD de cambio, contratos UI o firmas backend), prioriza en el discurso y en las peticiones al pipeline el uso de herramientas deterministas del grafo TheForge — **`get_contract_specs`** (props de componentes UI) y **`get_implementation_details`** (firma/tipos/endpoints de símbolos backend) — frente a **`semantic_search`** genérico o inferencias sin nombre de símbolo concreto.\n\n" +
  "Conocimiento base:\n---\n" +
  KNOWLEDGE +
  "\n---";

export function mddTheforgeContextBlock(theforgeContext: string): string {
  return theforgeContext.trim();
}

function envFlag(name: string, defaultTrue: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return defaultTrue;
  return !["0", "false", "off", "no"].includes(v);
}

/** Cruza índice Ariadne con Falkor SDD antes de LLM (default: activo). Desactivar: LEGACY_SDD_INDEX_GATE=0. */
export function isLegacySddIndexGateEnabled(): boolean {
  return envFlag("LEGACY_SDD_INDEX_GATE", true);
}

/** Logs Nest por paso en cascada entregables legacy. Activar: `LEGACY_DELIVERABLES_DEBUG=1`. */
export function isLegacyDeliverablesDebugVerbose(): boolean {
  const v = process.env.LEGACY_DELIVERABLES_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isLegacyAutoGenerateMddAfterCodebaseDocEnabled(): boolean {
  const v = process.env.LEGACY_AUTO_GENERATE_MDD_AFTER_CODEBASE_DOC?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Entregable → tipo `POST …/legacy/generate-from-codebase` (kebab-case). */
export const DELIVERABLE_KIND_TO_CODEBASE_DOC_TYPE: Partial<Record<DeliverableKind, string>> = {
  spec: "spec",
  architecture: "architecture",
  use_cases: "use-cases",
  user_stories: "user-stories",
  blueprint: "blueprint",
  api_contracts: "api-contracts",
  logic_flows: "logic-flows",
  tasks: "tasks",
  infra: "infra",
};

export function buildReverseEngineeringMddForLegacySteps(
  codebaseDoc: string,
  report: LegacyDeliverablesDebugReport,
): string {
  const compact = compactCodebaseDocForMddPrompt(codebaseDoc);
  const wrapped =
    "[Ingeniería inversa: documento del codebase existente. Genera entregables que describan el sistema AS-IS.]\n\n" +
    compact;
  report.mddRollupWindows = 0;
  report.mddRollupFailed = false;
  report.mddLlmStrategy = "full";
  report.mddCharsSentToLlm = wrapped.length;
  report.mddClippedForLlm = false;
  return wrapped;
}

/**
 * Cooldown único antes del primer `runStep` cuando el MDD inyectado es muy largo (p. ej. `codebaseDoc_fallback`).
 * Default: si `mddChars` > 80000 → espera 20000 ms una vez.
 */
export function legacyDeliverablesLargeMddCooldownMs(mddChars: number): number {
  const thresholdRaw = process.env.LEGACY_DELIVERABLES_LARGE_MDD_THRESHOLD_CHARS?.trim();
  const threshold =
    thresholdRaw === undefined || thresholdRaw === ""
      ? 80_000
      : Math.max(0, parseInt(thresholdRaw, 10) || 0);
  if (threshold === 0 || mddChars <= threshold) return 0;
  const coolRaw = process.env.LEGACY_DELIVERABLES_LARGE_MDD_COOLDOWN_MS?.trim();
  const cool =
    coolRaw === undefined || coolRaw === ""
      ? 20_000
      : Math.max(0, parseInt(coolRaw, 10) || 0);
  return Math.min(cool, 180_000);
}

export function isLegacy429Like(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const o = err as { status?: number; statusCode?: number };
  if (o.status === 429 || o.statusCode === 429) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("resource exhausted") ||
    msg.includes("too many requests") ||
    msg.includes("rate limit")
  );
}

/** Reintentos ante 429 / resource exhausted (Gemini, Moonshot, etc.). */
export async function runWithLegacy429Retries<T>(
  run: () => Promise<T>,
  ctx: { logger: Logger; step: string },
): Promise<T> {
  const maxRaw = process.env.LEGACY_DELIVERABLES_LLM_429_MAX_RETRIES?.trim();
  const maxRetries =
    maxRaw === undefined || maxRaw === ""
      ? 5
      : Math.max(0, Math.min(12, parseInt(maxRaw, 10) || 0));
  const baseRaw = process.env.LEGACY_DELIVERABLES_LLM_429_BASE_DELAY_MS?.trim();
  const baseMs =
    baseRaw === undefined || baseRaw === ""
      ? 15_000
      : Math.max(500, parseInt(baseRaw, 10) || 15_000);

  let attempt = 0;
  for (;;) {
    try {
      return await run();
    } catch (err) {
      if (!isLegacy429Like(err) || attempt >= maxRetries) throw err;
      const fromHeaderSec = readRetryAfterSecondsFromErrorHeaders(err);
      const waitMs =
        fromHeaderSec != null
          ? Math.min(180_000, Math.max(2_000, fromHeaderSec * 1000))
          : Math.min(180_000, baseMs * 2 ** attempt);
      attempt++;
      ctx.logger.warn(
        `[LegacyDeliverables] upstream 429-like → wait ${waitMs}ms then retry ${attempt}/${maxRetries} (step=${ctx.step})`,
      );
      await sleepMs(waitMs);
    }
  }
}

const DELIVERABLE_PROJECT_FIELD: Partial<Record<DeliverableKind, keyof DbProject>> = {
  spec: "specContent",
  architecture: "architectureContent",
  use_cases: "useCasesContent",
  blueprint: "blueprintContent",
  api_contracts: "apiContractsContent",
  logic_flows: "logicFlowsContent",
  ux_ui_guide: "uxUiGuideContent",
  user_stories: "userStoriesContent",
  agent_governance: "agentGovernanceContent",
  tasks: "tasksContent",
  infra: "infraContent",
};

export function deliverableFieldCharCount(p: Record<string, unknown>, kind: DeliverableKind): number {
  const field = DELIVERABLE_PROJECT_FIELD[kind];
  if (!field) return 0;
  return String(p[field] ?? "").length;
}

export function clipDebug(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function readRetryAfterSecondsFromErrorHeaders(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const headers = (err as { headers?: unknown }).headers;
  if (!headers || typeof headers !== "object") return null;
  const h = headers as Record<string, unknown>;
  for (const key of ["retry-after", "x-retry-after", "msh-cooldown-seconds", "Retry-After", "X-Retry-After"]) {
    const v = h[key];
    if (v == null) continue;
    const n = parseInt(String(v), 10);
    if (Number.isFinite(n) && n > 0) return Math.min(600, Math.max(1, n));
  }
  return null;
}

/** Si el proveedor LLM devolvió 429 / resource exhausted (OpenAI-compatible, Gemini, etc.). */
export function upstreamLlmRateLimitHttpException(
  err: unknown,
  lastDeliverablesDebug: LegacyDeliverablesDebugReport,
): HttpException | null {
  if (!isLegacy429Like(err)) return null;
  const message =
    err instanceof Error && err.message.trim()
      ? err.message.trim()
      : "Proveedor LLM: límite de uso (429). Reintenta más tarde.";
  const retryAfterSeconds = readRetryAfterSecondsFromErrorHeaders(err) ?? 60;
  return new HttpException(
    {
      statusCode: 429,
      message,
      error: "Too Many Requests",
      code: "UPSTREAM_LLM_RATE_LIMIT",
      retryAfterSeconds,
      lastDeliverablesDebug,
    },
    429,
  );
}

/** Extrae JSON de texto directo o bloque ```json … ```. */
export function extractJsonFromText(text: string): string {
  const t = text.trim();
  if (t.startsWith("[")) return t;
  if (t.startsWith("{")) return t;
  const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  return jsonBlock ? jsonBlock[1].trim() : t;
}

/** Normaliza filesToModify del estado (puede ser string[] legacy) a TheForgeFileToModify[]. */
export function normalizeFilesToModify(
  raw: LegacyFlowState["filesToModify"],
  defaultRepoId: string,
): TheForgeFileToModify[] {
  if (!raw?.length) return [];
  return raw.map((f) =>
    typeof f === "string" ? { path: f, repoId: defaultRepoId } : { path: f.path, repoId: f.repoId ?? "" },
  );
}
