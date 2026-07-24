/**
 * @fileoverview Helper transversal que consume el `TokenUsageContext` activo y
 * persiste un evento de uso si hay un LlmUsageService disponible vía global.
 *
 * El servicio no se inyecta directamente (rompería adapters sin DI); se recupera
 * del `globalThis` si fue publicado. El publicador es `TokenUsageService` que se
 * auto-registra en su `onModuleInit` (NestJS).
 *
 * Esto evita acoplar adapters a NestJS DI y permite invocarlos desde sitios
 * puramente síncronos (scripts, tests).
 */

import { getActiveTokenUsageContext } from "../../ai-analysis/token-usage/token-usage.context.js";

interface Recorder {
  recordAsync(event: {
    projectId: string;
    stageId?: string | null;
    documentField: string;
    context: string;
    node?: string | null;
    providerId: string;
    modelId: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    jobId?: string | null;
  }): void;
}

const GLOBAL_KEY = "__theforgeTokenUsageRecorder";

export function registerTokenUsageRecorder(recorder: Recorder): void {
  (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY] = recorder;
}

function getRecorder(): Recorder | null {
  const value = (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY];
  return (value as Recorder | undefined) ?? null;
}

export function recordTokenUsageFromContext(
  providerId: string,
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  overrides?: {
    documentField?: string;
    context?: string;
    node?: string | null;
  },
): void {
  const ctx = getActiveTokenUsageContext();
  if (!ctx) return;
  const recorder = getRecorder();
  if (!recorder) return;
  recorder.recordAsync({
    projectId: ctx.projectId,
    stageId: ctx.stageId ?? null,
    documentField: overrides?.documentField ?? ctx.documentField,
    context: overrides?.context ?? ctx.context,
    node: overrides?.node !== undefined ? overrides.node : ctx.node ?? null,
    providerId,
    modelId,
    promptTokens,
    completionTokens,
    totalTokens,
    jobId: ctx.jobId ?? null,
  });
}
