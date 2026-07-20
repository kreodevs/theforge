import type { RefObject, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WorkshopDocBubbleMenu, type WorkshopDocBubbleMenuItem } from "@/components/WorkshopDocBubbleMenu";
import { WorkshopDocToolbar } from "./WorkshopDocToolbar";
import type { WorkshopDocToolbarProps } from "./workshopDocToolbar.types";

export type { WorkshopDocToolbarProps } from "./workshopDocToolbar.types";

export interface WorkshopDocPanelProps {
  mobileWorkshopColumn: "chat" | "workspace" | "metrics";
  workspaceScrollRef: RefObject<HTMLDivElement | null>;
  toolbarProps: WorkshopDocToolbarProps;
  isLgLayout: boolean;
  docBubbleMenuItems: WorkshopDocBubbleMenuItem[];
  children: ReactNode;
}

/** Columna B del Workshop: toolbar de documento + área scrollable + bubble menu en desktop. */
export function WorkshopDocPanel({
  mobileWorkshopColumn,
  workspaceScrollRef,
  toolbarProps,
  isLgLayout,
  docBubbleMenuItems,
  children,
}: WorkshopDocPanelProps) {
  return (
    <section
      className={cn(
        "relative min-h-0 min-w-0 overflow-hidden border-r border-[var(--border)] lg:min-h-0 lg:flex-1 lg:overflow-visible",
        "flex flex-col",
        mobileWorkshopColumn === "workspace"
          ? "flex min-h-0 flex-1"
          : "hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col",
      )}
    >
      <WorkshopDocToolbar {...toolbarProps} />
      <div
        ref={workspaceScrollRef as RefObject<HTMLDivElement>}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4"
      >
        {children}
      </div>
      {isLgLayout ? (
        <div className="pointer-events-none absolute inset-0 z-20 hidden overflow-visible lg:block">
          <WorkshopDocBubbleMenu items={docBubbleMenuItems} />
        </div>
      ) : null}
    </section>
  );
}
