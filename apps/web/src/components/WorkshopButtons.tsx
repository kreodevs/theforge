import { forwardRef, type ComponentProps, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  WORKSHOP_ACTION_SAVE,
  WORKSHOP_BTN_SIZE_ICON,
  WORKSHOP_CHAT_TOOLBAR_ICON_BTN,
  WORKSHOP_CHAT_TOOLBAR_ICON_BTN_DANGER_HOVER,
  WORKSHOP_DOC_TOOLBAR_ICON_BTN,
  WORKSHOP_DOC_TOOLBAR_ICON,
  WORKSHOP_GROUP_ICON,
  WORKSHOP_GROUP_ICON_BY_TONE,
  SIDEBAR_RAIL_ICON_BTN_IDLE,
  SIDEBAR_RAIL_ICON_BTN_OUTLINED,
  SIDEBAR_RAIL_ICON_BTN_SELECTED,
  WORKSHOP_MDD_ACTION_PRIMARY,
  WORKSHOP_MDD_ACTION_SUCCESS,
  WORKSHOP_PANEL_ACTION_DANGER,
  WORKSHOP_PANEL_ACTION_PRIMARY,
  WORKSHOP_PANEL_ACTION_SECONDARY,
  WORKSHOP_PANEL_ACTION_SUCCESS,
  type WorkshopButtonIconTone,
} from "@/constants/workshopDocToolbar";
import { WORKSHOP_HEADER_ICON_BTN } from "@/constants/workshopHeaderToolbar";

export type WorkshopPanelTone = WorkshopButtonIconTone;

const workshopPanelToneClass: Record<WorkshopPanelTone, string> = {
  primary: WORKSHOP_PANEL_ACTION_PRIMARY,
  secondary: WORKSHOP_PANEL_ACTION_SECONDARY,
  danger: WORKSHOP_PANEL_ACTION_DANGER,
  success: WORKSHOP_PANEL_ACTION_SUCCESS,
};

const workshopMddToneClass = {
  primary: WORKSHOP_MDD_ACTION_PRIMARY,
  success: WORKSHOP_MDD_ACTION_SUCCESS,
} as const;

/** Icono Lucide acoplado al hover del botón padre (`group`). */
export function WorkshopButtonIcon({
  icon: Icon,
  tone = "secondary",
  className,
}: {
  icon: LucideIcon;
  tone?: WorkshopButtonIconTone;
  className?: string;
}) {
  return (
    <Icon
      className={cn(WORKSHOP_GROUP_ICON, WORKSHOP_GROUP_ICON_BY_TONE[tone], className)}
      strokeWidth={2}
      aria-hidden
    />
  );
}

function workshopSpinnerClass(tone: WorkshopPanelTone) {
  return cn(WORKSHOP_GROUP_ICON, WORKSHOP_GROUP_ICON_BY_TONE[tone], "animate-spin");
}

/** Marco común para filas de acciones en paneles (MDD, Benchmark, Fase 0). */
export function WorkshopPanelActionRegion({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_38%,var(--background))] p-3 sm:p-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type WorkshopPanelButtonProps = ComponentProps<"button"> & {
  tone?: WorkshopPanelTone;
  loading?: boolean;
};

/** Panel CTA (Generar BRD, acciones de documento, banner secundario). */
export function WorkshopPanelButton({
  tone = "primary",
  className,
  loading,
  disabled,
  children,
  ...props
}: WorkshopPanelButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(workshopPanelToneClass[tone], className)}
      {...props}
    >
      {loading ? <Loader2 className={workshopSpinnerClass(tone)} aria-hidden /> : null}
      {children}
    </button>
  );
}

type WorkshopMddActionButtonProps = ComponentProps<"button"> & {
  tone?: keyof typeof workshopMddToneClass;
  loading?: boolean;
};

/** CTA grande del panel MDD (Regenerar / Generar todos). */
export function WorkshopMddActionButton({
  tone = "primary",
  className,
  loading,
  disabled,
  children,
  ...props
}: WorkshopMddActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        workshopMddToneClass[tone],
        "w-full justify-center lg:w-auto lg:min-w-0",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type WorkshopGhostButtonProps = ComponentProps<"button">;

/** Cancelar / descartar en barras inline (estilo outline, como el resto de vistas). */
export function WorkshopGhostButton({ className, children, ...props }: WorkshopGhostButtonProps) {
  return (
    <button type="button" className={cn(WORKSHOP_PANEL_ACTION_SECONDARY, className)} {...props}>
      {children}
    </button>
  );
}

type WorkshopSaveButtonProps = ComponentProps<"button"> & {
  loading?: boolean;
  label?: string;
  loadingLabel?: string;
};

/** Grabar compacto en barras de cambios sin guardar. */
export function WorkshopSaveButton({
  loading,
  label = "Grabar",
  loadingLabel = "Grabando…",
  disabled,
  className,
  ...props
}: WorkshopSaveButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(WORKSHOP_ACTION_SAVE, className)}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn(WORKSHOP_GROUP_ICON, WORKSHOP_GROUP_ICON_BY_TONE.primary, "animate-spin")} aria-hidden />
      ) : (
        <Save className={cn(WORKSHOP_GROUP_ICON, WORKSHOP_GROUP_ICON_BY_TONE.primary)} aria-hidden />
      )}
      {loading ? loadingLabel : label}
    </button>
  );
}

type WorkshopDirtySaveBarProps = {
  message: ReactNode;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  disabled?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  className?: string;
};

/** Aviso de cambios sin guardar con Cancelar + Grabar (MDD, BRD, etc.). */
export function WorkshopDirtySaveBar({
  message,
  onCancel,
  onSave,
  saving,
  disabled,
  saveLabel,
  savingLabel,
  className,
}: WorkshopDirtySaveBarProps) {
  return (
    <div
      className={cn(
        "mb-3 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-[color-mix(in_oklch,var(--primary)_28%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] px-3 py-2",
        className,
      )}
    >
      <span className="text-sm text-[color-mix(in_oklch,var(--primary)_62%,var(--foreground))]">{message}</span>
      <div className="flex shrink-0 items-center gap-2">
        <WorkshopGhostButton onClick={onCancel} disabled={disabled || saving}>
          <WorkshopButtonIcon icon={X} tone="secondary" />
          Cancelar
        </WorkshopGhostButton>
        <WorkshopSaveButton
          onClick={onSave}
          loading={saving}
          disabled={disabled}
          label={saveLabel}
          loadingLabel={savingLabel}
        />
      </div>
    </div>
  );
}

/** Icono cuadrado del header del workshop (etapas, ZIP, Hermes, ayuda). */
export const WorkshopHeaderIconButton = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  ({ className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(WORKSHOP_HEADER_ICON_BTN, className)} {...props} />
  ),
);
WorkshopHeaderIconButton.displayName = "WorkshopHeaderIconButton";

type WorkshopRailIconButtonProps = ComponentProps<"button"> & {
  /** Estado activo/seleccionado (relleno primary, icono claro). */
  selected?: boolean;
  /** Borde visible en reposo (marca, colapsar sidebar). */
  outlined?: boolean;
  /** `compact` (32px) para la lista de pasos del sidebar; `default` (36px) para controles sueltos. */
  size?: "default" | "compact";
};

const workshopRailIconSelectedClass = SIDEBAR_RAIL_ICON_BTN_SELECTED;

/** Icono del rail del sidebar — reposo transparente; activo con relleno primary. */
export function WorkshopRailIconButton({
  selected,
  outlined,
  size = "compact",
  className,
  type = "button",
  ...props
}: WorkshopRailIconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        outlined ? SIDEBAR_RAIL_ICON_BTN_OUTLINED : SIDEBAR_RAIL_ICON_BTN_IDLE,
        size === "default" && "h-9 w-9 min-h-9 min-w-9",
        selected && workshopRailIconSelectedClass,
        className,
      )}
      {...props}
    />
  );
}

/** Icono Lucide para botones del toolbar de documentos (hover invertido). */
export function WorkshopDocToolbarIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return <Icon className={cn(WORKSHOP_DOC_TOOLBAR_ICON, className)} strokeWidth={2} aria-hidden />;
}

/** Icono del toolbar de documentos (preview, print, regen). */
export function WorkshopDocToolbarIconButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(WORKSHOP_DOC_TOOLBAR_ICON_BTN, WORKSHOP_BTN_SIZE_ICON, className)}
      {...props}
    />
  );
}

type WorkshopChatToolbarIconButtonProps = ComponentProps<"button"> & {
  tone?: "default" | "danger";
};

/** Icono del sidebar de conversación (re-valorar, borrar historial). */
export const WorkshopChatToolbarIconButton = forwardRef<
  HTMLButtonElement,
  WorkshopChatToolbarIconButtonProps
>(function WorkshopChatToolbarIconButton(
  { tone = "default", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        WORKSHOP_CHAT_TOOLBAR_ICON_BTN,
        tone === "danger" ? WORKSHOP_CHAT_TOOLBAR_ICON_BTN_DANGER_HOVER : null,
        className,
      )}
      {...props}
    />
  );
});
