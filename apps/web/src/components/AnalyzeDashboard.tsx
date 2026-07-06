import { useEffect, useState } from "react";
import { Loader2, BarChart3, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { SddAnalyzeReport } from "@theforge/shared-types";
import { apiFetch, API_BASE } from "@/utils/apiClient";
import { cn } from "@/lib/utils";
import {
  categorizeSddAnalyzeGap,
  SDD_GAP_CATEGORY_LABEL,
  type SddGapCategory,
} from "@/utils/sddAnalyzeGapCategory";

interface AnalyzeDashboardProps {
  projectId: string;
  className?: string;
  onReportLoaded?: (report: SddAnalyzeReport) => void;
}

const STATUS_STYLES = {
  ok: { icon: CheckCircle2, color: "text-[var(--success)]", label: "OK" },
  warnings: { icon: AlertTriangle, color: "text-[var(--warning)]", label: "Advertencias" },
  blocked: { icon: XCircle, color: "text-[var(--destructive)]", label: "Bloqueado" },
} as const;

/** Cross-artifact analyze dashboard (`/speckit.analyze` equivalent). */
export function AnalyzeDashboard({ projectId, className, onReportLoaded }: AnalyzeDashboardProps) {
  const [report, setReport] = useState<SddAnalyzeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/projects/${projectId}/analyze`);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text.slice(0, 200) || `HTTP ${r.status}`);
      }
      const loaded = (await r.json()) as SddAnalyzeReport;
      setReport(loaded);
      onReportLoaded?.(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, [projectId]);

  if (loading && !report) {
    return (
      <div className={cn("flex items-center gap-2 p-4 text-sm", className)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Analizando artefactos…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("space-y-2 p-4 text-sm text-[var(--destructive)]", className)}>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void fetchReport()}
          className="text-xs underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!report) return null;

  const statusCfg = STATUS_STYLES[report.summary.status];
  const StatusIcon = statusCfg.icon;

  const gapsByCategory = report.crossArtifactGaps.reduce<Record<SddGapCategory, string[]>>(
    (acc, gap) => {
      const cat = categorizeSddAnalyzeGap(gap);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(gap);
      return acc;
    },
    {} as Record<SddGapCategory, string[]>,
  );

  const artifactTiles = [
    ["MDD", report.artifacts.mdd.present, report.artifacts.mdd.wordCount],
    ["Spec", report.artifacts.spec.present, report.artifacts.spec.wordCount],
    ["Plan", report.artifacts.blueprint.present, report.artifacts.blueprint.wordCount],
    ["Casos", report.artifacts.useCases?.present ?? false, report.artifacts.useCases?.wordCount ?? 0],
    ["H.U.", report.artifacts.userStories?.present ?? false, report.artifacts.userStories?.wordCount ?? 0],
    ["Tasks", report.artifacts.tasks.present, report.artifacts.tasks.totalTasks],
    ["API", report.artifacts.apiContracts.present, report.artifacts.apiContracts.wordCount],
    ["Flujos", report.artifacts.logicFlows.present, report.artifacts.logicFlows.wordCount],
    ["UX", report.artifacts.uxUiGuide?.present ?? false, report.artifacts.uxUiGuide?.wordCount ?? 0],
    ["Infra", report.artifacts.infra.present, report.artifacts.infra.wordCount],
    ["Gov IA", report.artifacts.agentGovernance?.present ?? false, report.artifacts.agentGovernance?.fileCount ?? 0],
  ] as const;

  return (
    <div className={cn("space-y-4 p-4 text-sm", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
          <div>
            <p className="font-semibold">Analizar — consistencia SDD</p>
            <p className="text-xs text-[color-mix(in_oklch,var(--foreground)_85%,var(--muted-foreground))]">
              {report.featureDir} · semáforo {report.semaphore ?? "—"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchReport()}
          disabled={loading}
          className="text-xs text-[var(--primary)] underline disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] p-3">
        <StatusIcon className={cn("h-5 w-5 shrink-0", statusCfg.color)} aria-hidden />
        <div>
          <p className={cn("font-semibold", statusCfg.color)}>
            {statusCfg.label} — score {report.summary.score}
          </p>
          <p className="text-xs">{report.summary.headline}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-4">
        {artifactTiles.map(([label, ok, meta]) => (
          <div
            key={label}
            className={cn(
              "rounded-md px-2 py-1.5",
              ok
                ? "bg-[color-mix(in_oklch,var(--success)_12%,var(--card))]"
                : "bg-[color-mix(in_oklch,var(--destructive)_10%,var(--card))]",
            )}
            title={typeof meta === "number" && meta > 0 ? `${meta} ${label === "Tasks" ? "ítems" : "palabras"}` : undefined}
          >
            <span className="font-medium">{label}</span>
            <span className="ml-1 opacity-80">{ok ? "✓" : "—"}</span>
          </div>
        ))}
      </div>

      {report.phase0Bridge?.phase0Present ? (
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-xs",
            report.phase0Bridge.ok
              ? "bg-[color-mix(in_oklch,var(--success)_10%,var(--card))]"
              : "bg-[color-mix(in_oklch,var(--warning)_12%,var(--card))]",
          )}
        >
          <p className="font-semibold">Trazabilidad Phase0 → BRD / Spec</p>
          <p className="text-[color-mix(in_oklch,var(--foreground)_88%,var(--muted-foreground))]">
            {report.phase0Bridge.ok
              ? "Conceptos de Paso 0 reflejados en BRD y Spec."
              : `${report.phase0Bridge.gapCount} brecha(s) entre borrador Phase0 y documentos downstream.`}
          </p>
        </div>
      ) : null}

      {report.artifacts.agentGovernance ? (
        <div className="rounded-lg border border-[var(--border)] p-3 text-xs">
          <p className="mb-1 font-semibold">Gobernanza IA</p>
          <p>
            Archivos: {report.artifacts.agentGovernance.fileCount}
            {report.artifacts.agentGovernance.pathAlignmentOk ? (
              <span className="ml-2 text-[var(--success)]">· espejos docs/sdd OK</span>
            ) : (
              <span className="ml-2 text-[var(--warning)]">· espejos incompletos</span>
            )}
          </p>
          {report.artifacts.agentGovernance.missingRequiredPaths.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-[var(--warning)]">
              {report.artifacts.agentGovernance.missingRequiredPaths.slice(0, 5).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {report.artifacts.tasks.present ? (
        <p className="text-xs text-[color-mix(in_oklch,var(--foreground)_90%,var(--muted-foreground))]">
          Tasks: {report.artifacts.tasks.openTasks} abiertas / {report.artifacts.tasks.totalTasks} total
          {report.artifacts.tasks.parallelizableOpen > 0
            ? ` · ${report.artifacts.tasks.parallelizableOpen} paralelizables [P]`
            : ""}
        </p>
      ) : null}

      {report.artifacts.spec.clarificationMarkerCount > 0 ? (
        <p className="text-xs text-[var(--warning)]">
          {report.artifacts.spec.clarificationMarkerCount} marcador(es) [NEEDS CLARIFICATION] en Spec
        </p>
      ) : null}

      {report.crossArtifactGaps.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold">Hallazgos ({report.crossArtifactGaps.length})</p>
          {(Object.keys(gapsByCategory) as SddGapCategory[])
            .filter((cat) => (gapsByCategory[cat]?.length ?? 0) > 0)
            .map((cat) => (
              <div key={cat}>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {SDD_GAP_CATEGORY_LABEL[cat]}
                </p>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-[color-mix(in_oklch,var(--foreground)_90%,var(--muted-foreground))]">
                  {gapsByCategory[cat]!.map((g) => (
                    <li key={g} className="list-inside list-disc">
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
