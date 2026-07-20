import { WORKSHOP_INVERSE_ICON_BTN } from "@/constants/workshopDocToolbar";

/** Stage selector + “Nueva etapa” (primary controls with a light frame). */
export const WORKSHOP_HEADER_CTL =
  "h-9 min-h-9 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_78%,var(--muted))] text-sm font-medium text-[var(--foreground)] shadow-sm transition-[background-color,border-color,color] touch-manipulation";

export const WORKSHOP_HEADER_CTL_HOVER =
  "hover:bg-[color-mix(in_oklch,var(--muted)_52%,var(--card))] hover:border-[color-mix(in_oklch,var(--border)_88%,var(--foreground))]";

/** Workshop header: icon controls (etapas, ZIP, Ayuda) — outline + hover invertido. */
export const WORKSHOP_HEADER_ICON_BTN = WORKSHOP_INVERSE_ICON_BTN;
