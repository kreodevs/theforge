/**
 * @fileoverview Sección colapsable que muestra el consumo de tokens por documento
 * generado (incluyendo regeneraciones) con cálculo USD/MXN a partir del catálogo
 * de pricing del proveedor IA activo.
 *
 * Patrón visual: `<details>` nativo con marker oculto (mismo estilo que el resto
 * de métricas en `WorkshopMetricsColumnInner.tsx`).
 */
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Coins, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_BASE } from "@/utils/apiClient";

interface TokenUsageByModel {
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costMxn: number;
  calls: number;
}

interface TokenUsageDocumentAggregate {
  documentField: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostMxn: number;
  generations: number;
  byModel: TokenUsageByModel[];
  firstAt: string;
  lastAt: string;
}

interface TokenUsageSummary {
  projectId: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostMxn: number;
  documents: TokenUsageDocumentAggregate[];
  mxnPerUsd: number;
}

const DOCUMENT_LABELS: Record<string, string> = {
  mddContent: "MDD",
  specContent: "Spec",
  architectureContent: "Arquitectura",
  useCasesContent: "Casos de uso",
  blueprintContent: "Blueprint",
  tasksContent: "Tasks",
  apiContractsContent: "Contratos API",
  logicFlowsContent: "Lógica y edge cases",
  infraContent: "Infraestructura",
  agentGovernanceContent: "Gobernanza IA",
  uxUiGuideContent: "Guía UX/UI",
  phase0SummaryContent: "Fase 0 (resumen)",
  aemContent: "AEM",
  uiScreensContent: "UI Screens",
  brdContent: "BRD",
  dbgaContent: "Benchmark (DBGA)",
  chat: "Chat del Workshop",
};

const CARD_BASE =
  "rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_78%,var(--background))]";

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatMxn(n: number): string {
  return `$${n.toFixed(2)} MXN`;
}

function formatModelLabel(providerId: string, modelId: string): string {
  if (providerId === "openrouter") {
    const stripped = modelId.replace(/^openai\/|^anthropic\/|^google\//, "");
    return `openrouter / ${stripped}`;
  }
  return `${providerId} / ${modelId}`;
}

function formatDocumentLabel(field: string): string {
  return DOCUMENT_LABELS[field] ?? field;
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export interface TokenUsageCardProps {
  projectId: string;
  stageId?: string;
}

export function TokenUsageCard({ projectId, stageId }: TokenUsageCardProps) {
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId });
      if (stageId) params.set("stageId", stageId);
      const response = await apiFetch(
        `${API_BASE}/ai-analysis/token-usage?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as TokenUsageSummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, stageId]);

  useEffect(() => {
    if (open && !summary && !loading) {
      void fetchSummary();
    }
  }, [open, summary, loading, fetchSummary]);

  // Refrescar cuando el documento etapa cambie (entre regeneraciones)
  useEffect(() => {
    setSummary(null);
  }, [projectId, stageId]);

  if (!summary && !loading && !error) {
    return (
      <details
        className="group shrink-0"
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-0.5 py-1 text-sm font-semibold tracking-tight text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-0"
            aria-hidden
          />
          <Coins className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
          Consumo IA (tokens &amp; coste)
          <span
            className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[color-mix(in_oklch,var(--primary)_88%,var(--foreground))]"
            title="Conversión USD→MXN estimada; el usuario la mantiene en Ajustes → Sistema. No es un feed live."
          >
            <Info className="h-2.5 w-2.5" aria-hidden />
            MXN estimado
          </span>
        </summary>
        <div className={cn(CARD_BASE, "px-3 py-2.5 text-[11px] leading-snug")}>
          <p className="text-[color-mix(in_oklch,var(--muted-foreground)_92%,var(--foreground))]">
            Aún no hay telemetría registrada para este proyecto. Empieza una generación de
            MDD, Spec, Blueprint, etc. para empezar a trackear uso de tokens.
          </p>
        </div>
      </details>
    );
  }

  return (
    <details
      className="group shrink-0"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-0.5 py-1 text-sm font-semibold tracking-tight text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-0"
          aria-hidden
        />
        <Coins className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
        Consumo IA (tokens &amp; coste)
        <span
          className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[color-mix(in_oklch,var(--primary)_88%,var(--foreground))]"
          title="Conversión USD→MXN estimada; el usuario la mantiene en Ajustes → Sistema. No es un feed live."
        >
          <Info className="h-2.5 w-2.5" aria-hidden />
          MXN estimado
        </span>
      </summary>
      <div className={cn(CARD_BASE, "space-y-2 overflow-hidden p-0 text-[11px] leading-snug")}>
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-2.5 text-[color-mix(in_oklch,var(--muted-foreground)_88%,var(--foreground))]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Cargando telemetría de tokens…
          </div>
        ) : error ? (
          <div className="px-3 py-2.5 text-[color-mix(in_oklch,var(--destructive)_86%,var(--foreground))]">
            Error al cargar: {error}
          </div>
        ) : summary ? (
          <TokenUsageBody summary={summary} />
        ) : null}
      </div>
    </details>
  );
}

function TokenUsageBody({ summary }: { summary: TokenUsageSummary }) {
  const documents = summary.documents;
  if (documents.length === 0) {
    return (
      <p className="px-3 py-2.5 text-[color-mix(in_oklch,var(--muted-foreground)_92%,var(--foreground))]">
        Sin generaciones registradas todavía.
      </p>
    );
  }

  return (
    <div>
      <div className="border-b border-[var(--border)]/60 bg-[color-mix(in_oklch,var(--muted)_18%,transparent)] px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-medium text-[color-mix(in_oklch,var(--foreground)_94%,var(--muted-foreground))]">
            Total acumulado
          </span>
          <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {formatMxn(summary.totalCostMxn)}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-[color-mix(in_oklch,var(--muted-foreground)_94%,var(--foreground))]">
          {formatUsd(summary.totalCostUsd)} USD · {formatNumber(summary.totalTokens)} tokens (
          {formatNumber(summary.totalPromptTokens)} in · {formatNumber(summary.totalCompletionTokens)} out) · TC {summary.mxnPerUsd} MXN/USD (estimado)
        </p>
        <p
          className="mt-1 text-[10px] italic text-[color-mix(in_oklch,var(--muted-foreground)_90%,var(--foreground))]"
          title="Los importes en MXN son una estimación calculada con el tipo de cambio configurado en Ajustes → Sistema (no es un feed live)."
        >
          La conversión USD→MXN usa el TC estimado configurado en Ajustes → Sistema; ajústalo si el coste real no encaja.
        </p>
      </div>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-[color-mix(in_oklch,var(--muted)_10%,transparent)] text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Documento
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Regens
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Tokens
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                USD
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                MXN (est.)
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <DocumentRow key={doc.documentField} doc={doc} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocumentRow({ doc }: { doc: TokenUsageDocumentAggregate }) {
  return (
    <>
      <tr className="border-t border-[var(--border)]/40 align-top">
        <td className="px-2 py-1.5">
          <div className="font-medium text-[var(--foreground)]">
            {formatDocumentLabel(doc.documentField)}
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)]">
            {formatDate(doc.firstAt)} → {formatDate(doc.lastAt)}
          </div>
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums text-[var(--foreground)]">
          {doc.generations}
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums text-[color-mix(in_oklch,var(--foreground)_92%,var(--muted-foreground))]">
          {formatNumber(doc.totalTokens)}
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums text-[color-mix(in_oklch,var(--foreground)_92%,var(--muted-foreground))]">
          {formatUsd(doc.totalCostUsd)}
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums font-medium text-[var(--foreground)]">
          {formatMxn(doc.totalCostMxn)}
        </td>
      </tr>
      {doc.byModel.map((m) => (
        <tr key={`${doc.documentField}-${m.providerId}-${m.modelId}`} className="bg-[color-mix(in_oklch,var(--muted)_6%,transparent)]">
          <td className="pl-6 pr-2 py-1 text-[10px] text-[color-mix(in_oklch,var(--muted-foreground)_88%,var(--foreground))]" colSpan={1}>
            {formatModelLabel(m.providerId, m.modelId)}
            <span className="ml-1 text-[var(--muted-foreground)]">({m.calls} call{m.calls === 1 ? "" : "s"})</span>
          </td>
          <td className="px-2 py-1 text-right text-[10px] text-[var(--muted-foreground)]">
            {formatNumber(m.totalTokens)}
          </td>
          <td className="px-2 py-1 text-right text-[10px] text-[var(--muted-foreground)]">
            {formatUsd(m.costUsd)}
          </td>
          <td className="px-2 py-1 text-right text-[10px] text-[var(--muted-foreground)]">
            {formatMxn(m.costMxn)}
          </td>
          <td />
        </tr>
      ))}
    </>
  );
}
