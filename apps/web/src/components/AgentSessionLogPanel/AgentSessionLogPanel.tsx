/**
 * Panel de timeline de sesión agéntica (gaps MCP, reconciliaciones).
 */
import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, RefreshCw } from "lucide-react";
import type { AgentSessionLogEntry } from "@theforge/shared-types";
import { cn } from "@/lib/utils";
import { apiFetch, API_BASE } from "@/utils/apiClient";

const KIND_LABELS: Record<string, string> = {
  GAP_REPORTED: "Gap reportado",
  RECONCILE_QUEUED: "Reconciliación encolada",
  ARTIFACT_UPDATED: "Artefacto actualizado",
  RECONCILE_REJECTED: "Reconciliación rechazada",
};

const KIND_STYLES: Record<string, string> = {
  GAP_REPORTED: "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[color-mix(in_oklch,var(--primary)_80%,var(--foreground))]",
  RECONCILE_QUEUED: "bg-[color-mix(in_oklch,var(--warning)_12%,transparent)] text-[color-mix(in_oklch,var(--warning)_80%,var(--foreground))]",
  ARTIFACT_UPDATED: "bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-[color-mix(in_oklch,var(--success)_85%,var(--foreground))]",
  RECONCILE_REJECTED: "bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-[color-mix(in_oklch,var(--destructive)_85%,var(--foreground))]",
};

export interface AgentSessionLogPanelProps {
  projectId: string;
  stageId: string | null | undefined;
  className?: string;
}

export function AgentSessionLogPanel({ projectId, stageId, className }: AgentSessionLogPanelProps) {
  const [entries, setEntries] = useState<AgentSessionLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLog = useCallback(async () => {
    if (!projectId || !stageId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch(
        `${API_BASE}/projects/${projectId}/stages/${stageId}/agent-session-log?limit=50`,
      );
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { entries: AgentSessionLogEntry[] };
      setEntries(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar log");
    } finally {
      setLoading(false);
    }
  }, [projectId, stageId]);

  useEffect(() => {
    void fetchLog();
  }, [fetchLog]);

  if (!stageId) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_78%,var(--background))] p-4 space-y-3",
        className,
      )}
      aria-label="Sesión agéntica"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-4 w-4 shrink-0 text-[color-mix(in_oklch,var(--primary)_70%,var(--foreground))]" aria-hidden />
          <h3 className="text-sm font-semibold truncate">Sesión agéntica</h3>
        </div>
        <button
          type="button"
          onClick={() => void fetchLog()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_90%,var(--foreground))] hover:bg-[color-mix(in_oklch,var(--muted)_40%,transparent)] disabled:opacity-50"
          title="Actualizar"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]">
        Gaps de documentación reportados vía MCP y reconciliaciones (separado del chat Workshop). Los pendientes de
        aprobación aparecen en el panel «Cambios pendientes».
      </p>
      {error ? (
        <p className="text-xs text-[color-mix(in_oklch,var(--destructive)_85%,var(--foreground))]" role="alert">
          {error}
        </p>
      ) : null}
      {loading && entries.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando…
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]">
          Sin eventos aún. Los agentes reportan gaps con MCP <code className="text-[10px]">report_documentation_gap</code>.
        </p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-[color-mix(in_oklch,var(--border)_80%,transparent)] px-3 py-2 text-xs space-y-1"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                    KIND_STYLES[entry.kind] ?? KIND_STYLES.GAP_REPORTED,
                  )}
                >
                  {KIND_LABELS[entry.kind] ?? entry.kind}
                </span>
                <time className="text-[10px] text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]">
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="text-[color-mix(in_oklch,var(--foreground)_88%,var(--muted-foreground))] leading-snug">
                {entry.summary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
