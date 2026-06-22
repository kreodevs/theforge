import { useLayoutEffect, type RefObject } from "react";

type UseAutosizeTextareaOptions = {
  minHeightPx?: number;
  /** Space reserved below the textarea (buttons, padding, floating TOC). */
  bottomReservePx?: number;
};

/**
 * Grows a textarea with its content up to the remaining viewport height, then scrolls internally.
 */
export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  options: UseAutosizeTextareaOptions = {},
): void {
  const minHeightPx = options.minHeightPx ?? 100;
  const bottomReservePx = options.bottomReservePx ?? 120;

  useLayoutEffect(() => {
    function syncHeight() {
      const el = ref.current;
      if (!el) return;

      const viewportMax = Math.max(
        minHeightPx,
        window.innerHeight - el.getBoundingClientRect().top - bottomReservePx,
      );

      el.style.maxHeight = `${viewportMax}px`;
      el.style.height = "0px";
      const scrollH = el.scrollHeight;
      const contentMin = value.trim().length === 0 ? minHeightPx : minHeightPx;
      const next = Math.max(contentMin, Math.min(scrollH, viewportMax));
      el.style.height = `${next}px`;
      el.style.overflowY = scrollH > viewportMax ? "auto" : "hidden";
    }

    syncHeight();

    let resizeRaf = 0;
    function handleResize() {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(syncHeight);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(resizeRaf);
    };
  }, [ref, value, minHeightPx, bottomReservePx]);
}
