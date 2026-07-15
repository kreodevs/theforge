import { HttpException } from "@nestjs/common";
import type { MddDeliveryGateResult } from "@theforge/shared-types";
import {
  type DocPersistFlags,
  shouldWarnOrchestratorDocNotPersisted,
} from "../sessions/orchestrator-doc-guard.util.js";

export type OrchestratorDocumentPersist = {
  tab: string;
  parsedFromResponse: boolean;
  saved: boolean;
  reason?: string;
  deliveryGate?: MddDeliveryGateResult;
  hint?: string;
};

export const MISSING_FIN_MDD_DELIMITER = "MISSING_FIN_MDD_DELIMITER";

export const MISSING_FIN_MDD_HINT =
  "Para persistir cambios en el MDD, el asistente debe devolver el markdown completo seguido de la línea exacta ---FIN_MDD---.";

export function extractMddPersistErrorFromException(err: unknown): {
  code?: string;
  message: string;
  deliveryGate?: MddDeliveryGateResult;
} {
  if (!(err instanceof HttpException)) {
    return { message: err instanceof Error ? err.message : String(err) };
  }
  const response = err.getResponse();
  if (typeof response !== "object" || response === null) {
    return { message: err.message };
  }
  const body = response as Record<string, unknown>;
  const payload = body.message;
  const structured =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : body;
  const code = typeof structured.code === "string" ? structured.code : undefined;
  const message =
    typeof structured.message === "string"
      ? structured.message
      : typeof payload === "string"
        ? payload
        : err.message;
  const deliveryGate =
    structured.deliveryGate && typeof structured.deliveryGate === "object"
      ? (structured.deliveryGate as MddDeliveryGateResult)
      : undefined;
  return { code, message, deliveryGate };
}

export function shouldReportMissingMddDelimiter(params: {
  userMessage: string;
  assistantContent: string;
  flags: DocPersistFlags;
  currentMddLen: number;
}): boolean {
  return shouldWarnOrchestratorDocNotPersisted({
    tab: "mdd",
    userMessage: params.userMessage,
    assistantContent: params.assistantContent,
    flags: params.flags,
    currentDocLen: params.currentMddLen,
  });
}

export function buildMddDocumentPersistStatus(params: {
  parsedFromResponse: boolean;
  saved: boolean;
  reason?: string;
  deliveryGate?: MddDeliveryGateResult;
  hint?: string;
}): OrchestratorDocumentPersist {
  return {
    tab: "mdd",
    parsedFromResponse: params.parsedFromResponse,
    saved: params.saved,
    ...(params.reason ? { reason: params.reason } : {}),
    ...(params.deliveryGate ? { deliveryGate: params.deliveryGate } : {}),
    ...(params.hint ? { hint: params.hint } : {}),
  };
}
