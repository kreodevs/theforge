import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

/** Botón solo icono alineado con `Button size="sm"` (p. ej. Usar, selector de rol). */
export const listRowIconButtonClass = "w-8 shrink-0 px-0";

export function ListRowIconButton({
  className,
  variant = "outline",
  size = "sm",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(listRowIconButtonClass, className)}
      {...props}
    />
  );
}

/** Altura coherente con botones `size="sm"`; ancho según el valor seleccionado. */
export const listRowSelectClass =
  "h-8 w-fit max-w-full appearance-none rounded-md border border-[var(--border)] bg-[var(--card)] pl-2.5 pr-9 text-sm text-[var(--foreground)] [field-sizing:content]";

/** Select compacto de fila con chevron y padding derecho explícito. */
export function ListRowSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative inline-flex max-w-full shrink-0">
      <select className={cn(listRowSelectClass, className)} {...props} />
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]"
        aria-hidden
      />
    </span>
  );
}
