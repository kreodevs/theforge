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
  EVDJSON,
  EvdProductOverviewSlide,
  EvdUserFlowsSlide,
  EvdFeatureDeepDiveSlide,
  EvdDataModelSlide,
  EvdIntegrationPointsSlide,
  EvdSecurityModelSlide,
  EvdDeploymentPlanSlide,
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
  const gridCols = cols <= 2 ? "grid-cols-1 sm:grid-cols-2" : cols <= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";
  return (
    <div
      className={`grid gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 ${gridCols}`}
    >
      {components.map((c, i) => (
        <WireframeBox key={i} c={c} />
      ))}
    </div>
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

function Badge({ label, accentColor }: { label: string; accentColor: string }) {
  return (
    <span
      className="inline-block rounded-md px-3 py-1 text-xs font-semibold text-white"
      style={{ background: accentColor }}
    >
      {label}
    </span>
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
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-4 py-6 text-center sm:px-8 sm:py-10"
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

function CtaSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  const s = slide as Extract<EvdSlide, { type: "cta" }>;
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-4 py-6 text-center sm:px-8 sm:py-10"
      style={{ background: branding.primaryColor, color: branding.bgColor }}
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

function ProductOverviewSlideView({
  slide,
  branding,
}: {
  slide: EvdProductOverviewSlide;
  branding: EvdBranding;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        subtitle={slide.description}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {slide.valueProposition && (
        <div
          className="rounded-lg border-l-4 px-4 py-3 text-sm font-medium"
          style={{
            borderColor: branding.accentColor,
            background: `${branding.accentColor}08`,
            color: "var(--foreground)",
          }}
        >
          <span className="font-bold" style={{ color: branding.accentColor }}>
            Propuesta de valor:{" "}
          </span>
          {slide.valueProposition}
        </div>
      )}
      {slide.targetUsers && slide.targetUsers.length > 0 && (
        <div>
          <h3
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: branding.accentColor }}
          >
            Usuarios objetivo
          </h3>
          <BulletsView items={slide.targetUsers} />
        </div>
      )}
    </div>
  );
}

function UserFlowsSlideView({
  slide,
  branding,
}: {
  slide: EvdUserFlowsSlide;
  branding: EvdBranding;
}) {
  const flows = slide.flows ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {flows.map((flow, fi) => (
        <div key={fi} className="mb-2">
          <div className="mb-1 text-xs font-bold" style={{ color: branding.accentColor }}>
            {flow.name}
          </div>
          {flow.description && (
            <div className="mb-2 text-[11px] italic text-[var(--muted-foreground)]">
              {flow.description}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {flow.steps.slice(0, 5).map((step, si) => (
              <div key={si} className="flex items-center gap-2">
                {si > 0 && (
                  <span className="text-lg font-bold" style={{ color: branding.accentColor }}>
                    →
                  </span>
                )}
                <div
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                  style={{ borderColor: "var(--border)", background: "var(--card)" }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: branding.accentColor }}
                  >
                    {si + 1}
                  </span>
                  <span className="text-xs leading-snug">{step}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatureDeepDiveSlideView({
  slide,
  branding,
}: {
  slide: EvdFeatureDeepDiveSlide;
  branding: EvdBranding;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {slide.featureName && <Badge label={slide.featureName} accentColor={branding.accentColor} />}
      {slide.description && (
        <p className="text-sm leading-relaxed">{slide.description}</p>
      )}
      {slide.benefits && slide.benefits.length > 0 && (
        <div>
          <h3
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: branding.accentColor }}
          >
            Beneficios
          </h3>
          <BulletsView items={slide.benefits} />
        </div>
      )}
      {slide.howItWorks && (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <span className="font-bold" style={{ color: branding.accentColor }}>
            Cómo funciona:{" "}
          </span>
          {slide.howItWorks}
        </div>
      )}
    </div>
  );
}

function DataChartSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  const s = slide as Extract<EvdSlide, { type: "data_chart" }>;
  const insights = "insights" in s ? (s as { insights?: string[] }).insights : undefined;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={s.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {s.chartData && <ChartSvg chart={s.chartData} branding={branding} />}
      {insights && insights.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {insights.map((ins, i) => (
            <span
              key={i}
              className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]"
            >
              {ins}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ArchitectureDiagramSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  const s = slide as Extract<EvdSlide, { type: "architecture_diagram" }>;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={s.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {s.diagramData && (
        <div className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
          <MermaidBlockErrorBoundary
            content={s.diagramData.code}
            blockKey={mermaidKey(`evd-${s.id}`)}
          >
            <MermaidDiagramBlock
              content={s.diagramData.code}
              blockKey={mermaidKey(`evd-${s.id}`)}
            />
          </MermaidBlockErrorBoundary>
        </div>
      )}
    </div>
  );
}

function DataModelSlideView({
  slide,
  branding,
}: {
  slide: EvdDataModelSlide;
  branding: EvdBranding;
}) {
  const entities = slide.entities ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      <div className="flex gap-4">
        {slide.diagramData && (
          <div className="flex-1 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <MermaidBlockErrorBoundary
              content={slide.diagramData.code}
              blockKey={mermaidKey(`evd-${slide.id}-er`)}
            >
              <MermaidDiagramBlock
                content={slide.diagramData.code}
                blockKey={mermaidKey(`evd-${slide.id}-er`)}
              />
            </MermaidBlockErrorBoundary>
          </div>
        )}
        {entities.length > 0 && (
          <div className={`${slide.diagramData ? "flex-1" : "w-full"} overflow-auto rounded-lg border border-[var(--border)]`}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: branding.accentColor }}>
                  <th className="px-3 py-2 text-left font-semibold text-white">Entidad</th>
                  <th className="px-3 py-2 text-left font-semibold text-white">Campos</th>
                  <th className="px-3 py-2 text-left font-semibold text-white">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-[var(--card)]" : "bg-[var(--muted)]"}
                  >
                    <td className="px-3 py-2 font-bold" style={{ color: branding.accentColor }}>
                      {e.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-[var(--muted-foreground)]">
                      {e.fields.join(", ")}
                    </td>
                    <td className="px-3 py-2">{e.description ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function WireframeSlideView({
  slide,
  branding,
}: {
  slide: EvdSlide;
  branding: EvdBranding;
}) {
  const s = slide as Extract<EvdSlide, { type: "wireframe" }>;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={s.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {s.wireframeData && (
        <WireframeRenderer
          components={s.wireframeData.components}
          layout={s.wireframeData.layout}
          columns={s.wireframeData.columns}
        />
      )}
    </div>
  );
}

function IntegrationPointsSlideView({
  slide,
  branding,
}: {
  slide: EvdIntegrationPointsSlide;
  branding: EvdBranding;
}) {
  const integrations = slide.integrations ?? [];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((intg, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
            style={{ borderTopWidth: 3, borderTopColor: branding.accentColor }}
          >
            <div className="text-sm font-bold">{intg.name}</div>
            {intg.type && (
              <span
                className="mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: `${branding.accentColor}12`, color: branding.accentColor }}
              >
                {intg.type}
              </span>
            )}
            {intg.purpose && (
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {intg.purpose}
              </p>
            )}
            {intg.provider && (
              <p className="mt-2 text-[10px] italic text-[var(--muted-foreground)]">
                Provider: {intg.provider}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityModelSlideView({
  slide,
  branding,
}: {
  slide: EvdSecurityModelSlide;
  branding: EvdBranding;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      <SectionHeader
        title={slide.title}
        accentColor={branding.accentColor}
        fontFamily={branding.fontFamily}
      />
      {slide.authMethod && (
        <Badge label={`Autenticación: ${slide.authMethod}`} accentColor={branding.accentColor} />
      )}
      {slide.roles && slide.roles.length > 0 && (
        <div>
          <h3
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: branding.accentColor }}
          >
            Roles del sistema
          </h3>
          <div className="flex flex-wrap gap-2">
            {slide.roles.map((r, i) => (
              <span
                key={i}
                className="rounded-md border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                {r}
              </span>
            ))}
          </div>
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

function DeploymentPlanSlideView({
  slide,
  branding,
}: {
  slide: EvdDeploymentPlanSlide;
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
      {slide.environment && (
        <Badge label={`Entorno: ${slide.environment}`} accentColor={branding.accentColor} />
      )}
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
              {p.description && (
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {p.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {slide.ciCd && (
        <div
          className="rounded-lg border p-3 font-mono text-xs"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <span className="font-bold" style={{ color: branding.accentColor }}>
            CI/CD:{" "}
          </span>
          {slide.ciCd}
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
      return <TitleSlideView slide={slide} branding={branding} />;
    case "product_overview":
      return <ProductOverviewSlideView slide={slide} branding={branding} />;
    case "user_flows":
      return <UserFlowsSlideView slide={slide} branding={branding} />;
    case "feature_deep_dive":
      return <FeatureDeepDiveSlideView slide={slide} branding={branding} />;
    case "data_chart":
      return <DataChartSlideView slide={slide} branding={branding} />;
    case "architecture_diagram":
      return <ArchitectureDiagramSlideView slide={slide} branding={branding} />;
    case "data_model":
      return <DataModelSlideView slide={slide} branding={branding} />;
    case "wireframe":
      return <WireframeSlideView slide={slide} branding={branding} />;
    case "integration_points":
      return <IntegrationPointsSlideView slide={slide} branding={branding} />;
    case "security_model":
      return <SecurityModelSlideView slide={slide} branding={branding} />;
    case "deployment_plan":
      return <DeploymentPlanSlideView slide={slide} branding={branding} />;
    case "timeline":
      return <TimelineSlideView slide={slide} branding={branding} />;
    case "cta":
      return <CtaSlideView slide={slide} branding={branding} />;
    default:
      return <FallbackSlideView slide={slide} branding={branding} />;
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
          Genera el Executive Visual Deck desde el MDD para visualizar la
          presentación con diagramas, charts, wireframes y flujos de usuario.
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
        <div className="shrink-0 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
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
