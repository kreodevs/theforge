import { useEffect, useRef, useState } from "react";
import type { ProjectGenerationDashboardSummary } from "@theforge/shared-types";
import { API_BASE, apiFetch } from "@/utils/apiClient";

const POLL_BUSY_MS = 5_000;
const POLL_IDLE_MS = 30_000;

function summariesEqual(
  a: Record<string, ProjectGenerationDashboardSummary>,
  b: Record<string, ProjectGenerationDashboardSummary>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    const left = a[key];
    const right = b[key];
    if (left === undefined || right === undefined) return false;
    if (left.busy !== right.busy || left.label !== right.label) return false;
  }
  return true;
}

/**
 * Polls generation summary for visible dashboard projects (MDD / entregables en cola).
 * Escaneo batch en API; intervalo corto solo mientras haya jobs activos.
 */
export function useDashboardGenerationSummary(
  projectIds: string[],
  enabled: boolean,
): Record<string, ProjectGenerationDashboardSummary> {
  const [summaries, setSummaries] = useState<Record<string, ProjectGenerationDashboardSummary>>({});
  const idsKey = projectIds.join(",");
  const projectIdsRef = useRef(projectIds);
  projectIdsRef.current = projectIds;

  useEffect(() => {
    if (!enabled || projectIds.length === 0) {
      setSummaries({});
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const schedule = (delayMs: number) => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void fetchSummaries();
      }, delayMs);
    };

    const fetchSummaries = async () => {
      if (cancelled || document.visibilityState === "hidden") {
        schedule(POLL_IDLE_MS);
        return;
      }
      const ids = projectIdsRef.current;
      if (ids.length === 0) return;

      const qs = new URLSearchParams({ ids: ids.join(",") });
      const r = await apiFetch(`${API_BASE}/projects/generation-summary?${qs}`);
      if (!r.ok || cancelled) {
        schedule(POLL_IDLE_MS);
        return;
      }
      const data = (await r.json()) as Record<string, ProjectGenerationDashboardSummary>;
      if (cancelled) return;

      setSummaries((prev) => (summariesEqual(prev, data) ? prev : data));
      const anyBusy = Object.values(data).some((entry) => entry.busy);
      schedule(anyBusy ? POLL_BUSY_MS : POLL_IDLE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchSummaries();
    };

    document.addEventListener("visibilitychange", onVisibility);
    void fetchSummaries();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, idsKey]);

  return summaries;
}
