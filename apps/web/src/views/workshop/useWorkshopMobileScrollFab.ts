import { useCallback, useEffect, useState, type RefObject } from "react";
import { findVerticalScrollHost } from "./workshopScroll.util";
import type { WorkshopMobileColumn } from "./workshopMetricsColumn.types";

export interface UseWorkshopMobileScrollFabArgs {
  isLgLayout: boolean;
  mobileWorkshopColumn: WorkshopMobileColumn;
  centralPanel: string;
  workspaceScrollRef: RefObject<HTMLDivElement | null>;
  chatSectionRef: RefObject<HTMLElement | null>;
  metricsSectionRef: RefObject<HTMLElement | null>;
}

export interface UseWorkshopMobileScrollFabResult {
  mobileScrollFabScrollable: boolean;
  scrollFabDirection: "down" | "up";
  getActiveScrollContainer: () => HTMLElement | null;
}

/** Tracks mobile scroll FAB visibility and direction for the active workshop column. */
export function useWorkshopMobileScrollFab({
  isLgLayout,
  mobileWorkshopColumn,
  centralPanel,
  workspaceScrollRef,
  chatSectionRef,
  metricsSectionRef,
}: UseWorkshopMobileScrollFabArgs): UseWorkshopMobileScrollFabResult {
  const [scrollFabDirection, setScrollFabDirection] = useState<"down" | "up">("down");
  const [mobileScrollFabScrollable, setMobileScrollFabScrollable] = useState(false);

  const getActiveScrollContainer = useCallback((): HTMLElement | null => {
    if (mobileWorkshopColumn === "workspace") return findVerticalScrollHost(workspaceScrollRef.current);
    if (mobileWorkshopColumn === "chat") return findVerticalScrollHost(chatSectionRef.current);
    if (mobileWorkshopColumn === "metrics") return findVerticalScrollHost(metricsSectionRef.current);
    return null;
  }, [mobileWorkshopColumn, workspaceScrollRef, chatSectionRef, metricsSectionRef]);

  useEffect(() => {
    if (isLgLayout) {
      setMobileScrollFabScrollable(false);
      setScrollFabDirection("down");
      return;
    }

    let detached = false;
    let rafId = 0;
    let retryTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let container: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const update = () => {
      if (detached) return;
      const c = getActiveScrollContainer();
      if (!c) {
        setMobileScrollFabScrollable(false);
        setScrollFabDirection("down");
        return;
      }
      const scrollable = c.scrollHeight > c.clientHeight + 1;
      setMobileScrollFabScrollable(scrollable);
      if (scrollable) {
        const atBottom = c.scrollTop + c.clientHeight >= c.scrollHeight - 20;
        setScrollFabDirection(atBottom ? "up" : "down");
      } else {
        setScrollFabDirection("down");
      }
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    function cleanupContainer() {
      window.removeEventListener("resize", scheduleUpdate);
      if (!container) return;
      container.removeEventListener("scroll", scheduleUpdate);
      ro?.disconnect();
      ro = null;
      mo?.disconnect();
      mo = null;
      container = null;
    }

    function bindToCurrent(): boolean {
      cleanupContainer();
      const c = getActiveScrollContainer();
      if (!c) {
        setMobileScrollFabScrollable(false);
        setScrollFabDirection("down");
        return false;
      }
      container = c;
      scheduleUpdate();
      c.addEventListener("scroll", scheduleUpdate, { passive: true });
      window.addEventListener("resize", scheduleUpdate, { passive: true });
      ro = new ResizeObserver(scheduleUpdate);
      ro.observe(c);
      for (const ch of Array.from(c.children)) {
        if (ch instanceof HTMLElement) ro.observe(ch);
      }
      mo = new MutationObserver(scheduleUpdate);
      mo.observe(c, { childList: true, subtree: true, characterData: true });
      return true;
    }

    function tryBind(attempt: number) {
      if (detached) return;
      if (bindToCurrent()) return;
      if (attempt > 30) return;
      if (retryTimer !== null) globalThis.clearTimeout(retryTimer);
      retryTimer = globalThis.setTimeout(() => tryBind(attempt + 1), 50);
    }

    tryBind(0);

    return () => {
      detached = true;
      cancelAnimationFrame(rafId);
      if (retryTimer !== null) globalThis.clearTimeout(retryTimer);
      cleanupContainer();
    };
  }, [isLgLayout, mobileWorkshopColumn, getActiveScrollContainer, centralPanel]);

  return { mobileScrollFabScrollable, scrollFabDirection, getActiveScrollContainer };
}
