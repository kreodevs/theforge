import type { ReactNode } from "react";

export interface WorkshopLayoutShellProps {
  chatColumn: ReactNode;
  docPanel: ReactNode;
  metricsColumn: ReactNode;
  mobileOverlays?: ReactNode;
  mobileNav: ReactNode;
  modals?: ReactNode;
}

/** Grid principal del workshop: chat + documentos + métricas (lg) con overlays móviles. */
export function WorkshopLayoutShell({
  chatColumn,
  docPanel,
  metricsColumn,
  mobileOverlays,
  mobileNav,
  modals,
}: WorkshopLayoutShellProps) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:flex-row lg:items-stretch lg:min-h-0">
      {chatColumn}
      {docPanel}
      {metricsColumn}
      {mobileOverlays}
      {mobileNav}
      {modals}
    </div>
  );
}
