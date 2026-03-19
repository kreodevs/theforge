import { useState } from "react";
import { CheckCircle2, Loader2, XCircle, Layers } from "lucide-react";
import { useWorkshopStore, type ComplexityPending } from "../store/workshopStore";

function levelLabel(level: ComplexityPending["level"]): string {
  switch (level) {
    case "LOW":
      return "Baja (LOW)";
    case "MEDIUM":
      return "Media (MEDIUM)";
    case "HIGH":
      return "Alta (HIGH)";
    default:
      return level;
  }
}

/**
 * Banner HITL: el backend guardó una propuesta en `project.complexityPending` (DBGA stream o inferencia).
 * Confirmar aplica el nivel a `complexity`; descartar limpia la propuesta sin cambiar el nivel efectivo.
 */
export default function ComplexityPendingBanner() {
  const projectId = useWorkshopStore((s) => s.projectId);
  const pending = useWorkshopStore((s) => s.project?.complexityPending);
  const storeLoading = useWorkshopStore((s) => s.loading);
  const confirmComplexityProposal = useWorkshopStore((s) => s.confirmComplexityProposal);
  const dismissComplexityProposal = useWorkshopStore((s) => s.dismissComplexityProposal);
  const [busy, setBusy] = useState(false);

  if (!pending || !projectId) return null;

  const disabled = storeLoading || busy;

  const run = async (fn: (id: string) => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn(projectId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="shrink-0 px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 flex flex-col gap-2"
      role="region"
      aria-label="Propuesta de complejidad pendiente de confirmación"
    >
      <div className="flex items-start gap-2">
        <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-200">
            Complejidad propuesta: {levelLabel(pending.level)}
          </p>
          {pending.planSummary?.trim() ? (
            <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap">{pending.planSummary.trim()}</p>
          ) : null}
          {pending.reason?.trim() ? (
            <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{pending.reason.trim()}</p>
          ) : null}
          <p className="text-xs text-zinc-500 mt-2">
            También puedes confirmar escribiendo en el chat (p. ej. «sí, ejecuta este plan») o descartar con «no».
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-7">
        <button
          type="button"
          disabled={disabled}
          onClick={() => run(confirmComplexityProposal)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Confirmar y aplicar nivel
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => run(dismissComplexityProposal)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <XCircle className="w-4 h-4" />
          Descartar propuesta
        </button>
      </div>
    </div>
  );
}
