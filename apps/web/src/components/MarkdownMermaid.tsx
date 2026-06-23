/**
 * Renders ```mermaid fenced blocks from ReactMarkdown as SVG (shared by tutorial/help modals).
 */
import {
  Children,
  Component,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import mermaid from "mermaid";
import {
  normalizeMermaidDiagramBody,
  splitMermaidBodyAndTrailingProse,
  stripMarkdownLeakFromMermaidDiagramBody,
} from "@theforge/shared-types/mermaid";

const MERMAID_DIAGRAM_START =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|journey|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey-beta|xychart-beta|block-beta)\b/i;

const MERMAID_BLOCK_MARKER = "data-theforge-mermaid";

let mermaidInit = false;

function initMermaid() {
  if (mermaidInit) return;
  mermaidInit = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
  });
}

function mermaidKey(content: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(content.length, 256); i++) h = (h << 5) - h + content.charCodeAt(i);
  return `mermaid-${h >>> 0}`;
}

function prepareMermaidForRender(content: string): string {
  const { diagram } = splitMermaidBodyAndTrailingProse(content);
  const stripped = stripMarkdownLeakFromMermaidDiagramBody(diagram);
  return normalizeMermaidDiagramBody(stripped);
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
  className: string | undefined,
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

class MermaidBlockErrorBoundary extends Component<
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

function MermaidBlock({ content, blockKey }: { content: string; blockKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  const [error, setError] = useState<string | null>(null);
  const renderIdRef = useRef<string>("");
  if (!renderIdRef.current) {
    renderIdRef.current =
      "m" +
      instanceId.replace(/[^a-zA-Z0-9]/g, "") +
      blockKey.replace(/[^a-zA-Z0-9]/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 9);
  }
  const renderId = renderIdRef.current;

  useEffect(() => {
    initMermaid();
    const el = ref.current;
    if (!el || !content.trim()) return;

    setError(null);
    let cancelled = false;
    const toRender = prepareMermaidForRender(content);
    if (!toRender) return;

    const doRender = async () => {
      try {
        const { svg, bindFunctions } = await mermaid.render(renderId, toRender);
        if (cancelled || !el) return;
        el.innerHTML = svg;
        bindFunctions?.(el);
      } catch (e) {
        if (!cancelled) {
          console.error("Mermaid render error:", e);
          setError("render_failed");
        }
      }
    };

    void doRender();

    return () => {
      cancelled = true;
    };
  }, [content, blockKey, renderId]);

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
      {...{ [MERMAID_BLOCK_MARKER]: "1" }}
      className="my-6 block w-full min-w-0 [isolation:isolate] overflow-x-auto"
      aria-label="Diagrama Mermaid"
    >
      <div
        ref={ref}
        className="flex min-h-[120px] justify-center [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:min-w-0"
      />
    </div>
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

  const normalized = prepareMermaidForRender(source.trim());
  if (!normalized.trim()) return null;

  const key = mermaidKey(normalized);
  return (
    <MermaidBlockErrorBoundary content={normalized} blockKey={key}>
      <MermaidBlock key={key} blockKey={key} content={normalized} />
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
