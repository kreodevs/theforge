import type { LlmOutputTokenPurpose } from "./config/llm-config.js";
import { resolveLlmMaxTokensForPurpose } from "./config/llm-config.js";
import type { ChatIntent } from "./intent-classifier.service.js";
import {
  actionFromChatIntent,
  type WorkshopChatAction,
} from "./intent-route.types.js";

/** Tier de modelo en instancia BYOK: C=chat, B=grafo, A=arquitecto. */
export type LlmModelTier = "C" | "B" | "A";

const WORKSHOP_DOCUMENT_TABS = new Set([
  "mdd",
  "benchmark",
  "spec",
  "brd",
  "blueprint",
  "api-contracts",
  "logic-flows",
  "architecture",
  "use-cases",
  "user-stories",
  "tasks",
  "infra",
  "phase0",
]);

export interface ResolveModelByIntentInput {
  intent?: ChatIntent;
  action?: WorkshopChatAction;
  activeTab?: string;
  welcomeBrief?: boolean;
}

export interface ResolvedModelByIntent {
  tier: LlmModelTier;
  purpose: LlmOutputTokenPurpose;
  maxTokens: number;
}

function effectiveAction(intent: ChatIntent, action?: WorkshopChatAction): WorkshopChatAction {
  return action ?? actionFromChatIntent(intent);
}

function isExplorationMode(intent: ChatIntent, action: WorkshopChatAction): boolean {
  return intent === "explore" || action === "chat_only";
}

function isConfirmationMode(intent: ChatIntent, action: WorkshopChatAction): boolean {
  return intent === "mixed" || action === "confirm_then_edit";
}

/**
 * Resuelve tier (C/B/A) y perfil de salida según intención del Workshop.
 * Chat explore y MDD direct_edit usan tier C + perfil chat (8K), no document (32K).
 */
export function resolveModelByIntent(input: ResolveModelByIntentInput = {}): ResolvedModelByIntent {
  const intent = input.intent ?? "mixed";
  const action = effectiveAction(intent, input.action);
  const tab = input.activeTab?.trim();

  if (input.welcomeBrief) {
    const purpose: LlmOutputTokenPurpose = "welcome";
    return { tier: "C", purpose, maxTokens: resolveLlmMaxTokensForPurpose(purpose) };
  }

  if (isExplorationMode(intent, action) || isConfirmationMode(intent, action)) {
    const purpose: LlmOutputTokenPurpose = "chat";
    return { tier: "C", purpose, maxTokens: resolveLlmMaxTokensForPurpose(purpose) };
  }

  // direct_edit / edit_document
  if (tab === "mdd") {
    const purpose: LlmOutputTokenPurpose = "chat";
    return { tier: "C", purpose, maxTokens: resolveLlmMaxTokensForPurpose(purpose) };
  }

  if (tab === "ux-ui-guide") {
    const purpose: LlmOutputTokenPurpose = "uxGuide";
    return { tier: "B", purpose, maxTokens: resolveLlmMaxTokensForPurpose(purpose) };
  }

  if (tab && WORKSHOP_DOCUMENT_TABS.has(tab)) {
    const purpose: LlmOutputTokenPurpose = "document";
    return { tier: "B", purpose, maxTokens: resolveLlmMaxTokensForPurpose(purpose) };
  }

  const purpose: LlmOutputTokenPurpose = "chat";
  return { tier: "C", purpose, maxTokens: resolveLlmMaxTokensForPurpose(purpose) };
}
