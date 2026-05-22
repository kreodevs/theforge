import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListAddButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

/** Botón de alta con borde punteado (usuarios, instancias, etc.). */
export function ListAddButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: ListAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)] disabled:opacity-50",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
