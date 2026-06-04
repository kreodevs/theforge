import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, apiFetch, getAccessToken } from "@/utils/apiClient";
import type { ComponentSourceRegenerationStep } from "@/types/component-source-profiles";

interface RegenerationEventPayload {
  type?: string;
  step?: number;
  totalSteps?: number;
  label?: string;
  status?: "running" | "done" | "error";
  detail?: string;
  durationMs?: number;
  message?: string;
  projectId?: string;
  profileId?: string;
}

import { MCP_DS_IMPORT_LABEL } from "@/constants/wireframe-progress-labels";

/**
 * Optimistic first step shown immediately after profile PUT (before SSE replay).
 * `totalSteps` stays minimal until the stream reports the real count (1 DS + N wireframe sub-steps).
 */
export const MCP_REGENERATION_OPTIMISTIC_STEP: ComponentSourceRegenerationStep = {
  step: 1,
  totalSteps: 1,
  label: MCP_DS_IMPORT_LABEL,
  status: "running",
};

/** User-scoped NDJSON stream — backend: GET /auth/component-source/regeneration/events */
function buildStreamUrl(): string {
  return `${API_BASE}/auth/component-source/regeneration/events`;
}

/**
 * Subscribes to MCP profile change regeneration job events (NDJSON stream).
 * Reconnects when `projectId` changes (e.g. after owner confirms a new profile).
 */
export function useComponentSourceRegenerationEvents(
  projectIdOrEnabled?: string | null | boolean,
  maybeEnabled?: boolean,
) {
  const projectId =
    typeof projectIdOrEnabled === "boolean" || projectIdOrEnabled == null
      ? undefined
      : projectIdOrEnabled;
  const enabled =
    typeof projectIdOrEnabled === "boolean"
      ? projectIdOrEnabled
      : (maybeEnabled ?? true);

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [progress, setProgress] = useState<ComponentSourceRegenerationStep | null>(null);
  const [stepsHistory, setStepsHistory] = useState<ComponentSourceRegenerationStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [streamGeneration, setStreamGeneration] = useState(0);

  const reset = useCallback(() => {
    setIsRegenerating(false);
    setProgress(null);
    setStepsHistory([]);
    setError(null);
  }, []);

  /** Show progress UI immediately (profile change confirmed, before/at SSE reconnect). */
  const beginRegeneration = useCallback(() => {
    setError(null);
    setIsRegenerating(true);
    setProgress(MCP_REGENERATION_OPTIMISTIC_STEP);
    setStepsHistory([]);
  }, []);

  /** Re-open SSE without clearing visible progress (avoids race after profile PUT). */
  const reconnect = useCallback(() => {
    setStreamGeneration((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !getAccessToken()) return;

    const controller = new AbortController();
    abortRef.current = controller;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      setIsRegenerating(false);
      setProgress(null);
    };

    void (async () => {
      try {
        const res = await apiFetch(buildStreamUrl(), { signal: controller.signal });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const scopedProjectId = projectId?.trim() || null;

        const handleEvent = (ev: RegenerationEventPayload) => {
          if (
            scopedProjectId &&
            ev.projectId &&
            ev.projectId !== scopedProjectId
          ) {
            return;
          }
          if (ev.type === "progress" && ev.step != null && ev.totalSteps != null && ev.label && ev.status) {
            setIsRegenerating(true);
            const entry: ComponentSourceRegenerationStep = {
              step: ev.step,
              totalSteps: ev.totalSteps,
              label: ev.label,
              status: ev.status,
              detail: ev.detail,
              durationMs: ev.durationMs,
            };
            setProgress(entry);
            setStepsHistory((prev) => {
              const idx = prev.findIndex((s) => s.step === ev.step);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = entry;
                return next;
              }
              return [...prev, entry];
            });
          } else if (ev.type === "done") {
            finish();
          } else if (ev.type === "error") {
            setError(ev.message ?? "Error en regeneración MCP");
            finish();
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              handleEvent(JSON.parse(trimmed) as RegenerationEventPayload);
            } catch {
              /* ignore partial lines */
            }
          }
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        void e;
      }
    })();

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [enabled, projectId, streamGeneration]);

  const isActive = isRegenerating || stepsHistory.length > 0 || Boolean(error);

  return {
    isRegenerating,
    isActive,
    progress,
    stepsHistory,
    error,
    reset,
    beginRegeneration,
    reconnect,
  };
}
