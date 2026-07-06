/**
 * Panel de cambios de documentación pendientes de aprobación humana (HITL).
 */
import { useCallback, useEffect, useState } from "react";
import { Check, FileWarning, Loader2, RefreshCw, X } from "lucide-react";
import type { DocumentationGapResponse, MddDeliveryGateResult } from "@theforge/shared-types";
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
  /** Compact chrome for the workshop sidebar. */
  variant?: "default" | "sidebar" | "workspace";
  /** Notifica el conteo tras cada carga (p. ej. badge en el sidebar). */
  onGapsCountChange?: (count: number) => void;
  /** Incrementar para forzar recarga (p. ej. tras cascada de entregables). */
  refreshToken?: number;
}

export function PendingDocumentationGapsPanel({
  projectId,
  stageId,
  className,
  onResolved,
  variant = "default",
  onGapsCountChange,
  refreshToken,
}: PendingDocumentationGapsPanelProps) {
  const [gaps, setGaps] = useState<DocumentationGapResponse[]>([]);
  const [mddDeliveryGate, setMddDeliveryGate] = useState<MddDeliveryGateResult | null>(null);
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
      const data = (await r.json()) as {
        gaps: DocumentationGapResponse[];
        mddDeliveryGate?: MddDeliveryGateResult | null;
      };
      const nextGaps = data.gaps ?? [];
      setGaps(nextGaps);
      setMddDeliveryGate(data.mddDeliveryGate ?? null);
      onGapsCountChange?.(nextGaps.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar cambios pendientes");
    } finally {
      setLoading(false);
    }
  }, [projectId, stageId, onGapsCountChange]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending, refreshToken]);

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

  const isSidebar = variant === "sidebar";
  const isWorkspace = variant === "workspace";
  const showPanelHeader = !isSidebar && !isWorkspace;

  return (
    <section
      className={cn(
        isSidebar
          ? "rounded-lg border border-[color-mix(in_oklch,var(--sidebar-border)_80%,transparent)] bg-[color-mix(in_oklch,var(--sidebar-foreground)_4%,var(--sidebar))] p-2.5 space-y-2"
          : isWorkspace
            ? "space-y-3"
            : "rounded-xl border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_6%,var(--card))] p-4 space-y-3",
        className,
      )}
      aria-label="Cambios pendientes de documentación"
    >
      {showPanelHeader ? (
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
      ) : isSidebar ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => void fetchPending()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-[color-mix(in_oklch,var(--muted-foreground)_96%,var(--sidebar-foreground))] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_55%,transparent)] disabled:opacity-50"
            title="Actualizar cambios pendientes"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span className="sr-only">Actualizar</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => void fetchPending()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[color-mix(in_oklch,var(--foreground-subtle)_90%,var(--foreground))] hover:bg-[color-mix(in_oklch,var(--muted)_40%,transparent)] disabled:opacity-50"
            title="Actualizar cambios pendientes"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="sr-only">Actualizar</span>
          </button>
        </div>
      )}
      <p
        className={cn(
          "text-[color-mix(in_oklch,var(--foreground-subtle)_85%,var(--background))]",
          isSidebar ? "text-[10px] leading-snug" : "text-xs",
        )}
      >
        Los agentes reportan discrepancias entre código implementado y SDD durante la ejecución en el
        repo destino. Tras generar entregables, los conflictos SDD internos (ORM, colas, JWT, etc.)
        aparecen aquí para que decidas si reconciliar.
      </p>
      {mddDeliveryGate && !mddDeliveryGate.ok && mddDeliveryGate.blockers.length > 0 ? (
        <div
          className={cn(
            "rounded-md border border-[color-mix(in_oklch,var(--destructive)_35%,var(--border))] bg-[color-mix(in_oklch,var(--destructive)_8%,var(--card))] space-y-1",
            isSidebar ? "p-2" : "p-3",
          )}
          role="alert"
        >
          <p
            className={cn(
              "font-semibold text-[color-mix(in_oklch,var(--destructive)_85%,var(--foreground))]",
              isSidebar ? "text-[10px]" : "text-xs",
            )}
          >
            Gate MDD bloqueado ({mddDeliveryGate.score}/100)
          </p>
          <ul
            className={cn(
              "list-disc pl-4 text-[color-mix(in_oklch,var(--foreground-subtle)_90%,var(--foreground))]",
              isSidebar ? "text-[10px] space-y-0.5" : "text-xs space-y-1",
            )}
          >
            {mddDeliveryGate.blockers.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
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
        <ul className={cn("space-y-3 overflow-y-auto", isSidebar ? "max-h-48 space-y-2" : isWorkspace ? "max-h-none" : "max-h-80")}>
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
