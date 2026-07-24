/**
 * @fileoverview AsyncLocalStorage que propaga el contexto de telemetría de tokens
 * (projectId, stageId, documentField, context, node, jobId) a través de las llamadas
 * LLM asíncronas. Los adapters consumen este contexto en cada llamada para registrar
 * consumo sin inflar las firmas.
 *
 * Patrón: en cada punto de entrada (controller, MDD pipeline, generator de cascada)
 * se llama `runWithTokenUsageContext(ctx, fn)` y dentro de `fn` los adapters ya
 * pueden leer el contexto de fondo.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface TokenUsageContextPayload {
  projectId: string;
  stageId?: string | null;
  documentField: string;
  context: string;
  node?: string | null;
  jobId?: string | null;
}

export interface TokenUsageContextValue {
  payload: TokenUsageContextPayload;
}

const storage = new AsyncLocalStorage<TokenUsageContextValue>();

export function runWithTokenUsageContext<T>(
  payload: TokenUsageContextPayload,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return storage.run({ payload }, fn) as T | Promise<T>;
}

export function getActiveTokenUsageContext(): TokenUsageContextPayload | null {
  return storage.getStore()?.payload ?? null;
}

/**
 * Patch parcial del contexto activo (ej. cuando entramos en una fase del pipeline
 * que debemos atribuir a un nodo concreto). Si no hay contexto activo, es un no-op.
 */
export function withTokenUsageContextPatch<T>(
  patch: Partial<TokenUsageContextPayload>,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  const current = storage.getStore();
  if (!current) return fn();
  return storage.run(
    { payload: { ...current.payload, ...patch } },
    fn,
  ) as T | Promise<T>;
}
