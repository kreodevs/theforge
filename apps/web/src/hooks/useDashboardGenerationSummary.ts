import { useEffect, useState } from "react";
import type { ProjectGenerationDashboardSummary } from "@theforge/shared-types";
import { API_BASE, apiFetch } from "@/utils/apiClient";

const POLL_MS = 5000;

/**
 * Polls generation summary for visible dashboard projects (MDD / entregables en cola).
 */
export function useDashboardGenerationSummary(
  projectIds: string[],
  enabled: boolean,
): Record<string, ProjectGenerationDashboardSummary> {
  const [summaries, setSummaries] = useState<Record<string, ProjectGenerationDashboardSummary>>({});
  const idsKey = projectIds.join(",");

  useEffect(() => {
    if (!enabled || projectIds.length === 0) {
      setSummaries({});
      return;
    }

    let cancelled = false;

    const fetchSummaries = async () => {
      const qs = new URLSearchParams({ ids: projectIds.join(",") });
      const r = await apiFetch(`${API_BASE}/projects/generation-summary?${qs}`);
      if (!r.ok || cancelled) return;
      const data = (await r.json()) as Record<string, ProjectGenerationDashboardSummary>;
      if (!cancelled) setSummaries(data);
    };

    void fetchSummaries();
    const timer = window.setInterval(() => {
      void fetchSummaries();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, idsKey]);

  return summaries;
}
