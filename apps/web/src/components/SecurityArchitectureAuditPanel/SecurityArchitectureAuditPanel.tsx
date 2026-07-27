/**
 * Panel read-only: auditoría adversarial de seguridad y arquitectura sobre el MDD.
 */
import { useCallback, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Check, Copy, Loader2, ShieldAlert } from "lucide-react";
import {
  computeSecurityAuditCoberturaUiBreakdown,
  formatNoEvaluadoEntryForDisplay,
  formatSecurityAuditCoberturaUiLine,
  isSecurityAuditLowAnalyticalCoverage,
} from "@theforge/shared-types/mdd-security-audit-display";
import { cn } from "@/lib/utils";
import { apiFetch, API_BASE } from "@/utils/apiClient";
import {
  formatUserFacingThrownError,
  parseApiErrorPayloadFromResponse,
} from "@/utils/httpError";
import { isModelsUnavailableStreamError } from "@/utils/llm-stream-error";
import { useWorkshopStore } from "@/store/workshopStore";
import { WorkshopPanelButton, WorkshopButtonIcon } from "@/components/WorkshopButtons";

type AuditUiStatus = "idle" | "loading" | "done" | "error";

interface SecurityArchitectureAuditHallazgo {
  id?: string;
  severidad?: string;
  familia?: string;
  verificacion?: string;
  titulo?: string;
  ubicacion?: string;
  evidencia?: string;
  consecuencia?: string;
  criterio_cierre?: string;
  depende_de?: string[];
}

interface SecurityArchitectureAuditStructured {
  veredicto?: string;
  fecha_auditoria?: string;
  auditedAt?: string;
  resumen?: {
    bloqueante?: number;
    alto?: number;
    medio?: number;
    bajo?: number;
  };
  cobertura?: {
    ejecutadas?: number;
    pasa?: number;
    falla?: number;
    no_aplica?: number;
  };
  hallazgos?: SecurityArchitectureAuditHallazgo[];
  no_evaluado?: string[];
  supuestos?: string[];
  orden_resolucion?: string;
}

type SecurityAuditApiResponse = {
  veredicto?: string;
  markdownReport?: string;
  structured?: SecurityArchitectureAuditStructured | null;
  warnings?: string[];
  error?: string;
};

const SEVERITY_ORDER = ["BLOQUEANTE", "ALTO", "MEDIO", "BAJO"] as const;

const SEVERITY_LABEL: Record<(typeof SEVERITY_ORDER)[number], string> = {
  BLOQUEANTE: "Bloqueante",
  ALTO: "Alto",
  MEDIO: "Medio",
  BAJO: "Bajo",
};

const SEVERITY_ACCORDION_CLASS: Record<(typeof SEVERITY_ORDER)[number], string> = {
  BLOQUEANTE:
    "border-[color-mix(in_oklch,var(--destructive)_35%,var(--border))] bg-[color-mix(in_oklch,var(--destructive)_6%,var(--card))]",
  ALTO:
    "border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_6%,var(--card))]",
  MEDIO: "border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))]",
  BAJO: "border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_12%,var(--card))]",
};

const MARKDOWN_CLASS =
  "markdown-preview text-sm text-[var(--foreground)] [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:bg-[color-mix(in_oklch,var(--muted)_78%,var(--card))] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[var(--border)] [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-3 [&_td]:py-2";

function veredictoBadgeClass(veredicto: string | undefined): string {
  const v = (veredicto ?? "").toUpperCase();
  if (v.includes("NO APTO") || v.includes("NO_APTO")) {
    return "border-[color-mix(in_oklch,var(--destructive)_35%,var(--border))] bg-[color-mix(in_oklch,var(--destructive)_12%,var(--card))] text-[color-mix(in_oklch,var(--destructive)_88%,var(--foreground))]";
  }
  if (v.includes("CONDICIONES") || v.includes("APTO_CON")) {
    return "border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_12%,var(--card))] text-[color-mix(in_oklch,var(--warning)_88%,var(--foreground))]";
  }
  return "border-[color-mix(in_oklch,var(--success)_35%,var(--border))] bg-[color-mix(in_oklch,var(--success)_12%,var(--card))] text-[color-mix(in_oklch,var(--success)_88%,var(--foreground))]";
}

function groupHallazgosBySeverity(
  hallazgos: SecurityArchitectureAuditHallazgo[],
): Record<(typeof SEVERITY_ORDER)[number], SecurityArchitectureAuditHallazgo[]> {
  const groups: Record<(typeof SEVERITY_ORDER)[number], SecurityArchitectureAuditHallazgo[]> = {
    BLOQUEANTE: [],
    ALTO: [],
    MEDIO: [],
    BAJO: [],
  };
  for (const h of hallazgos) {
    const sev = (h.severidad ?? "").toUpperCase();
    const key = SEVERITY_ORDER.find((s) => sev.includes(s)) ?? "MEDIO";
    groups[key].push(h);
  }
  return groups;
}

export interface SecurityArchitectureAuditPanelProps {
  projectId: string;
  stageId: string | null | undefined;
  mddContent: string;
  className?: string;
  variant?: "default" | "workspace";
}

export function SecurityArchitectureAuditPanel({
  projectId,
  stageId,
  mddContent,
  className,
  variant = "workspace",
}: SecurityArchitectureAuditPanelProps) {
  const [status, setStatus] = useState<AuditUiStatus>("idle");
  const [veredicto, setVeredicto] = useState<string | undefined>();
  const [markdownReport, setMarkdownReport] = useState<string>("");
  const [structured, setStructured] = useState<SecurityArchitectureAuditStructured | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jsonCopyOk, setJsonCopyOk] = useState(false);
  const [reportCopyOk, setReportCopyOk] = useState(false);
  const [deepAudit, setDeepAudit] = useState(false);

  const runAudit = useCallback(async () => {
    if (!projectId?.trim() || !stageId?.trim()) return;
    if (!mddContent.trim()) {
      setError("No hay MDD para auditar.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    setVeredicto(undefined);
    setMarkdownReport("");
    setStructured(null);
    setWarnings([]);
    setJsonCopyOk(false);
    setReportCopyOk(false);

    try {
      const res = await apiFetch(`${API_BASE}/ai-analysis/mdd/security-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId.trim(),
          stageId: stageId.trim(),
          mddContent: mddContent.trim(),
          deepAudit,
        }),
      });

      if (!res.ok) {
        const { message, code } = await parseApiErrorPayloadFromResponse(
          res,
          "No se pudo ejecutar la auditoría de seguridad",
        );
        const payload = { message, code };
        if (isModelsUnavailableStreamError(payload)) {
          useWorkshopStore.getState().setModelsUnavailableModalOpen(true);
        }
        throw new Error(message);
      }

      const data = (await res.json()) as SecurityAuditApiResponse;
      if (data.error) {
        throw new Error(data.error);
      }

      setVeredicto(data.veredicto ?? data.structured?.veredicto);
      setMarkdownReport(data.markdownReport ?? "");
      setStructured(data.structured ?? null);
      setWarnings(data.warnings ?? []);
      setStatus("done");
    } catch (e) {
      setError(formatUserFacingThrownError(e, "Error al auditar seguridad y arquitectura"));
      setStatus("error");
    }
  }, [projectId, stageId, mddContent, deepAudit]);

  const handleCopyJson = useCallback(async () => {
    if (!structured) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(structured, null, 2));
      setJsonCopyOk(true);
      window.setTimeout(() => setJsonCopyOk(false), 2000);
    } catch {
      setError("No se pudo copiar el JSON al portapapeles");
    }
  }, [structured]);

  const handleCopyReport = useCallback(async () => {
    if (!markdownReport) return;
    try {
      await navigator.clipboard.writeText(markdownReport);
      setReportCopyOk(true);
      window.setTimeout(() => setReportCopyOk(false), 2000);
    } catch {
      setError("No se pudo copiar el informe al portapapeles");
    }
  }, [markdownReport]);

  if (!stageId) {
    return null;
  }

  const isWorkspace = variant === "workspace";
  const hallazgos = structured?.hallazgos ?? [];
  const grouped = groupHallazgosBySeverity(hallazgos);
  const ordenResolucion = structured?.orden_resolucion?.trim();
  const coberturaUi = useMemo(
    () =>
      structured
        ? computeSecurityAuditCoberturaUiBreakdown({
            hallazgos: structured.hallazgos,
            no_evaluado: structured.no_evaluado,
            cobertura: structured.cobertura,
          })
        : null,
    [structured],
  );
  const noEvaluadoDisplay = useMemo(
    () => (structured?.no_evaluado ?? []).map(formatNoEvaluadoEntryForDisplay),
    [structured?.no_evaluado],
  );
  const lowAnalyticalCoverage = useMemo(
    () => isSecurityAuditLowAnalyticalCoverage({ warnings, coberturaUi }),
    [warnings, coberturaUi],
  );

  return (
    <section
      className={cn(
        isWorkspace
          ? "flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6"
          : "rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4",
        className,
      )}
      aria-label="Auditoría de seguridad y arquitectura"
      aria-busy={status === "loading"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            <ShieldAlert className="size-4 shrink-0 text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]" aria-hidden />
            Auditoría de seguridad y arquitectura
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Agente adversarial read-only: hallazgos verificables sobre el MDD actual. No reescribe el documento.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label
            className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted-foreground)]"
            title="7 llamadas en paralelo por familia A–G. Más lenta y costosa que el modo estándar (1 llamada)."
          >
            <input
              type="checkbox"
              className="size-3.5 rounded border-[var(--border)] accent-[var(--primary)]"
              checked={deepAudit}
              disabled={status === "loading"}
              onChange={(e) => setDeepAudit(e.target.checked)}
            />
            Auditoría profunda
          </label>
          <WorkshopPanelButton
            tone="primary"
            onClick={() => void runAudit()}
            disabled={status === "loading" || !mddContent.trim()}
            title={
              !mddContent.trim()
                ? "Genera o escribe el MDD antes de auditar"
                : "Ejecutar auditoría adversarial"
            }
          >
            {status === "loading" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <WorkshopButtonIcon icon={ShieldAlert} tone="primary" />
            )}
            Auditar seguridad y arquitectura
          </WorkshopPanelButton>
        </div>
      </div>

      {status === "loading" ? (
        <div
          className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-4 py-6 text-sm text-[var(--muted-foreground)]"
          role="status"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span className="font-medium text-[var(--foreground)]">Analizando MDD…</span>
          </div>
          <p className="pl-6 text-xs leading-relaxed">
            {deepAudit
              ? "Multi-pase por familia A–G (7 extracciones en paralelo) → merge y catálogo 88 verificaciones. Más lento y costoso."
              : "Modo estándar: 1 llamada al modelo sobre el MDD completo (≤100k caracteres). MDD >100k: auditoría por secciones."}
            {" "}Puede tardar varios minutos.
          </p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklch,var(--destructive)_35%,var(--border))] bg-[color-mix(in_oklch,var(--destructive)_8%,var(--card))] px-3 py-2.5 text-sm text-[color-mix(in_oklch,var(--destructive)_88%,var(--foreground))]"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {status === "done" && (veredicto || structured?.resumen) ? (
        <div className="space-y-3 rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--card))] p-4">
          {lowAnalyticalCoverage ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklch,var(--warning)_40%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_10%,var(--card))] px-3 py-2 text-xs text-[color-mix(in_oklch,var(--warning)_90%,var(--foreground))]"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Cobertura analítica baja — re-auditar o usar un modelo más fuerte. Muchas
                verificaciones quedaron sin revisión explícita del modelo.
              </span>
            </div>
          ) : null}

          {veredicto ? (
            <div
              className={cn(
                "inline-flex w-fit items-center rounded-md border px-3 py-1.5 text-sm font-medium",
                veredictoBadgeClass(veredicto),
              )}
            >
              Veredicto: {veredicto.replace(/_/g, " ")}
            </div>
          ) : null}

          {structured?.auditedAt || structured?.fecha_auditoria ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              Auditado: {structured.auditedAt ?? structured.fecha_auditoria}
            </p>
          ) : null}

          {structured?.resumen ? (
            <table className="w-full max-w-md border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                  <th className="py-1.5 pr-3 font-medium">Severidad</th>
                  <th className="py-1.5 font-medium tabular-nums">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {(["bloqueante", "alto", "medio", "bajo"] as const).map((key) => {
                  const count = structured.resumen?.[key];
                  if (count == null) return null;
                  return (
                    <tr key={key} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5 pr-3 capitalize">{key}</td>
                      <td className="py-1.5 tabular-nums">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}

          {coberturaUi ? (
            <p className="text-xs text-[var(--muted-foreground)] tabular-nums">
              Cobertura catálogo: {formatSecurityAuditCoberturaUiLine(coberturaUi)}
            </p>
          ) : null}
        </div>
      ) : null}

      {status === "done" && hallazgos.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Hallazgos por severidad</h3>
          {SEVERITY_ORDER.map((sev) => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            return (
              <details
                key={sev}
                open={sev === "BLOQUEANTE" || sev === "ALTO"}
                className={cn("rounded-md border", SEVERITY_ACCORDION_CLASS[sev])}
              >
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-[var(--foreground)]">
                  {SEVERITY_LABEL[sev]} ({items.length})
                </summary>
                <ul className="space-y-3 border-t border-[var(--border)] px-3 py-3">
                  {items.map((h, idx) => {
                    const label = h.id ?? h.verificacion ?? `hallazgo-${idx + 1}`;
                    return (
                      <li
                        key={`${label}-${idx}`}
                        className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3 text-sm"
                      >
                        <p className="font-medium text-[var(--foreground)]">
                          {label}
                          {h.titulo ? ` — ${h.titulo}` : ""}
                        </p>
                        {h.ubicacion ? (
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            <span className="font-medium">Ubicación:</span> {h.ubicacion}
                          </p>
                        ) : null}
                        {h.evidencia ? (
                          <p className="mt-1 text-xs text-[var(--foreground)]">
                            <span className="font-medium">Evidencia:</span> {h.evidencia}
                          </p>
                        ) : null}
                        {h.consecuencia ? (
                          <p className="mt-1 text-xs text-[var(--foreground)]">
                            <span className="font-medium">Consecuencia:</span> {h.consecuencia}
                          </p>
                        ) : null}
                        {h.criterio_cierre ? (
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            <span className="font-medium">Cierre:</span> {h.criterio_cierre}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      ) : null}

      {status === "done" && noEvaluadoDisplay.length > 0 ? (
        <details className="rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_10%,var(--card))]">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-[var(--foreground)]">
            Verificaciones no evaluadas ({noEvaluadoDisplay.length})
          </summary>
          <ul className="max-h-64 space-y-1 overflow-auto border-t border-[var(--border)] px-3 py-3 text-xs text-[var(--muted-foreground)]">
            {noEvaluadoDisplay.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {status === "done" && ordenResolucion ? (
        <div className="rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_12%,var(--card))] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
            §8.4 Orden de resolución recomendado
          </h3>
          <div className={cn("text-sm", MARKDOWN_CLASS)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{ordenResolucion}</ReactMarkdown>
          </div>
        </div>
      ) : null}

      {status === "done" && markdownReport ? (
        <details className="rounded-md border border-[var(--border)]">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-[var(--foreground)]">
            <span>Informe markdown completo</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[color-mix(in_oklch,var(--muted)_40%,transparent)]"
              onClick={(e) => {
                e.preventDefault();
                void handleCopyReport();
              }}
            >
              {reportCopyOk ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {reportCopyOk ? "Copiado" : "Copiar"}
            </button>
          </summary>
          <div className={cn("max-h-[32rem] overflow-auto border-t border-[var(--border)] p-4", MARKDOWN_CLASS)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownReport}</ReactMarkdown>
          </div>
        </details>
      ) : null}

      {status === "done" && structured ? (
        <details className="rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))]">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-[var(--foreground)]">
            <span>Datos estructurados (§8.3)</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[color-mix(in_oklch,var(--muted)_40%,transparent)]"
              onClick={(e) => {
                e.preventDefault();
                void handleCopyJson();
              }}
            >
              {jsonCopyOk ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {jsonCopyOk ? "Copiado" : "Copiar JSON"}
            </button>
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-[var(--border)] p-3 font-mono text-xs text-[var(--foreground)]">
            {JSON.stringify(structured, null, 2)}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
