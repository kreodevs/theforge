import { memo, useCallback, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  EvdSlide,
  EvdChartData,
  EvdBranding,
  EvdWireframeComponent,
  EvdTimelineSlide,
  EvdTeamSlide,
  EVDJSON,
} from "@theforge/shared-types/evd-types";

import {
  MermaidDiagramBlock,
  mermaidKey,
  MermaidBlockErrorBoundary,
} from "@/components/MarkdownMermaid";

/* ────────────────── Helpers ────────────────── */

function parseEvdJson(raw: string | null | undefined): EVDJSON | null {
  if (!raw?.trim()) return null;
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as EVDJSON;
    if (parsed?.slides && Array.isArray(parsed.slides)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/* ────────────────── Branding defaults ────────────────── */

const DEFAULT_BRANDING: EvdBranding = {
  primaryColor: "#1a1a2e",
  secondaryColor: "#16213e",
  accentColor: "#0f3460",
  highlightColor: "#e94560",
  bgColor: "#ffffff",
  textColor: "#1a1a2e",
  fontFamily: "Inter, system-ui, sans-serif",
};

function useBranding(raw?: EvdBranding | null): EvdBranding {
  return useMemo(() => {
    if (!raw) return DEFAULT_BRANDING;
    return { ...DEFAULT_BRANDING, ...raw };
  }, [raw]);
}

/* ────────────────── SVG Charts ────────────────── */

function barPath(
  values: number[],
  maxVal: number,
  barW: number,
  gap: number,
  h: number,
  pad: number,
): string {
  if (maxVal === 0) return "";
  let d = "";
  values.forEach((v, i) => {
    const x = pad + i * (barW + gap);
    const barH = (v / maxVal) * (h - pad * 2);
    const y = h - pad - barH;
    d += `M${x},${y} h${barW} v${barH} h-${barW} Z `;
  });
  return d;
}

function linePath(
  values: number[],
  maxVal: number,
  w: number,
  h: number,
  pad: number,
): string {
  if (maxVal === 0 || values.length === 0) return "";
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1 || 1)) * innerW;
      const y = h - pad - (v / maxVal) * innerH;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

function ChartSvg({
  chart,
  branding,
}: {
  chart: EvdChartData;
  branding: EvdBranding;
}) {
  const w = 480;
  const h = 220;
  const pad = 36;
  const allVals = chart.datasets.flatMap((ds: { values: number[] }) => ds.values);
  const maxVal = Math.max(...allVals, 1) * 1.1;
  const isPie = chart.chartType === "pie" || chart.chartType === "doughnut";
  const isRadar = chart.chartType === "radar";
  const isBar = chart.chartType === "bar";
  const isLine = chart.chartType === "line";

  if (isPie || isRadar) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-xs font-semibold"
          style={{ color: branding.accentColor }}
        >
          {chart.title}
        </span>
        <div className="text-xs text-[var(--muted-foreground)] italic opacity-70">
          [{chart.chartType === "pie" ? "Pie" : "Doughnut"}: {chart.labels.join(", ")}]
        </div>
      </div>
    );
  }

  const barW = isBar ? Math.min(28, (w - pad * 2) / chart.labels.length - 6) : 0;
  const gap = isBar ? 4 : 0;
  const colors = [
    branding.accentColor,
    branding.highlightColor,
    "#22c55e",
    "#f59e0b",
    "#8b5cf6",
  ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-h-[220px]" role="img">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad}
          y1={h - pad - f * (h - pad * 2)}
          x2={w - pad}
          y2={h - pad - f * (h - pad * 2)}
          stroke="var(--border)"
          strokeWidth={0.5}
          opacity={0.4}
        />
      ))}
      {/* Axis */}
      <line
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        stroke="var(--muted-foreground)"
        strokeWidth={1}
        opacity={0.3}
      />
      {chart.datasets.map((ds, di) => {
        const c = colors[di % colors.length];
        if (isBar) {
          return (
            <path
              key={di}
              d={barPath(ds.values, maxVal, barW, gap, h, pad)}
              fill={c}
              opacity={0.85}
            />
          );
        }
        if (isLine) {
          return (
            <g key={di}>
              <path
                d={linePath(ds.values, maxVal, w, h, pad)}
                fill="none"
                stroke={c}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {ds.values.map((v, vi) => {
                const x =
                  pad + (vi / (ds.values.length - 1 || 1)) * (w - pad * 2);
                const y = h - pad - (v / maxVal) * (h - pad * 2);
                return (
                  <circle key={vi} cx={x} cy={y} r={3.5} fill={c} />
                );
              })}
            </g>
          );
        }
        return null;
      })}
      {/* X labels */}
      {chart.labels.map((label, i) => {
        const x = isBar
          ? pad + i * (barW + gap) + barW / 2
          : pad + (i / (chart.labels.length - 1 || 1)) * (w - pad * 2);
        return (
          <text
            key={i}
            x={x}
            y={h - pad + 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            {label.length > 8 ? label.slice(0, 7) + "…" : label}
          </text>
        );
      })}
      {/* Legend */}
      {chart.datasets.map((ds, di) => {
        const c = colors[di % colors.length];
        return (
          <g key={`l${di}`} transform={`translate(${w - 120}, ${8 + di * 14})`}>
            <rect width={10} height={10} rx={2} fill={c} />
            <text x={14} y={9} fontSize={9} fill="var(--muted-foreground)">
              {ds.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ────────────────── Wireframe renderer ────────────────── */

function WireframeBox({ c }: { c: EvdWireframeComponent }) {
  const bgMap: Record<string, string> = {
    navbar: "bg-[var(--muted)]",
    sidebar: "bg-[var(--muted)]",
    card: "bg-[var(--card)] border border-[var(--border)] rounded-md",
    chart: "bg-[var(--muted)] border border-dashed border-[var(--border)] rounded-md",
    table: "bg-[var(--card)] border border-[var(--border)] rounded-md",
    form: "bg-[var(--card)] border border-[var(--border)] rounded-md",
    modal: "bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-md",
    button: "bg-[var(--primary)] rounded-md",
    input: "bg-[var(--card)] border border-[var(--border)] rounded-md",
    text: "",
    image: "bg-[var(--muted)] border border-dashed border-[var(--border)] rounded-md",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden text-[10px] font-medium text-[var(--muted-foreground)]",
        bgMap[c.type] ?? "bg-[var(--muted)] border border-[var(--border)] rounded",
      )}
      style={{ width: c.width, height: c.height }}
    >
      <span className="truncate px-1 opacity-70">{c.label}</span>
    </div>
  );
}

function WireframeRenderer({
  components,
  layout: _layout,
  columns,
}: {
  components: EvdWireframeComponent[];
  layout?: string;
  columns?: number;
}) {
  const cols = columns ?? 4;
  return (
    <div
      className="grid gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
      }}
    >
      {components.map((c, i) => (
        <WireframeBox key={i} c={c} />
      ))}
    </div>
  );
}

/* ────────────────── Slide renderers ────────────────── */

function TitleSlideView({
  slide,
  branding,
}: {
  slide: Extract<EvdSlide, { type: "title" }>;
  branding: EvdBranding;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-10 text-center"
      style={{ background: branding.primaryColor, color: branding.bgColor }}
    >
      {branding.logoUrl && (
        <img
          src={branding.logoUrl}
          alt="Logo"
          className="mb-2 h-12 w-auto object-contain"
        />
      )}
      <h1
        className="text-2xl font-black leading-tight tracking-tight sm:text-3xl"
        style={{ fontFamily: branding.fontFamily }}
      >
        {slide.title}
      </h1>
      {slide.subtitle && (
        <p className="max-w-lg text-sm opacity-80">{slide.subtitle}</p>
      )}
    </div>
  );
}

function BulletsView({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((b, i) => (
        <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
            aria-hidden
          />
          {b}
        </li>
      ))}
    </ul>
  );
}

function GenericSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-5">
      <h2
        className="text-lg font-bold leading-snug"
        style={{ color: branding.accentColor, fontFamily: branding.fontFamily }}
      >
        {slide.title}
      </h2>

      {"bullets" in slide && slide.bullets && (
        <BulletsView items={slide.bullets} />
      )}

      {"problem" in slide && slide.problem && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed">{slide.problem}</p>
          {"impact" in slide && slide.impact && (
            <div
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              style={{
                borderColor: branding.highlightColor,
                color: branding.highlightColor,
              }}
            >
              Impacto: {slide.impact}
            </div>
          )}
        </div>
      )}

      {"description" in slide && slide.description && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed">{slide.description}</p>
          {"keyFeatures" in slide && slide.keyFeatures && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                Características clave
              </h3>
              <BulletsView items={slide.keyFeatures} />
            </div>
          )}
          {"differentiators" in slide && slide.differentiators && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                Diferenciadores
              </h3>
              <BulletsView items={slide.differentiators} />
            </div>
          )}
        </div>
      )}

      {"chartData" in slide && slide.chartData && (
        <div className="flex justify-center">
          <ChartSvg chart={slide.chartData} branding={branding} />
        </div>
      )}

      {"insights" in slide && slide.insights && (
        <div className="mt-1 flex flex-wrap gap-2">
          {slide.insights.map((ins, i) => (
            <span
              key={i}
              className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]"
            >
              {ins}
            </span>
          ))}
        </div>
      )}

      {"diagramData" in slide && slide.diagramData && (
        <div className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
          <MermaidBlockErrorBoundary
            content={slide.diagramData.code}
            blockKey={mermaidKey(`evd-${slide.id}`)}
          >
            <MermaidDiagramBlock
              content={slide.diagramData.code}
              blockKey={mermaidKey(`evd-${slide.id}`)}
            />
          </MermaidBlockErrorBoundary>
        </div>
      )}

      {"wireframeData" in slide && slide.wireframeData && (
        <WireframeRenderer
          components={slide.wireframeData.components}
          layout={slide.wireframeData.layout}
          columns={slide.wireframeData.columns}
        />
      )}

      {"milestones" in slide && (slide as EvdTimelineSlide).milestones && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(slide as EvdTimelineSlide).milestones!.map((m, i) => (
            <div
              key={i}
              className="flex min-w-[130px] flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center"
            >
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: branding.accentColor }}
              />
              <span className="text-xs font-bold" style={{ color: branding.accentColor }}>
                {m.date}
              </span>
              <span className="text-xs font-semibold">{m.label}</span>
              {m.description && (
                <span className="text-[10px] opacity-70">{m.description}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {"members" in slide && (slide as EvdTeamSlide).members && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(slide as EvdTeamSlide).members!.map((m, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: branding.accentColor }}
              >
                {m.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-semibold">{m.name}</span>
              {m.role && (
                <span className="text-[10px] opacity-70">{m.role}</span>
              )}
              {m.bio && (
                <span className="text-[10px] opacity-50">{m.bio}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {"contactInfo" in slide && (slide as Extract<EvdSlide, { type: "cta" }>).contactInfo && (
        <div className="mt-2 rounded-lg bg-[var(--muted)] px-4 py-3 text-center text-sm font-medium">
          {(slide as Extract<EvdSlide, { type: "cta" }>).contactInfo}
        </div>
      )}
    </div>
  );
}

/* ────────────────── Slide wrapper ────────────────── */

function SlideCard({
  slide,
  isActive,
  onClick,
  index,
}: {
  slide: EvdSlide;
  isActive: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[100px] min-w-[140px] flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center transition-all",
        isActive
          ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5",
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-50">
        #{index + 1}
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-snug">
        {slide.title}
      </span>
    </button>
  );
}

/* ────────────────── Main component ────────────────── */

export interface EvdSlideViewerProps {
  content: string | null;
  onGenerate?: () => void;
  canGenerate?: boolean;
  isLoading?: boolean;
}

export function EvdSlideViewer({
  content,
  onGenerate,
  canGenerate = true,
  isLoading = false,
}: EvdSlideViewerProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  const evd = useMemo(() => parseEvdJson(content), [content]);
  const branding = useBranding(evd?.branding);

  const slides = evd?.slides ?? [];

  const goPrev = useCallback(() => {
    setActiveIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIdx((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  if (!evd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <Layers className="h-10 w-10 opacity-40" strokeWidth={1.5} />
        <h3 className="text-base font-semibold">Sin contenido EVD</h3>
        <p className="max-w-md text-sm text-[var(--muted-foreground)]">
          Genera el Executive Visual Deck desde el MDD para visualizar la
          presentación ejecutiva con charts, diagramas y wireframes.
        </p>
        {onGenerate && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onGenerate}
            disabled={!canGenerate || isLoading}
            loading={isLoading}
            className="mt-2"
          >
            Generar EVD
          </Button>
        )}
      </div>
    );
  }

  const current = slides[activeIdx];
  if (!current) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {/* Meta bar */}
      {evd.meta && (
        <div className="shrink-0 rounded-lg bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
          <span className="font-semibold">{evd.meta.title}</span>
          {evd.meta.subtitle && (
            <span className="ml-2 opacity-70">— {evd.meta.subtitle}</span>
          )}
          <span className="ml-2 opacity-50">
            {slides.length} slide{slides.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Slide viewer area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        {/* Header: slide title + navigation */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: branding.highlightColor }}
            >
              {current.type.replace(/_/g, " ")}
            </span>
            <span className="text-sm font-semibold">{current.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goPrev}
              disabled={activeIdx === 0}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[52px] text-center text-xs font-medium tabular-nums text-[var(--muted-foreground)]">
              {activeIdx + 1} / {slides.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goNext}
              disabled={activeIdx === slides.length - 1}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Slide content */}
        <div className="flex min-h-0 flex-1 overflow-auto">
          {current.type === "title" ? (
            <TitleSlideView slide={current} branding={branding} />
          ) : (
            <GenericSlideView slide={current} branding={branding} />
          )}
        </div>

        {/* Speaker notes */}
        {current.speakerNotes && (
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2.5">
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)] italic opacity-80">
              <span className="font-semibold not-italic">Speaker notes:</span>{" "}
              {current.speakerNotes}
            </p>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {slides.length > 1 && (
        <div className="shrink-0 flex gap-2 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <SlideCard
              key={s.id}
              slide={s}
              isActive={i === activeIdx}
              onClick={() => setActiveIdx(i)}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(EvdSlideViewer);
