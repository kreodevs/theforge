/**
 * Panel de cambios de documentación pendientes de aprobación humana (HITL).
 */
import { useCallback, useEffect, useState } from "react";
import { Check, FileWarning, Loader2, RefreshCw, X } from "lucide-react";
import type { DocumentationGapResponse } from "@theforge/shared-types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { apiFetch, API_BASE } from "@/utils/apiClient";

const ARTIFACT_LABELS: Record<string, string> = {
  mdd: "MDD",
  spec: "Spec",
  architecture: "Arquitectura",
  blueprint: "Blueprint",
  useCases: "Casos de uso",
  userStories: "Historias de usuario",
  tasks: "Tareas",
  apiContracts: "Contratos API",
  logicFlows: "Flujos lógicos",
  infra: "Infraestructura",
  uxUiGuide: "Guía UX/UI",
  agentGovernance: "Gobernanza agentes",
};

export interface PendingDocumentationGapsPanelProps {
  projectId: string;
  stageId: string | null | undefined;
  className?: string;
  /** Tras aprobar/rechazar con éxito (p. ej. refrescar proyecto). */
  onResolved?: () => void;
}

export function PendingDocumentationGapsPanel({
  projectId,
  stageId,
  className,
  onResolved,
}: PendingDocumentationGapsPanelProps) {
  const [gaps, setGaps] = useState<DocumentationGapResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!projectId || !stageId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch(
        `${API_BASE}/projects/${projectId}/stages/${stageId}/documentation-gaps?status=pending`,
      );
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { gaps: DocumentationGapResponse[] };
      setGaps(data.gaps ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar cambios pendientes");
    } finally {
      setLoading(false);
    }
  }, [projectId, stageId]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const handleApprove = useCallback(
    async (gapId: string) => {
      if (!projectId || !stageId) return;
      setActingId(gapId);
      setError(null);
      try {
        const r = await apiFetch(
          `${API_BASE}/projects/${projectId}/stages/${stageId}/documentation-gaps/${gapId}/approve`,
          { method: "POST" },
        );
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(text || `HTTP ${r.status}`);
        }
        await fetchPending();
        onResolved?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al aprobar el cambio");
      } finally {
        setActingId(null);
      }
    },
    [projectId, stageId, fetchPending, onResolved],
  );

  const handleReject = useCallback(
    async (gap: DocumentationGapResponse) => {
      if (!projectId || !stageId) return;
      const reason = window.prompt(
        "Motivo del rechazo (opcional):",
        "",
      );
      if (reason === null) return;

      setActingId(gap.id);
      setError(null);
      try {
        const r = await apiFetch(
          `${API_BASE}/projects/${projectId}/stages/${stageId}/documentation-gaps/${gap.id}/reject`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason.trim() || undefined }),
          },
        );
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(text || `HTTP ${r.status}`);
        }
        await fetchPending();
        onResolved?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al rechazar el cambio");
      } finally {
        setActingId(null);
      }
    },
    [projectId, stageId, fetchPending, onResolved],
  );

  if (!stageId) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_6%,var(--card))] p-4 space-y-3",
        className,
      )}
      aria-label="Cambios pendientes de documentación"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileWarning
            className="h-4 w-4 shrink-0 text-[color-mix(in_oklch,var(--warning)_75%,var(--foreground))]"
            aria-hidden
          />
          <h3 className="text-sm font-semibold truncate">Cambios pendientes</h3>
          {gaps.length > 0 ? (
            <span className="inline-flex rounded-full bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color-mix(in_oklch,var(--warning)_85%,var(--foreground))]">
              {gaps.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void fetchPending()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_90%,var(--foreground))] hover:bg-[color-mix(in_oklch,var(--muted)_40%,transparent)] disabled:opacity-50"
          title="Actualizar"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]">
        Los agentes reportan discrepancias entre código y SDD. Revisa la descripción y acepta o rechaza antes de
        actualizar los artefactos.
      </p>
      {error ? (
        <p className="text-xs text-[color-mix(in_oklch,var(--destructive)_85%,var(--foreground))]" role="alert">
          {error}
        </p>
      ) : null}
      {loading && gaps.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando…
        </div>
      ) : gaps.length === 0 ? (
        <p className="text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]">
          No hay cambios pendientes de aprobación.
        </p>
      ) : (
        <ul className="space-y-3 max-h-80 overflow-y-auto">
          {gaps.map((gap) => {
            const busy = actingId === gap.id;
            return (
              <li
                key={gap.id}
                className="rounded-lg border border-[color-mix(in_oklch,var(--border)_80%,transparent)] bg-[color-mix(in_oklch,var(--card)_90%,var(--background))] px-3 py-3 text-xs space-y-2"
              >
                <p className="text-[color-mix(in_oklch,var(--foreground)_92%,var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">
                  {gap.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {gap.affectedArtifacts.map((artifact) => (
                    <span
                      key={artifact}
                      className="inline-flex rounded-full bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[color-mix(in_oklch,var(--primary)_80%,var(--foreground))]"
                    >
                      {ARTIFACT_LABELS[artifact] ?? artifact}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]">
                  Referencia: <span className="font-mono">{gap.evidence.reference}</span>
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={busy || actingId !== null}
                    onClick={() => void handleApprove(gap.id)}
                    className="h-7 text-xs"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Aceptar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || actingId !== null}
                    onClick={() => void handleReject(gap)}
                    className="h-7 text-xs border-[color-mix(in_oklch,var(--destructive)_40%,var(--border))] text-[color-mix(in_oklch,var(--destructive)_85%,var(--foreground))]"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Rechazar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
