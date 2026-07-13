import { memo, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Database,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  EvdSlide,
  EvdChartData,
  EvdBranding,
  EvdTimelineSlide,
  EVDJSON,
  EvdProblemStatementSlide,
  EvdSolutionVisionSlide,
  EvdCurrentVsNewSlide,
  EvdProcessFlowSlide,
  EvdAutomationsSlide,
  EvdKeyFeaturesSlide,
  EvdDataOverviewSlide,
  EvdIntegrationsSlide,
  EvdSecurityAccessSlide,
  EvdRolloutPlanSlide,
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
  const isBar = chart.chartType === "bar";
  const isLine = chart.chartType === "line";

  if (isPie) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-xs font-semibold"
          style={{ color: branding.accentColor }}
        >
          {chart.title}
        </span>
        <div className="text-xs text-[var(--muted-foreground)] italic opacity-70">
          [{chart.labels.join(", ")}]
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

/* ────────────────── Shared sub-components ────────────────── */

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

function SectionHeader({
  title,
  subtitle,
  accentColor,
  fontFamily,
}: {
  title: string;
  subtitle?: string;
  accentColor: string;
  fontFamily: string;
}) {
  return (
    <div className="mb-3">
      <h2
        className="text-lg font-bold leading-snug"
        style={{ color: accentColor, fontFamily }}
      >
        {title}
      </h2>
      <div
        className="mt-1 mb-2 h-[3px] w-12 rounded-full"
        style={{ background: accentColor }}
      />
      {subtitle && (
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ────────────────── Slide-specific renderers ────────────────── */

function TitleSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  const s = slide as Extract<EvdSlide, { type: "title" }>;
  const hasBg = !!slide.backgroundB64;
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-4 py-6 text-center sm:px-8 sm:py-10"
      style={{
        background: hasBg ? "transparent" : branding.primaryColor,
        color: branding.bgColor,
      }}
    >
      {branding.logoUrl && (
        <img
          src={branding.logoUrl}
          alt="Logo"
          className="mb-2 h-12 w-auto object-contain"
        />
      )}
      <h1
        className="text-xl font-black leading-tight tracking-tight sm:text-2xl md:text-3xl"
        style={{ fontFamily: branding.fontFamily }}
      >
        {s.title}
      </h1>
      {s.subtitle && (
        <p className="max-w-lg text-sm opacity-80">{s.subtitle}</p>
      )}
    </div>
  );
}

function ProblemStatementSlideView({
  slide,
  branding,
}: {
  slide: EvdProblemStatementSlide;
  branding: EvdBranding;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.highlightColor}
        fontFamily={branding.fontFamily}
      />
      {slide.painPoints && slide.painPoints.length > 0 && (
        <div className="space-y-2">
          {slide.painPoints.map((pp, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span className="text-sm leading-relaxed">{pp}</span>
            </div>
          ))}
        </div>
      )}
      {slide.impact && (
        <div
          className="rounded-lg border-l-4 px-4 py-3 text-sm font-medium"
          style={{
            borderColor: branding.highlightColor,
            background: `${branding.highlightColor}08`,
          }}
        >
          <span className="font-bold" style={{ color: branding.highlightColor }}>
            Impacto:{" "}
          </span>
          {slide.impact}
        </div>
      )}
      {slide.urgency && (
        <p className="text-xs italic text-[var(--muted-foreground)]">
          {slide.urgency}
        </p>
      )}
    </div>
  );
}

function SolutionVisionSlideView({
  slide,
  branding,
}: {
  slide: EvdSolutionVisionSlide;
  branding: EvdBranding;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {slide.description && (
        <p className="text-sm leading-relaxed">{slide.description}</p>
      )}
      {slide.keyOutcomes && slide.keyOutcomes.length > 0 && (
        <div>
          <h3
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: branding.accentColor }}
          >
            Resultados esperados
          </h3>
          <div className="space-y-2">
            {slide.keyOutcomes.map((o, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span className="text-sm leading-relaxed">{o}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {slide.targetUsers && slide.targetUsers.length > 0 && (
        <div>
          <h3
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: branding.accentColor }}
          >
            Usuarios beneficiados
          </h3>
          <BulletsView items={slide.targetUsers} />
        </div>
      )}
    </div>
  );
}

function CurrentVsNewSlideView({
  slide,
  branding,
}: {
  slide: EvdCurrentVsNewSlide;
  branding: EvdBranding;
}) {
  const currentSteps = slide.currentSteps ?? [];
  const newSteps = slide.newSteps ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Current */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <h3 className="mb-3 text-sm font-bold text-red-700 dark:text-red-400">
            {slide.currentLabel ?? "Proceso Actual"}
          </h3>
          <div className="space-y-2">
            {currentSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
        {/* New */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <h3 className="mb-3 text-sm font-bold text-green-700 dark:text-green-400">
            {slide.newLabel ?? "Nuevo Proceso"}
          </h3>
          <div className="space-y-2">
            {newSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {slide.improvementSummary && (
        <div
          className="rounded-lg border-l-4 px-4 py-3 text-sm font-medium"
          style={{
            borderColor: branding.accentColor,
            background: `${branding.accentColor}08`,
          }}
        >
          <span className="font-bold" style={{ color: branding.accentColor }}>
            Mejora:{" "}
          </span>
          {slide.improvementSummary}
        </div>
      )}
    </div>
  );
}

function ProcessFlowSlideView({
  slide,
  branding,
}: {
  slide: EvdProcessFlowSlide;
  branding: EvdBranding;
}) {
  const steps = slide.steps ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {slide.diagramData && (
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
      {steps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {steps.slice(0, 6).map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <ArrowRight className="h-4 w-4 shrink-0" style={{ color: branding.accentColor }} />
              )}
              <div
                className="flex items-center gap-2 rounded-md border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: step.automated ? "#22c55e" : branding.accentColor }}
                >
                  {i + 1}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-snug">{step.label}</span>
                  {step.description && (
                    <span className="text-[10px] text-[var(--muted-foreground)] leading-snug">
                      {step.description}
                    </span>
                  )}
                </div>
                {step.automated && (
                  <Zap className="h-3 w-3 shrink-0 text-green-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AutomationsSlideView({
  slide,
  branding,
}: {
  slide: EvdAutomationsSlide;
  branding: EvdBranding;
}) {
  const automations = slide.automations ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {slide.chartData && <ChartSvg chart={slide.chartData} branding={branding} />}
      {automations.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {automations.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              style={{ borderLeftWidth: 3, borderLeftColor: "#22c55e" }}
            >
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{a.name}</div>
                {a.description && (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed">
                    {a.description}
                  </p>
                )}
              </div>
              {a.timeSaved && (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
                  {a.timeSaved}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyFeaturesSlideView({
  slide,
  branding,
}: {
  slide: EvdKeyFeaturesSlide;
  branding: EvdBranding;
}) {
  const features = slide.features ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {features.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              style={{ borderTopWidth: 3, borderTopColor: branding.accentColor }}
            >
              <div className="text-sm font-bold">{f.name}</div>
              {f.description && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed">
                  {f.description}
                </p>
              )}
              {f.benefit && (
                <p
                  className="mt-2 text-[10px] font-semibold"
                  style={{ color: branding.accentColor }}
                >
                  {f.benefit}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataOverviewSlideView({
  slide,
  branding,
}: {
  slide: EvdDataOverviewSlide;
  branding: EvdBranding;
}) {
  const dataTypes = slide.dataTypes ?? [];
  const flows = slide.flows ?? [];
  const sensColors = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" };
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {dataTypes.length > 0 && (
          <div>
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: branding.accentColor }}
            >
              Tipos de datos
            </h3>
            <div className="space-y-2">
              {dataTypes.map((d, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                >
                  <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: branding.accentColor }} />
                  <div className="flex-1">
                    <span className="text-xs font-semibold">{d.name}</span>
                    {d.description && (
                      <span className="ml-1 text-[10px] text-[var(--muted-foreground)]">
                        — {d.description}
                      </span>
                    )}
                  </div>
                  {d.sensitivity && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                      style={{ background: sensColors[d.sensitivity] }}
                    >
                      {d.sensitivity}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {flows.length > 0 && (
          <div>
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: branding.accentColor }}
            >
              Flujo de información
            </h3>
            <div className="space-y-2">
              {flows.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-2 text-xs"
                >
                  <span className="font-semibold">{f.from}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" style={{ color: branding.accentColor }} />
                  <span className="font-semibold">{f.to}</span>
                  {f.description && (
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      — {f.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrationsSlideView({
  slide,
  branding,
}: {
  slide: EvdIntegrationsSlide;
  branding: EvdBranding;
}) {
  const integrations = slide.integrations ?? [];
  const dirIcon: Record<string, typeof ArrowRight> = {
    inbound: ArrowRight,
    outbound: ArrowRight,
    bidirectional: GitBranch,
  };
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((intg, i) => {
          const Icon = dirIcon[intg.direction ?? "bidirectional"] ?? GitBranch;
          return (
            <div
              key={i}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              style={{ borderTopWidth: 3, borderTopColor: branding.accentColor }}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" style={{ color: branding.accentColor }} />
                <span className="text-sm font-bold">{intg.name}</span>
              </div>
              {intg.purpose && (
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {intg.purpose}
                </p>
              )}
              {intg.direction && (
                <span
                  className="mt-2 inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${branding.accentColor}12`, color: branding.accentColor }}
                >
                  {intg.direction}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecurityAccessSlideView({
  slide,
  branding,
}: {
  slide: EvdSecurityAccessSlide;
  branding: EvdBranding;
}) {
  const roles = slide.roles ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {roles.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roles.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" style={{ color: branding.accentColor }} />
                <span className="text-sm font-bold">{r.name}</span>
              </div>
              {r.permissions && r.permissions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map((p, pi) => (
                    <span
                      key={pi}
                      className="rounded-md border px-2 py-0.5 text-[10px]"
                      style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {slide.dataProtection && slide.dataProtection.length > 0 && (
        <div>
          <h3
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: branding.accentColor }}
          >
            Protección de datos
          </h3>
          <BulletsView items={slide.dataProtection} />
        </div>
      )}
    </div>
  );
}

function RolloutPlanSlideView({
  slide,
  branding,
}: {
  slide: EvdRolloutPlanSlide;
  branding: EvdBranding;
}) {
  const phases = slide.phases ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {phases.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {phases.map((p, i) => (
            <div
              key={i}
              className="flex-1 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: branding.accentColor }}
              >
                {i + 1}
              </span>
              <div className="mt-2 text-sm font-bold">{p.label}</div>
              {p.duration && (
                <span className="text-[10px] font-semibold" style={{ color: branding.accentColor }}>
                  {p.duration}
                </span>
              )}
              {p.description && (
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {p.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {slide.successCriteria && slide.successCriteria.length > 0 && (
        <div>
          <h3
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: branding.accentColor }}
          >
            Criterios de éxito
          </h3>
          <BulletsView items={slide.successCriteria} />
        </div>
      )}
    </div>
  );
}

function TimelineSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  const s = slide as EvdTimelineSlide;
  const milestones = s.milestones ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={s.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {milestones.map((m, i) => (
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
    </div>
  );
}

function CtaSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  const s = slide as Extract<EvdSlide, { type: "cta" }>;
  const hasBg = !!slide.backgroundB64;
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-4 py-6 text-center sm:px-8 sm:py-10"
      style={{
        background: hasBg ? "transparent" : branding.primaryColor,
        color: branding.bgColor,
      }}
    >
      <h1
        className="text-xl font-black leading-tight tracking-tight sm:text-2xl md:text-3xl"
        style={{ fontFamily: branding.fontFamily }}
      >
        {s.title}
      </h1>
      <div
        className="h-[3px] w-14 rounded-full"
        style={{ background: branding.highlightColor }}
      />
      {s.description && (
        <p className="max-w-lg text-sm opacity-80 leading-relaxed">{s.description}</p>
      )}
      {s.contactInfo && (
        <div className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-medium opacity-70">
          {s.contactInfo}
        </div>
      )}
    </div>
  );
}

/* ────────────────── Fallback for unknown types ────────────────── */

function FallbackSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  const s = slide as Extract<EvdSlide, { type: "title" }> & { bullets?: string[]; description?: string };
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={s.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {s.bullets && s.bullets.length > 0 && <BulletsView items={s.bullets} />}
      {s.description && <p className="text-sm leading-relaxed">{s.description}</p>}
    </div>
  );
}

/* ────────────────── Visual wrapper (background + illustration) ────────────────── */

function SlideWithVisuals({
  slide,
  children,
}: {
  slide: EvdSlide;
  children: ReactNode;
}) {
  const bgUrl = slide.backgroundB64
    ? `data:image/png;base64,${slide.backgroundB64}`
    : undefined;

  return (
    <div
      className="relative min-h-[60vh] sm:min-h-0 sm:flex-1"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {bgUrl && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bgUrl})` }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                slide.visualStyle === "data-driven"
                  ? "rgba(0,0,0,0.45)"
                  : slide.visualStyle === "minimal"
                    ? "rgba(0,0,0,0.15)"
                    : "rgba(0,0,0,0.35)",
            }}
          />
        </div>
      )}
      <div className="relative z-10">{children}</div>
      {slide.illustrationB64 && (
        <img
          src={`data:image/png;base64,${slide.illustrationB64}`}
          alt=""
          className="absolute bottom-4 right-4 z-20 h-20 w-20 rounded-lg object-contain shadow-lg sm:h-28 sm:w-28"
        />
      )}
    </div>
  );
}

/* ────────────────── Main slide dispatcher ────────────────── */

function SlideContent({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  switch (slide.type) {
    case "title":
      return (
        <SlideWithVisuals slide={slide}>
          <TitleSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "problem_statement":
      return (
        <SlideWithVisuals slide={slide}>
          <ProblemStatementSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "solution_vision":
      return (
        <SlideWithVisuals slide={slide}>
          <SolutionVisionSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "current_vs_new":
      return (
        <SlideWithVisuals slide={slide}>
          <CurrentVsNewSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "process_flow":
      return (
        <SlideWithVisuals slide={slide}>
          <ProcessFlowSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "automations":
      return (
        <SlideWithVisuals slide={slide}>
          <AutomationsSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "key_features":
      return (
        <SlideWithVisuals slide={slide}>
          <KeyFeaturesSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "data_overview":
      return (
        <SlideWithVisuals slide={slide}>
          <DataOverviewSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "integrations":
      return (
        <SlideWithVisuals slide={slide}>
          <IntegrationsSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "security_access":
      return (
        <SlideWithVisuals slide={slide}>
          <SecurityAccessSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "rollout_plan":
      return (
        <SlideWithVisuals slide={slide}>
          <RolloutPlanSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "timeline":
      return (
        <SlideWithVisuals slide={slide}>
          <TimelineSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    case "cta":
      return (
        <SlideWithVisuals slide={slide}>
          <CtaSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
    default:
      return (
        <SlideWithVisuals slide={slide}>
          <FallbackSlideView slide={slide} branding={branding} />
        </SlideWithVisuals>
      );
  }
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
          Genera el Executive Vision Deck desde el MDD para visualizar la
          presentación de negocio con procesos, automatizaciones y flujos.
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

      <div className="flex min-h-[60vh] sm:min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
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
              className="h-9 w-9 p-0 sm:h-7 sm:w-7"
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
              className="h-9 w-9 p-0 sm:h-7 sm:w-7"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className="flex min-h-[50vh] flex-1 flex-col overflow-y-auto overscroll-y-contain sm:min-h-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <SlideContent slide={current} branding={branding} />
        </div>

        {current.speakerNotes && (
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2.5">
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)] italic opacity-80">
              <span className="font-semibold not-italic">Speaker notes:</span>{" "}
              {current.speakerNotes}
            </p>
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <div
          className="shrink-0 flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
          style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}
        >
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
