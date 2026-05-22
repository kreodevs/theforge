import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, Settings2 } from "lucide-react";
import { ProviderLogo, getProviderLabel } from "./ProviderLogo";
import { WorkshopChatToolbarIconButton } from "./WorkshopButtons";
import { useActiveProviderInfo } from "@/hooks/useActiveProviderInfo";
import { cn } from "@/lib/utils";

interface ChatProviderInfoButtonProps {
  onOpenSettings?: () => void;
}

const PANEL_WIDTH_PX = 288;
const PANEL_GAP_PX = 6;
const VIEWPORT_PADDING_PX = 8;

function getViewportBox() {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetTop: vv?.offsetTop ?? 0,
    offsetLeft: vv?.offsetLeft ?? 0,
  };
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </span>
      <span className="break-all text-xs leading-snug text-[var(--foreground)]">{value}</span>
    </div>
  );
}

export function ChatProviderInfoButton({ onOpenSettings }: ChatProviderInfoButtonProps) {
  const { info, loading, error } = useActiveProviderInfo();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const instance = info.instance;
  const personal = info.personalConfig;
  const providerType = instance?.providerType ?? personal?.provider ?? null;
  const displayName =
    instance?.displayName ?? (personal ? getProviderLabel(personal.provider) : null);
  const chatModel = instance?.chatModel ?? personal?.chatModel ?? null;
  const auditorModel = instance?.auditorChatModel?.trim() || chatModel;
  const apiKeyHint = instance?.apiKeyHint ?? personal?.apiKeyHint ?? null;

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewport = getViewportBox();
    const chatColumn = trigger.closest(".workshop-chat-column");
    const chatRect = chatColumn?.getBoundingClientRect();

    const panelHeight = panelRef.current?.offsetHeight ?? 280;
    const maxPanelWidth = chatRect
      ? Math.max(200, chatRect.width - VIEWPORT_PADDING_PX * 2)
      : Math.max(200, viewport.width - VIEWPORT_PADDING_PX * 2);
    const width = Math.min(PANEL_WIDTH_PX, maxPanelWidth);

    const minLeft = chatRect
      ? chatRect.left + VIEWPORT_PADDING_PX
      : viewport.offsetLeft + VIEWPORT_PADDING_PX;
    const maxLeft = chatRect
      ? chatRect.right - width - VIEWPORT_PADDING_PX
      : viewport.offsetLeft + viewport.width - width - VIEWPORT_PADDING_PX;

    const left = Math.min(Math.max(minLeft, rect.left), Math.max(minLeft, maxLeft));

    const spaceBelow =
      viewport.offsetTop + viewport.height - rect.bottom - PANEL_GAP_PX - VIEWPORT_PADDING_PX;
    const spaceAbove = rect.top - viewport.offsetTop - PANEL_GAP_PX - VIEWPORT_PADDING_PX;
    const openBelow = spaceBelow >= panelHeight || spaceBelow >= spaceAbove;
    const top = openBelow
      ? rect.bottom + PANEL_GAP_PX
      : Math.max(
          viewport.offsetTop + VIEWPORT_PADDING_PX,
          rect.top - PANEL_GAP_PX - panelHeight,
        );

    const maxHeight = openBelow
      ? Math.max(160, spaceBelow)
      : Math.max(160, spaceAbove);

    setPanelStyle({
      top,
      left,
      width,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const panel = panelRef.current;
    if (!panel) return;
    const ro = new ResizeObserver(() => updatePanelPosition());
    ro.observe(panel);
    return () => ro.disconnect();
  }, [open, updatePanelPosition, info, error, loading]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.visualViewport?.addEventListener("resize", onReposition);
    window.visualViewport?.addEventListener("scroll", onReposition);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.visualViewport?.removeEventListener("resize", onReposition);
      window.visualViewport?.removeEventListener("scroll", onReposition);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Proveedor de IA activo"
            style={panelStyle}
            className="fixed z-[var(--z-popover)] flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-lg overscroll-contain"
          >
            <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                {providerType ? (
                  <ProviderLogo provider={providerType} size="sm" className="mt-0.5" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight text-[var(--foreground)]">
                    {displayName ?? "Sin proveedor configurado"}
                  </p>
                  {providerType ? (
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {getProviderLabel(providerType)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
              {error ? (
                <p className="text-xs text-[var(--destructive)]">{error}</p>
              ) : info.source === "none" ? (
                <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                  Configura una instancia del equipo o tu clave API en ajustes para usar generación y
                  análisis.
                </p>
              ) : (
                <>
                  <InfoRow label="Modelo de chat" value={chatModel} />
                  <InfoRow label="Modelo auditor" value={auditorModel} />
                  {instance?.chatModelFallbacks?.length ? (
                    <InfoRow
                      label="Modelos de respaldo"
                      value={instance.chatModelFallbacks.join(", ")}
                    />
                  ) : personal?.chatModelFallbacks?.length ? (
                    <InfoRow
                      label="Modelos de respaldo"
                      value={personal.chatModelFallbacks.join(", ")}
                    />
                  ) : null}
                  {instance?.embeddingModel ?? personal?.embeddingModel ? (
                    <InfoRow
                      label="Embeddings"
                      value={instance?.embeddingModel ?? personal?.embeddingModel ?? null}
                    />
                  ) : null}
                  {instance?.visionModel ?? personal?.visionModel ? (
                    <InfoRow
                      label="Visión"
                      value={instance?.visionModel ?? personal?.visionModel ?? null}
                    />
                  ) : null}
                  {instance?.sttModel ?? personal?.sttModel ? (
                    <InfoRow
                      label="Transcripción (STT)"
                      value={instance?.sttModel ?? personal?.sttModel ?? null}
                    />
                  ) : null}
                  {apiKeyHint ? <InfoRow label="Clave API" value={apiKeyHint} /> : null}
                </>
              )}

              {onOpenSettings ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                >
                  <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Ir a ajustes
                </button>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <WorkshopChatToolbarIconButton
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Ver proveedor de IA activo"
        title="Proveedor de IA activo"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className={cn(open && "border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] bg-[var(--muted)]")}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : providerType ? (
          <ProviderLogo
            provider={providerType}
            size="sm"
            className="h-7 w-7 rounded-lg border-0 bg-transparent shadow-none"
          />
        ) : (
          <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
        )}
      </WorkshopChatToolbarIconButton>
      {panel}
    </>
  );
}
