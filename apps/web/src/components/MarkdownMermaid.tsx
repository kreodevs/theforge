/**
 * Renders ```mermaid fenced blocks from ReactMarkdown as SVG (MDD viewer, tutorial, help).
 * Supports fullscreen expand for dense diagrams (ER, flowcharts).
 */
import {
  Children,
  Component,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Maximize2, Loader2, RotateCcw, Sparkles, Wrench, ZoomIn, ZoomOut } from "lucide-react";
import {
  stripMermaidFenceWrappers,
} from "@theforge/shared-types/mermaid";
import {
  prepareMermaidForRender,
} from "./mermaid-render-prep.util";
import {
  assessMermaidFixStrategy,
  repairMermaidBlockForRender,
} from "./mermaid-fix.util";
import { regenerateMermaidDiagram } from "@/lib/mermaid-api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const MERMAID_DIAGRAM_START =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|journey|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey-beta|xychart-beta|block-beta)\b/i;

export const MERMAID_BLOCK_MARKER = "data-theforge-mermaid";

type MermaidApi = typeof import("mermaid").default;

let mermaidModule: MermaidApi | null = null;
let mermaidLoadPromise: Promise<MermaidApi> | null = null;
let mermaidInitialized = false;

function loadMermaidModule(): Promise<MermaidApi> {
  if (mermaidModule) return Promise.resolve(mermaidModule);
  if (!mermaidLoadPromise) {
    mermaidLoadPromise = import("mermaid").then((mod) => {
      mermaidModule = mod.default;
      return mermaidModule;
    });
  }
  return mermaidLoadPromise;
}

async function initMermaid(): Promise<MermaidApi> {
  const mermaid = await loadMermaidModule();
  if (!mermaidInitialized) {
    mermaidInitialized = true;
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
    });
  }
  return mermaid;
}

export function mermaidKey(content: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(content.length, 256); i++) h = (h << 5) - h + content.charCodeAt(i);
  return `mermaid-${h >>> 0}`;
}

export function defaultPrepareMermaidForRender(content: string): string {
  return prepareMermaidForRender(content);
}

function looksLikeMermaidBlock(source: string, className?: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (/\blanguage-mermaid\b/i.test(className ?? "")) return true;
  return MERMAID_DIAGRAM_START.test(trimmed);
}

function flattenMarkdownChildren(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement(child) && child.props && typeof child.props === "object") {
        const props = child.props as { children?: ReactNode };
        if (props.children != null) return flattenMarkdownChildren(props.children);
      }
      return "";
    })
    .join("");
}

function extractCodeBlockSource(
  _className: string | undefined,
  children: ReactNode,
  node?: unknown,
): string {
  const fromNode =
    node &&
    typeof node === "object" &&
    "value" in node &&
    typeof (node as { value?: unknown }).value === "string"
      ? (node as { value: string }).value
      : "";
  const fromChildren = flattenMarkdownChildren(children);
  const raw =
    (fromNode || fromChildren || (Array.isArray(children) ? children.join("") : String(children ?? "")))
      .replace(/\n$/, "")
      .trim();
  return raw;
}

function useMermaidSvg(
  content: string,
  renderId: string,
  prepareContent: (raw: string) => string,
  onErrorChange?: (failed: boolean) => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !content.trim()) return;

    setError(null);
    setReady(false);
    onErrorChange?.(false);
    let cancelled = false;
    const toRender = stripMermaidFenceWrappers(prepareContent(content)).trim();
    if (!toRender || /^```/m.test(toRender)) return;

    const doRender = async () => {
      try {
        const mermaid = await initMermaid();
        const { svg, bindFunctions } = await mermaid.render(renderId, toRender);
        if (cancelled || !el) return;
        el.innerHTML = svg;
        bindFunctions?.(el);
        setReady(true);
        onErrorChange?.(false);
      } catch (e) {
        if (!cancelled) {
          console.error("Mermaid render error:", e);
          setError("render_failed");
          onErrorChange?.(true);
        }
      }
    };

    void doRender();

    return () => {
      cancelled = true;
    };
  }, [content, renderId, prepareContent, onErrorChange]);

  return { ref, error, ready };
}

export class MermaidBlockErrorBoundary extends Component<
  { content: string; blockKey: string; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error("MermaidBlockErrorBoundary:", err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <pre className="my-6 overflow-x-auto rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_78%,var(--card))] p-3 text-sm text-[var(--foreground)]">
          <code>{this.props.content}</code>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]" aria-live="polite">
            No se pudo mostrar el diagrama (código fuente arriba).
          </p>
        </pre>
      );
    }
    return this.props.children;
  }
}

type MermaidDiagramBlockProps = {
  content: string;
  blockKey: string;
  prepareContent?: (raw: string) => string;
  enableFullscreen?: boolean;
  enableRepair?: boolean;
  svgClassName?: string;
};

function MermaidSvgCanvas({
  content,
  renderId,
  prepareContent,
  className,
  onReadyChange,
  onErrorChange,
}: {
  content: string;
  renderId: string;
  prepareContent: (raw: string) => string;
  className?: string;
  onReadyChange?: (ready: boolean) => void;
  onErrorChange?: (failed: boolean) => void;
}) {
  const { ref, error, ready } = useMermaidSvg(content, renderId, prepareContent, onErrorChange);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_78%,var(--card))] p-3 text-sm text-[var(--foreground)]">
        <code>{content}</code>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]" aria-live="polite">
          No se pudo mostrar el diagrama (código fuente arriba).
        </p>
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className={cn("flex min-h-[120px] justify-center [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:min-w-0", className)}
    />
  );
}

const PAN_ZOOM_MIN = 0.15;
const PAN_ZOOM_MAX = 4;
const PAN_ZOOM_FIT_PADDING = 40;

function clampPanZoomScale(scale: number): number {
  return Math.min(PAN_ZOOM_MAX, Math.max(PAN_ZOOM_MIN, scale));
}

type PanZoomState = { scale: number; x: number; y: number };

/** Mermaid suele emitir width="100%"; dentro de un inline-block colapsa — usar viewBox/intrínseco. */
export function normalizeMermaidSvgSizing(container: HTMLElement): { width: number; height: number } | null {
  const svg = container.querySelector("svg");
  if (!svg) return null;

  svg.style.maxWidth = "none";
  svg.style.width = "auto";
  svg.style.height = "auto";
  svg.removeAttribute("width");
  svg.removeAttribute("height");

  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const w = parts[2]!;
      const h = parts[3]!;
      if (w > 0 && h > 0) {
        svg.setAttribute("width", String(w));
        svg.setAttribute("height", String(h));
      }
    }
  }

  const width = svg.getBoundingClientRect().width || svg.clientWidth || 0;
  const height = svg.getBoundingClientRect().height || svg.clientHeight || 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

export function computeMermaidFitTransform(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  padding = PAN_ZOOM_FIT_PADDING,
): PanZoomState {
  if (viewportW <= 0 || viewportH <= 0 || contentW <= 0 || contentH <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }
  const availW = Math.max(1, viewportW - padding * 2);
  const availH = Math.max(1, viewportH - padding * 2);
  const scale = clampPanZoomScale(Math.min(availW / contentW, availH / contentH));
  return {
    scale,
    x: (viewportW - contentW * scale) / 2,
    y: (viewportH - contentH * scale) / 2,
  };
}

/** Vista fullscreen: arrastrar para desplazar, rueda para zoom hacia el cursor. */
function MermaidPanZoomViewport({
  children,
  resetKey,
  contentReady,
}: {
  children: ReactNode;
  resetKey: string;
  contentReady: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PanZoomState>({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const applyState = useCallback((next: PanZoomState) => {
    setState(next);
  }, []);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    normalizeMermaidSvgSizing(content);
    const contentW = content.scrollWidth || content.offsetWidth;
    const contentH = content.scrollHeight || content.offsetHeight;
    applyState(
      computeMermaidFitTransform(
        viewport.clientWidth,
        viewport.clientHeight,
        contentW,
        contentH,
      ),
    );
  }, [applyState]);

  const resetView = useCallback(() => {
    fitToView();
  }, [fitToView]);

  const zoomAt = useCallback((factor: number, anchorX: number, anchorY: number) => {
    setState((prev) => {
      const nextScale = clampPanZoomScale(prev.scale * factor);
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        x: anchorX - (anchorX - prev.x) * ratio,
        y: anchorY - (anchorY - prev.y) * ratio,
      };
    });
  }, []);

  const zoomCenter = useCallback(
    (factor: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAt(factor, rect.width / 2, rect.height / 2);
    },
    [zoomAt],
  );

  useEffect(() => {
    if (!contentReady) return;
    let cancelled = false;
    const runFit = () => {
      if (!cancelled) fitToView();
    };
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(runFit);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [resetKey, contentReady, fitToView]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      zoomAt(factor, mx, my);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomCenter(1.15);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomCenter(1 / 1.15);
      } else if (e.key === "0") {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetView, zoomCenter]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setState((prev) => {
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: prev.x,
        panY: prev.y,
      };
      return prev;
    });
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setState((prev) => ({
      ...prev,
      x: drag.panX + (e.clientX - drag.startX),
      y: drag.panY + (e.clientY - drag.startY),
    }));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={viewportRef}
      className={cn(
        "absolute inset-0 overflow-hidden touch-none select-none bg-[var(--background)]",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={resetView}
      role="application"
      aria-label="Diagrama con zoom y desplazamiento"
    >
      <div
        className="pointer-events-auto absolute bottom-4 right-4 z-[1] flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)]/95 p-1 shadow-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          onClick={() => zoomCenter(1 / 1.2)}
          aria-label="Alejar"
        >
          <ZoomOut className="h-4 w-4" aria-hidden />
        </Button>
        <span className="min-w-[3rem] px-1 text-center text-xs tabular-nums text-[var(--muted-foreground)]">
          {Math.round(state.scale * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          onClick={() => zoomCenter(1.2)}
          aria-label="Acercar"
        >
          <ZoomIn className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          onClick={resetView}
          aria-label="Restablecer zoom"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div
        ref={contentRef}
        className="absolute left-0 top-0 inline-block will-change-transform"
        style={{
          transform: `translate(${state.x}px, ${state.y}px) scale(${state.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Inline Mermaid block with optional fullscreen overlay. */
export function MermaidDiagramBlock({
  content,
  blockKey,
  prepareContent = defaultPrepareMermaidForRender,
  enableFullscreen = true,
  enableRepair = true,
  svgClassName,
}: MermaidDiagramBlockProps) {
  const instanceId = useId();
  const [displayContent, setDisplayContent] = useState(content);
  const [repairGeneration, setRepairGeneration] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [inlineReady, setInlineReady] = useState(false);
  const [inlineFailed, setInlineFailed] = useState(false);
  const [fullscreenReady, setFullscreenReady] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

  const fixAssessment = assessMermaidFixStrategy(displayContent);
  const fixLabel = fixAssessment.strategy === "regenerate" ? "Regenerar" : "Reparar";
  const FixIcon = fixAssessment.strategy === "regenerate" ? Sparkles : Wrench;

  useEffect(() => {
    setDisplayContent(content);
    setRepairGeneration(0);
    setInlineFailed(false);
    setFixError(null);
  }, [content]);

  const inlineRenderIdRef = useRef("");
  if (!inlineRenderIdRef.current) {
    inlineRenderIdRef.current =
      "m" +
      instanceId.replace(/[^a-zA-Z0-9]/g, "") +
      blockKey.replace(/[^a-zA-Z0-9]/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 9);
  }

  const inlineRenderId = `${inlineRenderIdRef.current}-r${repairGeneration}`;

  const fullscreenRenderIdRef = useRef("");
  if (!fullscreenRenderIdRef.current) {
    fullscreenRenderIdRef.current = `${inlineRenderIdRef.current}-fs`;
  }

  const fullscreenRenderId = `${fullscreenRenderIdRef.current}-r${repairGeneration}`;

  const handleInlineReady = useCallback((ready: boolean) => {
    setInlineReady(ready);
  }, []);

  const handleInlineError = useCallback((failed: boolean) => {
    setInlineFailed(failed);
    if (failed) setInlineReady(false);
  }, []);

  const handleFix = useCallback(async () => {
    const assessment = assessMermaidFixStrategy(displayContent);
    setFixError(null);
    setInlineReady(false);
    setInlineFailed(false);

    if (assessment.strategy === "repair") {
      const repaired =
        assessment.repairedPreview.trim() || repairMermaidBlockForRender(displayContent);
      setDisplayContent(repaired);
      setRepairGeneration((g) => g + 1);
      return;
    }

    setIsFixing(true);
    try {
      const regenerated = await regenerateMermaidDiagram(displayContent);
      setDisplayContent(regenerated);
      setRepairGeneration((g) => g + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo regenerar el diagrama";
      setFixError(msg);
      setInlineFailed(true);
    } finally {
      setIsFixing(false);
    }
  }, [displayContent]);

  const handleOpenFullscreen = useCallback(() => {
    setFullscreenReady(false);
    setFullscreenOpen(true);
  }, []);

  const handleFullscreenReady = useCallback((ready: boolean) => {
    setFullscreenReady(ready);
  }, []);

  const toolbarVisibility =
    inlineFailed
      ? "opacity-100"
      : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

  const showToolbar = inlineReady || inlineFailed;

  return (
    <>
      <div
        {...{ [MERMAID_BLOCK_MARKER]: "1" }}
        className="group relative my-6 block w-full min-w-0 [isolation:isolate] overflow-x-auto rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] p-3"
        aria-label="Diagrama Mermaid"
      >
        {enableRepair && showToolbar ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isFixing}
            className={cn(
              "absolute left-2 top-2 z-[1] h-8 gap-1.5 bg-[var(--card)]/95 px-2.5 text-xs shadow-sm",
              toolbarVisibility,
            )}
            onClick={() => void handleFix()}
            aria-label={`${fixLabel} diagrama Mermaid`}
            title={
              fixAssessment.reasons.length
                ? fixAssessment.reasons.slice(0, 3).join(" · ")
                : undefined
            }
          >
            {isFixing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FixIcon className="h-3.5 w-3.5" aria-hidden />
            )}
            {isFixing ? "…" : fixLabel}
          </Button>
        ) : null}
        {fixError ? (
          <p className="mb-2 pr-28 text-xs text-[var(--destructive)]" role="alert">
            {fixError}
          </p>
        ) : null}
        {enableFullscreen && showToolbar ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn(
              "absolute right-2 top-2 z-[1] h-8 gap-1.5 bg-[var(--card)]/95 px-2.5 text-xs shadow-sm",
              toolbarVisibility,
            )}
            onClick={handleOpenFullscreen}
            aria-label="Ver diagrama a pantalla completa"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            Pantalla completa
          </Button>
        ) : null}
        <MermaidSvgCanvas
          content={displayContent}
          renderId={inlineRenderId}
          prepareContent={prepareContent}
          className={svgClassName}
          onReadyChange={handleInlineReady}
          onErrorChange={handleInlineError}
        />
      </div>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          showClose
          aria-describedby="mermaid-fullscreen-desc"
          className="fixed inset-0 left-0 top-0 z-[var(--z-modal)] flex h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 shadow-none sm:rounded-none"
        >
          <DialogTitle className="sr-only">Diagrama Mermaid — pantalla completa</DialogTitle>
          <DialogDescription id="mermaid-fullscreen-desc" className="sr-only">
            Vista ampliada del diagrama con zoom y desplazamiento. Arrastra para mover, usa la rueda
            del ratón para zoom, o Esc para cerrar.
          </DialogDescription>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {enableRepair ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFixing}
                  className="h-8 shrink-0 gap-1.5 text-xs"
                  onClick={() => void handleFix()}
                  aria-label={`${fixLabel} diagrama Mermaid`}
                >
                  {isFixing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <FixIcon className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isFixing ? "…" : fixLabel}
                </Button>
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">Diagrama Mermaid</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Arrastrar para desplazar · Rueda para zoom · Doble clic restablece
                </p>
              </div>
            </div>
            <p className="hidden shrink-0 text-xs text-[var(--muted-foreground)] sm:block">Esc para cerrar</p>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {fullscreenOpen ? (
              <MermaidPanZoomViewport resetKey={`${blockKey}-${repairGeneration}`} contentReady={fullscreenReady}>
                <MermaidSvgCanvas
                  content={displayContent}
                  renderId={fullscreenRenderId}
                  prepareContent={prepareContent}
                  className="block [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-none [&_svg]:w-auto"
                  onReadyChange={handleFullscreenReady}
                />
              </MermaidPanZoomViewport>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function preWrapsMermaidBlock(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) =>
      isValidElement(child) &&
      typeof child.props === "object" &&
      child.props !== null &&
      MERMAID_BLOCK_MARKER in (child.props as Record<string, unknown>),
  );
}

type MarkdownCodeProps = ComponentPropsWithoutRef<"code"> & { node?: unknown };

/** Returns a Mermaid SVG block, or null if the fenced block is not Mermaid. */
export function tryRenderMarkdownMermaid(props: MarkdownCodeProps): ReactNode | null {
  const { className, children, node } = props;
  const source = extractCodeBlockSource(className, children, node);
  if (!looksLikeMermaidBlock(source, className) || !source.trim()) return null;

  const normalized = defaultPrepareMermaidForRender(source.trim());
  if (!normalized.trim()) return null;

  const key = mermaidKey(normalized);
  return (
    <MermaidBlockErrorBoundary content={normalized} blockKey={key}>
      <MermaidDiagramBlock key={key} blockKey={key} content={normalized} />
    </MermaidBlockErrorBoundary>
  );
}

/** Skips the default `<pre>` wrapper when the child is an rendered Mermaid block. */
export function MarkdownMermaidPre({
  children,
  ...props
}: ComponentPropsWithoutRef<"pre">) {
  if (preWrapsMermaidBlock(children)) {
    return <>{children}</>;
  }
  return <pre {...props}>{children}</pre>;
}
