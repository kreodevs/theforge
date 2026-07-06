/**
 * @fileoverview «Actividad del agente» nav block inside the workshop project tree
 * (parallel to Pasos del flujo). Items open full-width central panels in WorkshopView.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { cn } from "@/lib/utils";
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import {
  WORKSHOP_AGENT_PENDING_CHANGES_PANEL,
  buildWorkshopAgentActivityNavItems,
} from "@/utils/workshopDocNav";
import { WORKSHOP_DOC_NAV_BLOCKED_TITLE } from "@/utils/workshopAgentsBusy";
import { apiFetch, API_BASE } from "@/utils/apiClient";

const RAIL_CONTROL_SIZE = "size-10 shrink-0";
const RAIL_CONTROL_RADIUS = "rounded-[var(--radius-md)]";
const RAIL_CONTROL_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar)]";
const RAIL_CONTROL_SURFACE =
  "border border-[color-mix(in_oklch,var(--sidebar-border)_70%,var(--sidebar))] bg-[color-mix(in_oklch,var(--sidebar-foreground)_6%,var(--sidebar))] shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--sidebar-foreground)_8%,transparent)]";
const RAIL_CONTROL_INTERACTIVE =
  "transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] active:scale-[0.97]";
const railControlClass = (extra?: string) =>
  cn(
    "flex items-center justify-center",
    RAIL_CONTROL_SIZE,
    RAIL_CONTROL_RADIUS,
    RAIL_CONTROL_SURFACE,
    RAIL_CONTROL_FOCUS,
    RAIL_CONTROL_INTERACTIVE,
    extra,
  );
const railControlActiveClass = (extra?: string) =>
  cn(
    "flex items-center justify-center",
    RAIL_CONTROL_SIZE,
    RAIL_CONTROL_RADIUS,
    RAIL_CONTROL_FOCUS,
    "border border-[color-mix(in_oklch,var(--primary)_28%,transparent)] bg-[color-mix(in_oklch,var(--primary)_14%,var(--sidebar))] text-[var(--sidebar-foreground)] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_28%,transparent)] transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_20%,var(--sidebar))]",
    extra,
  );

export interface WorkshopAgentActivitySidebarSectionProps {
  projectId: string;
  stageId: string | null | undefined;
  /** Collapsed icon rail (lg+). */
  rail: boolean;
  activeDocPanel: string;
  workshopAgentsBusy: boolean;
  onSelectPanel: (panelId: string) => void;
  /** Incrementar para refrescar badge tras cascada/regeneración. */
  refreshToken?: number;
}

function CollapsedRailHint({
  rail,
  label,
  children,
}: {
  rail: boolean;
  label: string;
  children: ReactElement;
}) {
  if (!rail) return children;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" align="center" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function WorkshopAgentActivitySidebarSection({
  projectId,
  stageId,
  rail,
  activeDocPanel,
  workshopAgentsBusy,
  onSelectPanel,
  refreshToken,
}: WorkshopAgentActivitySidebarSectionProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const navItems = buildWorkshopAgentActivityNavItems();

  const fetchPendingCount = useCallback(async () => {
    if (!projectId || !stageId) return;
    try {
      const r = await apiFetch(
        `${API_BASE}/projects/${projectId}/stages/${stageId}/documentation-gaps?status=pending`,
      );
      if (!r.ok) return;
      const data = (await r.json()) as { gaps?: unknown[] };
      setPendingCount(data.gaps?.length ?? 0);
    } catch {
      /* badge opcional */
    }
  }, [projectId, stageId]);

  useEffect(() => {
    void fetchPendingCount();
  }, [fetchPendingCount, activeDocPanel, refreshToken]);

  if (!stageId) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 shrink-0 flex-col",
        rail ? "mt-1 px-0" : "mt-3 overflow-hidden border-t border-[color-mix(in_oklch,var(--sidebar-border)_75%,var(--sidebar))] pt-2.5",
      )}
      role="group"
      aria-label="Actividad del agente"
    >
      <p
        className={cn(
          "mb-1.5 shrink-0 px-1 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]",
          rail && "hidden",
        )}
      >
        Actividad del agente
      </p>
      <ul
        className={cn(
          "relative m-0 list-none p-0",
          rail ? "flex flex-col items-center gap-1 py-0.5" : "space-y-0.5 py-0.5",
        )}
        role="list"
        aria-label="Actividad del agente"
      >
        {navItems.map((item) => {
          const Icon = item.Icon;
          const isCurrent = activeDocPanel === item.id;
          const showPendingBadge =
            item.id === WORKSHOP_AGENT_PENDING_CHANGES_PANEL && pendingCount > 0;
          return (
            <li key={item.id} className={cn("relative shrink-0", !rail && "pl-5 lg:pl-6")}>
              {!rail && isCurrent ? (
                <span
                  className="absolute left-[0.8125rem] top-1/2 z-[1] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--sidebar)] bg-[var(--primary)] shadow-sm"
                  aria-hidden
                />
              ) : null}
              <CollapsedRailHint
                rail={rail}
                label={
                  showPendingBadge
                    ? `${item.label} · ${pendingCount} pendiente${pendingCount === 1 ? "" : "s"} · ${item.title}`
                    : `${item.label} · ${item.title}`
                }
              >
                <button
                  type="button"
                  role="listitem"
                  aria-current={isCurrent ? "page" : undefined}
                  disabled={workshopAgentsBusy}
                  title={
                    workshopAgentsBusy
                      ? WORKSHOP_DOC_NAV_BLOCKED_TITLE
                      : `${item.title}${showPendingBadge ? ` — ${pendingCount} pendiente(s)` : ""}`
                  }
                  onClick={() => {
                    if (workshopAgentsBusy) return;
                    onSelectPanel(item.id);
                  }}
                  className={cn(
                    "flex min-w-0 items-center font-medium transition-colors",
                    rail
                      ? cn(
                          "relative mx-auto box-border shrink-0 p-0",
                          isCurrent
                            ? railControlActiveClass("text-[var(--primary)]")
                            : railControlClass("text-[var(--muted-foreground)]"),
                        )
                      : cn(
                          "mb-px w-full gap-2.5 rounded-md px-2 py-1.5 text-left text-sm last:mb-0",
                          isCurrent
                            ? "bg-[color-mix(in_oklch,var(--sidebar-accent)_100%,transparent)] text-[var(--sidebar-accent-foreground)]"
                            : "text-[color-mix(in_oklch,var(--muted-foreground)_96%,var(--sidebar-foreground))] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_72%,transparent)]",
                        ),
                  )}
                >
                  {rail ? (
                    <span className="relative flex size-5 items-center justify-center" aria-hidden>
                      <Icon
                        className={cn(
                          "size-4",
                          isCurrent ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
                        )}
                      />
                      {showPendingBadge ? (
                        <span
                          className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--warning)_88%,var(--foreground))] px-0.5 text-[8px] font-bold leading-none text-[var(--sidebar)] ring-2 ring-[var(--sidebar)]"
                          aria-hidden
                        >
                          {pendingCount > 9 ? "9+" : pendingCount}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <>
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 opacity-90",
                          isCurrent
                            ? "text-[var(--primary)]"
                            : item.id === WORKSHOP_AGENT_PENDING_CHANGES_PANEL
                              ? "text-[color-mix(in_oklch,var(--warning)_75%,var(--foreground))]"
                              : "text-[color-mix(in_oklch,var(--muted-foreground)_92%,var(--sidebar-foreground))]",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-left leading-snug">{item.label}</span>
                      {showPendingBadge ? (
                        <Badge
                          variant="secondary"
                          className="h-5 min-w-5 shrink-0 justify-center border-[color-mix(in_oklch,var(--warning)_40%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_14%,var(--sidebar))] px-1.5 py-0 text-[10px] font-semibold tabular-nums text-[color-mix(in_oklch,var(--warning)_88%,var(--foreground))]"
                        >
                          {pendingCount}
                        </Badge>
                      ) : null}
                    </>
                  )}
                </button>
              </CollapsedRailHint>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
