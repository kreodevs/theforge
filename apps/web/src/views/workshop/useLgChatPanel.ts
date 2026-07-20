import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampLgChatPanelWidthPx,
  LG_CHAT_PANEL_DEFAULT_PX,
  LG_CHAT_PANEL_WIDTH_MAX_PX,
  LG_CHAT_PANEL_WIDTH_MIN_PX,
} from "./workshopChatPanel.util";

export interface UseLgChatPanelResult {
  lgWorkshopChatCollapsed: boolean;
  lgChatPanelWidthPx: number;
  lgChatPanelResizing: boolean;
  handleSetLgWorkshopChatCollapsed: (
    collapsed: boolean,
    opts?: { persistOpenWidthPx?: number },
  ) => void;
  handleLgChatResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleLgChatResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  finishLgChatResizePointer: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleLgChatResizeLostPointerCapture: () => void;
}

/** Desktop chat column collapse + resize with localStorage persistence per project. */
export function useLgChatPanel(projectId: string, isLgLayout: boolean): UseLgChatPanelResult {
  const lgChatCollapsedStorageKey = projectId
    ? `theforge:workshop:lg-chat-collapsed:${projectId}`
    : null;
  const lgChatWidthStorageKey = projectId
    ? `theforge:workshop:lg-chat-width-px:${projectId}`
    : null;

  const [lgWorkshopChatCollapsed, setLgWorkshopChatCollapsedState] = useState(false);
  const [lgChatPanelWidthPx, setLgChatPanelWidthPx] = useState(LG_CHAT_PANEL_DEFAULT_PX);
  const [lgChatPanelResizing, setLgChatPanelResizing] = useState(false);
  const lgChatResizeDragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const lgChatResizeLastPreviewRef = useRef<number>(LG_CHAT_PANEL_DEFAULT_PX);

  useEffect(() => {
    if (!projectId) return;
    try {
      const collapsed =
        lgChatCollapsedStorageKey != null &&
        globalThis.localStorage?.getItem(lgChatCollapsedStorageKey) === "1";
      let width = LG_CHAT_PANEL_DEFAULT_PX;
      const raw =
        lgChatWidthStorageKey != null ? globalThis.localStorage?.getItem(lgChatWidthStorageKey) : null;
      if (raw != null && raw !== "") {
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isNaN(parsed)) width = clampLgChatPanelWidthPx(parsed);
      }
      setLgWorkshopChatCollapsedState(collapsed);
      setLgChatPanelWidthPx(width);
    } catch {
      setLgWorkshopChatCollapsedState(false);
      setLgChatPanelWidthPx(LG_CHAT_PANEL_DEFAULT_PX);
    }
  }, [projectId, lgChatCollapsedStorageKey, lgChatWidthStorageKey]);

  const handleSetLgWorkshopChatCollapsed = useCallback(
    (collapsed: boolean, opts?: { persistOpenWidthPx?: number }) => {
      if (collapsed) {
        const toSave =
          opts?.persistOpenWidthPx != null
            ? clampLgChatPanelWidthPx(opts.persistOpenWidthPx)
            : clampLgChatPanelWidthPx(lgChatPanelWidthPx);
        try {
          if (lgChatWidthStorageKey) globalThis.localStorage?.setItem(lgChatWidthStorageKey, String(toSave));
        } catch {
          /* localStorage unavailable */
        }
      } else {
        let restore = LG_CHAT_PANEL_DEFAULT_PX;
        try {
          const raw =
            lgChatWidthStorageKey != null ? globalThis.localStorage?.getItem(lgChatWidthStorageKey) : null;
          if (raw != null && raw !== "") {
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isNaN(parsed)) restore = clampLgChatPanelWidthPx(parsed);
          }
        } catch {
          /* */
        }
        setLgChatPanelWidthPx(restore);
      }

      setLgWorkshopChatCollapsedState(collapsed);

      if (!lgChatCollapsedStorageKey) return;
      try {
        if (collapsed) globalThis.localStorage?.setItem(lgChatCollapsedStorageKey, "1");
        else globalThis.localStorage?.removeItem(lgChatCollapsedStorageKey);
      } catch {
        /* localStorage unavailable */
      }
    },
    [lgChatCollapsedStorageKey, lgChatWidthStorageKey, lgChatPanelWidthPx],
  );

  const handleLgChatResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isLgLayout || lgWorkshopChatCollapsed) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      lgChatResizeDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: lgChatPanelWidthPx,
      };
      lgChatResizeLastPreviewRef.current = lgChatPanelWidthPx;
      setLgChatPanelResizing(true);
    },
    [isLgLayout, lgWorkshopChatCollapsed, lgChatPanelWidthPx],
  );

  const handleLgChatResizePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = lgChatResizeDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const next = Math.round(drag.startWidth + (event.clientX - drag.startX));
    const preview = Math.min(LG_CHAT_PANEL_WIDTH_MAX_PX, Math.max(72, next));
    lgChatResizeLastPreviewRef.current = preview;
    setLgChatPanelWidthPx(preview);
  }, []);

  const finishLgChatResizePointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = lgChatResizeDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* not captured */
      }
      lgChatResizeDragRef.current = null;
      setLgChatPanelResizing(false);

      const raw = Math.round(drag.startWidth + (event.clientX - drag.startX));
      const preview = Math.min(LG_CHAT_PANEL_WIDTH_MAX_PX, Math.max(72, raw));

      if (preview < LG_CHAT_PANEL_WIDTH_MIN_PX) {
        handleSetLgWorkshopChatCollapsed(true, { persistOpenWidthPx: drag.startWidth });
        return;
      }

      const clamped = clampLgChatPanelWidthPx(preview);
      setLgChatPanelWidthPx(clamped);
      try {
        if (lgChatWidthStorageKey) globalThis.localStorage?.setItem(lgChatWidthStorageKey, String(clamped));
      } catch {
        /* localStorage unavailable */
      }
    },
    [handleSetLgWorkshopChatCollapsed, lgChatWidthStorageKey],
  );

  const handleLgChatResizeLostPointerCapture = useCallback(() => {
    const drag = lgChatResizeDragRef.current;
    if (!drag) return;
    const startWidthBeforeDrag = drag.startWidth;
    lgChatResizeDragRef.current = null;
    setLgChatPanelResizing(false);
    const preview = lgChatResizeLastPreviewRef.current;
    if (preview < LG_CHAT_PANEL_WIDTH_MIN_PX) {
      handleSetLgWorkshopChatCollapsed(true, { persistOpenWidthPx: startWidthBeforeDrag });
      return;
    }
    const clamped = clampLgChatPanelWidthPx(preview);
    setLgChatPanelWidthPx(clamped);
    try {
      if (lgChatWidthStorageKey) globalThis.localStorage?.setItem(lgChatWidthStorageKey, String(clamped));
    } catch {
      /* localStorage unavailable */
    }
  }, [handleSetLgWorkshopChatCollapsed, lgChatWidthStorageKey]);

  return {
    lgWorkshopChatCollapsed,
    lgChatPanelWidthPx,
    lgChatPanelResizing,
    handleSetLgWorkshopChatCollapsed,
    handleLgChatResizePointerDown,
    handleLgChatResizePointerMove,
    finishLgChatResizePointer,
    handleLgChatResizeLostPointerCapture,
  };
}
