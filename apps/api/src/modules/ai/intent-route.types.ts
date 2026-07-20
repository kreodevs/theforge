import { z } from "zod";
import type { ChatIntent } from "./intent-classifier.service.js";

/** Acción operativa que el Workshop ejecuta tras clasificar intención. */
export type WorkshopChatAction = "chat_only" | "edit_document" | "confirm_then_edit";

export type IntentRouteSource = "heuristic" | "llm";

export interface IntentRouteContext {
  activeTab?: string;
  /** Hay contenido de documento en el panel (p. ej. DBGA existente). */
  hasDocumentContent?: boolean;
  /** Último mensaje del asistente en el tab (confirmaciones «sí» / «aplica»). */
  lastAssistantMessage?: string;
}

export interface IntentRouteResult {
  intent: ChatIntent;
  action: WorkshopChatAction;
  confidence: number;
  source: IntentRouteSource;
  reasoning?: string;
}

export const workshopIntentLlmSchema = z.object({
  action: z.enum(["chat_only", "edit_document", "confirm_then_edit"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(600),
});

export type WorkshopIntentLlmPayload = z.infer<typeof workshopIntentLlmSchema>;

export function actionToChatIntent(action: WorkshopChatAction): ChatIntent {
  if (action === "edit_document") return "direct_edit";
  if (action === "confirm_then_edit") return "mixed";
  return "explore";
}

export function actionFromChatIntent(intent: ChatIntent): WorkshopChatAction {
  if (intent === "direct_edit") return "edit_document";
  if (intent === "mixed") return "confirm_then_edit";
  return "chat_only";
}
