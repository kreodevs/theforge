/** Desktop workshop: chat column width (px). Below min on resize release, panel collapses to rail. */
export const LG_CHAT_PANEL_WIDTH_MIN_PX = 260;
export const LG_CHAT_PANEL_WIDTH_MAX_PX = 420;
export const LG_CHAT_PANEL_DEFAULT_PX = 320;

export function clampLgChatPanelWidthPx(value: number): number {
  if (!Number.isFinite(value)) return LG_CHAT_PANEL_DEFAULT_PX;
  return Math.min(
    LG_CHAT_PANEL_WIDTH_MAX_PX,
    Math.max(LG_CHAT_PANEL_WIDTH_MIN_PX, Math.round(value)),
  );
}
