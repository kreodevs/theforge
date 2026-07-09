import type { KeyboardEvent } from "react";

/**
 * On touch-primary devices Enter should insert a newline; only the send button submits.
 * Desktop keeps Enter-to-send (Shift+Enter for newline).
 */
export function shouldSubmitChatOnEnter(): boolean {
  if (typeof globalThis.matchMedia !== "function") return true;
  return !globalThis.matchMedia("(pointer: coarse)").matches;
}

export function handleChatComposerEnterKeyDown(
  e: KeyboardEvent<HTMLTextAreaElement>,
  onSubmit: () => void,
): void {
  if (e.key !== "Enter" || e.shiftKey) return;
  if (!shouldSubmitChatOnEnter()) return;
  e.preventDefault();
  onSubmit();
}
