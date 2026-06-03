import { cn } from "@/lib/utils";
import {
  COMPONENT_SOURCE_CAPABILITY_ROLES,
  capabilityToneForRole,
  placeholderCapabilities,
  type ComponentSourceCapabilities,
} from "@/types/component-source-profiles";

const TONE_STYLES = {
  green: {
    box: "border-emerald-500/35 bg-emerald-500/10",
    dot: "bg-emerald-500",
    text: "text-emerald-800 dark:text-emerald-200",
  },
  amber: {
    box: "border-amber-500/35 bg-amber-500/10",
    dot: "bg-amber-500",
    text: "text-amber-900 dark:text-amber-100",
  },
  red: {
    box: "border-red-500/40 bg-red-500/10",
    dot: "bg-red-500",
    text: "text-red-800 dark:text-red-200",
  },
} as const;

interface CapabilityStatusBoxProps {
  capabilities?: ComponentSourceCapabilities | null;
  /** When true, required missing roles show amber (mapping pending) instead of red. */
  mappingPending?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * Colored capability grid: green = present, amber = optional missing, red = required missing.
 * Uses placeholder structure when `capabilities` is null until mapping API exists.
 */
export function CapabilityStatusBox({
  capabilities,
  mappingPending = !capabilities,
  className,
  compact = false,
}: CapabilityStatusBoxProps) {
  const caps = capabilities ?? (mappingPending ? placeholderCapabilities() : null);

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_12%,var(--card))] p-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
          Capacidades MCP
        </p>
        {mappingPending ? (
          <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
            Mapeo pendiente
          </span>
        ) : null}
      </div>
      <ul
        className={cn(
          "grid gap-1.5",
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {COMPONENT_SOURCE_CAPABILITY_ROLES.map((role) => {
          const tone = capabilityToneForRole(role, caps, mappingPending);
          const styles = TONE_STYLES[tone];
          return (
            <li
              key={role.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
                styles.box,
              )}
            >
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", styles.dot)}
                aria-hidden
              />
              <span className={cn("min-w-0 text-xs leading-snug", styles.text)}>
                {role.label}
                {role.required ? (
                  <span className="ml-1 font-normal opacity-70">(requerido)</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {mappingPending ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--foreground-muted)]">
          Usa «Probar conexión» y confirma el mapeo propuesto para habilitar wireframes con este perfil.
        </p>
      ) : null}
    </div>
  );
}
