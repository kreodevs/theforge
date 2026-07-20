import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import type { WorkshopMobileColumn } from "./workshopMetricsColumn.types";

export interface WorkshopChatColumnProps {
  mobileWorkshopColumn: WorkshopMobileColumn;
  isLgLayout: boolean;
  lgWorkshopChatCollapsed: boolean;
  lgChatPanelWidthPx: number;
  lgChatPanelResizing: boolean;
  chatSectionRef: RefObject<HTMLElement | null>;
  onExpandChat: () => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeLostPointerCapture: () => void;
  children: ReactNode;
}

/** Columna A: chat + rail de expansión (lg) con resize horizontal. */
export function WorkshopChatColumn({
  mobileWorkshopColumn,
  isLgLayout,
  lgWorkshopChatCollapsed,
  lgChatPanelWidthPx,
  lgChatPanelResizing,
  chatSectionRef,
  onExpandChat,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizeLostPointerCapture,
  children,
}: WorkshopChatColumnProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 shrink-0 flex-col lg:flex-row lg:items-stretch lg:min-h-0 lg:overflow-visible",
        mobileWorkshopColumn === "chat" ? "flex min-h-0 flex-1" : "hidden lg:flex lg:min-h-0 lg:self-stretch",
      )}
    >
      <div
        className={cn(
          "workshop-chat-column relative flex min-h-0 min-w-0 flex-col self-stretch overflow-hidden border-r border-[var(--border)] lg:shrink-0",
          mobileWorkshopColumn === "chat" ? "flex-1" : "lg:min-h-0",
          !lgChatPanelResizing &&
            "lg:transition-[width] lg:duration-300 lg:ease-out motion-reduce:lg:transition-none",
          isLgLayout && lgWorkshopChatCollapsed
            ? "lg:w-0 lg:min-w-0 lg:border-transparent lg:pointer-events-none"
            : "lg:max-w-[420px]",
        )}
        style={
          isLgLayout && !lgWorkshopChatCollapsed
            ? { width: lgChatPanelWidthPx, minWidth: 0 }
            : undefined
        }
      >
        <section
          ref={chatSectionRef as RefObject<HTMLElement>}
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden",
            mobileWorkshopColumn === "chat" ? "min-h-0 flex-1" : "lg:min-h-0 lg:flex-col",
          )}
          aria-hidden={isLgLayout && lgWorkshopChatCollapsed ? true : undefined}
        >
          {children}
        </section>
        {!lgWorkshopChatCollapsed ? (
          <div
            className={cn(
              "pointer-events-auto absolute inset-y-0 z-30 hidden w-2 -right-1 cursor-col-resize touch-none select-none lg:block",
              "hover:bg-[color-mix(in_oklch,var(--primary)_16%,transparent)] active:bg-[color-mix(in_oklch,var(--primary)_22%,transparent)]",
            )}
            style={{ cursor: "col-resize" }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar el chat. Si sueltas con el panel más estrecho que el mínimo, se colapsa; usa el botón Chat o el icono en la barra del documento para volver a mostrarlo."
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            onLostPointerCapture={onResizeLostPointerCapture}
          />
        ) : null}
      </div>
      <div
        className={cn(
          "hidden min-h-0 flex-col border-r border-[var(--border)] bg-transparent transition-[width,opacity,min-width,padding] duration-300 ease-out motion-reduce:transition-none lg:flex",
          lgWorkshopChatCollapsed
            ? "w-[2rem] min-w-[2rem] shrink-0 self-stretch items-center justify-center py-2"
            : "w-0 min-w-0 overflow-hidden border-transparent p-0 opacity-0 pointer-events-none",
        )}
        aria-hidden={!lgWorkshopChatCollapsed}
      >
        <TooltipProvider delayDuration={280}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onExpandChat}
                className={cn(
                  "group/pull-tab-chat relative z-[2] flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-0 bg-transparent px-0.5 py-3 shadow-none ring-0",
                  "text-[8px] font-semibold uppercase tracking-[0.14em] text-[color-mix(in_oklch,var(--foreground)_82%,var(--muted-foreground))]",
                  "transition-[color,background-color] duration-200 ease-out",
                  "hover:bg-[color-mix(in_oklch,var(--muted)_35%,transparent)] hover:text-[var(--primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                )}
                title="Mostrar conversación"
                aria-label="Mostrar conversación"
              >
                <MessageSquare
                  className="h-3 w-3 shrink-0 text-[color-mix(in_oklch,var(--foreground)_88%,var(--muted-foreground))] transition-colors duration-200 group-hover/pull-tab-chat:text-[var(--primary)]"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="select-none uppercase leading-tight [writing-mode:vertical-rl] rotate-180">
                  Chat
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[14rem]">
              Mostrar conversación
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
