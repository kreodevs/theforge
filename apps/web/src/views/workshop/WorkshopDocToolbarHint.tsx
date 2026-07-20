import type { WorkshopComplexityTier } from "../../utils/workshopDocToolbar";

/**
 * Explains document tab order. HIGH complexity: summary only — full flow opens from the toolbar modal.
 */
export function WorkshopDocToolbarHint({
  tier,
  isLegacyProject: _isLegacyProject,
}: {
  tier: WorkshopComplexityTier;
  isLegacyProject: boolean;
}) {
  const fullText =
    tier === "LOW"
      ? "Complejidad baja: Spec → H.U. → Tasks (MDD / Blueprint / API ocultos). Paso 0 opcional."
      : tier === "MEDIUM"
        ? _isLegacyProject
          ? "Complejidad media (legacy): MDD Inicial opcional (Ariadne); MDD de cambio + Spec → API → Design System → Tasks."
          : "Complejidad media (producto nuevo): sin MDD en barra — insumo Paso 0 / Spec. Entregables: Spec → API → Design System → Tasks."
        : _isLegacyProject
          ? "Legacy: MDD Inicial opcional (Ariadne → doc. de partida); luego Modificación + MDD de cambio y entregables. Cada etapa del taller = una modificación con doc actualizada vía Ariadne."
          : "Orden: Paso 0 → BRD → To-Be → MDD → Spec → Arq. → Casos → H.U. → Blueprint → Design System → API → Flujos → Tasks → Infra";

  const summaryLine =
    tier === "LOW"
      ? fullText
      : tier === "MEDIUM"
        ? _isLegacyProject
          ? "Complejidad media (legacy): doc. de partida opcional con Ariadne; luego MDD de cambio y entregables (Spec → API → UX/UI → Tasks)."
          : "Complejidad media (producto nuevo): insumo Paso 0 / Spec; entregables Spec → API → Design System → Tasks (sin MDD en barra hasta avanzar el flujo)."
        : _isLegacyProject
          ? "Complejidad alta (legacy): Ariadne para doc. de partida, Modificación por etapa y documentación actualizada con el taller."
          : "Complejidad alta (producto nuevo): recorre Paso 0, BRD, To-Be, MDD y entregables hasta Infra en el orden sugerido.";

  if (tier !== "HIGH") {
    return (
      <p
        className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--foreground-subtle)] sm:max-w-[min(100%,52rem)] lg:line-clamp-1"
        title={fullText}
      >
        {fullText}
      </p>
    );
  }

  return (
    <div className="min-w-0 flex-1 sm:max-w-[min(100%,52rem)]" title={summaryLine}>
      <p className="text-xs font-medium leading-snug text-[var(--foreground)] lg:line-clamp-1">{summaryLine}</p>
    </div>
  );
}
