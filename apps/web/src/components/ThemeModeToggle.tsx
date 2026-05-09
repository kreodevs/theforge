/**
 * @fileoverview Light / system / dark preference control; mirrors persisted theme from `ThemeProvider`.
 */
import type { ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export interface ThemeModeToggleProps {
  compact?: boolean;
  /** `sidebar`: dashboard rail styling; `surface`: neutral glass for login/setup overlays */
  variant?: "sidebar" | "surface";
}

export function ThemeModeToggle({ compact = false, variant = "sidebar" }: ThemeModeToggleProps) {
  const { preference, setPreference } = useTheme();

  /** Login / overlay: one horizontal pill with circular hits (not a tall stack). */
  const surfacePill = variant === "surface" && compact;

  const shell = cn(
    variant === "surface"
      ? cn(
          "border border-[color-mix(in_oklch,var(--border)_92%,var(--foreground)_8%)] backdrop-blur-md",
          "bg-[color-mix(in_oklch,var(--card)_88%,transparent)] shadow-[var(--shadow-sm)]",
          surfacePill
            ? "inline-flex rounded-full p-[3px] shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--foreground)_5%,transparent)]"
            : "rounded-[var(--radius-lg)] p-1",
        )
      : "rounded-[var(--radius-lg)] bg-[color-mix(in_oklch,var(--sidebar-foreground)_6%,var(--sidebar))] p-1 shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--sidebar-foreground)_8%,transparent)]",
  );

  const inactive = surfacePill
    ? "text-[var(--foreground-muted)] hover:bg-[color-mix(in_oklch,var(--muted)_40%,transparent)] hover:text-[var(--foreground)]"
    : variant === "surface"
      ? "text-[var(--foreground-muted)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))] hover:text-[var(--foreground)]"
      : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]";

  const item = (value: ThemePreference, label: string, icon: ReactNode) => {
    const selected = preference === value;
    const button = (
      <button
        type="button"
        onClick={() => setPreference(value)}
        title={label}
        aria-label={label}
        aria-pressed={selected}
        className={cn(
          "flex items-center justify-center font-medium outline-none transition-colors duration-200",
          "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
          surfacePill && "size-9 shrink-0 rounded-full [&_svg]:size-[1.125rem]",
          !surfacePill && compact && "w-full rounded-[var(--radius-md)] py-2.5 [&>span>svg]:h-4 [&>span>svg]:w-4",
          !surfacePill && !compact && "min-w-0 flex-1 flex-col gap-0.5 rounded-[var(--radius-md)] py-2 text-[10px] sm:text-[11px]",
          selected
            ? surfacePill
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-sm)]"
              : "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
            : inactive,
        )}
      >
        <span className={cn("flex items-center justify-center", !compact && !surfacePill && "flex-col gap-0.5")}>
          <span className={cn(!surfacePill && "[&>svg]:h-4 [&>svg]:w-4")}>{icon}</span>
          {!compact && !surfacePill ? <span className="leading-none">{label}</span> : null}
        </span>
      </button>
    );

    if (!compact) {
      return button;
    }

    return (
      <Tooltip delayDuration={surfacePill ? 180 : 200}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side={surfacePill ? "bottom" : "right"}
          align="center"
          sideOffset={surfacePill ? 8 : 10}
          className={
            surfacePill
              ? "border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)]"
              : undefined
          }
        >
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div
      className={cn(
        shell,
        variant === "sidebar" && "mb-3",
        compact && !surfacePill ? "flex flex-col gap-0.5" : "",
      )}
      role="group"
      aria-label="Tema de la interfaz"
    >
      <div
        className={cn(
          surfacePill ? "flex flex-row items-center gap-0.5" : "",
          compact && !surfacePill ? "flex flex-col gap-0.5" : "",
          !compact ? "flex min-w-0 gap-0.5" : "",
        )}
      >
        {item("light", "Claro", <Sun className="h-4 w-4" />)}
        {item("system", "Sistema", <Monitor className="h-4 w-4" />)}
        {item("dark", "Oscuro", <Moon className="h-4 w-4" />)}
      </div>
    </div>
  );
}
