import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type UnderlineTabItem<T extends string = string> = {
  id: T;
  label: React.ReactNode;
  /** Etiqueta corta en pantallas estrechas (visible solo en móvil si se define). */
  shortLabel?: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
};

export interface UnderlineTabsProps<T extends string = string> {
  tabs: UnderlineTabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** `aria-label` del tablist. */
  ariaLabel: string;
  /** Prefijo para `id` de tabs y `aria-controls` (ej. `settings` → `settings-tab-providers`). */
  idPrefix?: string;
  className?: string;
  tabClassName?: string;
}

export function UnderlineTabs<T extends string = string>({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  idPrefix,
  className,
  tabClassName,
}: UnderlineTabsProps<T>) {
  return (
    <nav
      className={cn(
        "flex shrink-0 overflow-x-auto border-b border-[var(--border)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(({ id, label, shortLabel, icon: Icon, disabled }) => {
        const selected = value === id;
        const labelContent =
          shortLabel != null ? (
            <>
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </>
          ) : (
            label
          );

        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${id}` : undefined}
            aria-selected={selected}
            aria-controls={idPrefix ? `${idPrefix}-panel-${id}` : undefined}
            disabled={disabled}
            onClick={() => onValueChange(id)}
            className={cn(
              "min-h-[44px] shrink-0 touch-manipulation whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors sm:min-h-0",
              selected
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:text-[var(--foreground)]",
              disabled && "pointer-events-none opacity-50",
              tabClassName,
            )}
          >
            {Icon ? (
              <span className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {labelContent}
              </span>
            ) : (
              labelContent
            )}
          </button>
        );
      })}
    </nav>
  );
}
