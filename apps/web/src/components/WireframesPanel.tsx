import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkshopStore, type WireframesPreviewSession } from "../store/workshopStore";
import { contentDigestHash } from "../utils/contentDigestHash";
import { Monitor, Sparkles, ArrowRight, Check, Loader2, Circle, LayoutGrid, Blocks, CheckCircle2, AlertTriangle, XCircle, Square, RefreshCw } from "lucide-react";
import { Button, Badge, UnderlineTabs } from "@/components/ui";
import type { UnderlineTabItem } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DocEmptyState } from "@/components/DocEmptyState";
import MddViewer from "@/components/MddViewer";
import { AiDocumentBuildingPlaceholder } from "@/components/AiGenerationLoader";
import { WorkshopDocSourceSaveBar, WORKSHOP_DOC_EMPTY_PRIMARY_BTN } from "@/components/WorkshopDocSourceSaveBar";
import {
  buildComposedScreenPreviewSrcDoc,
  buildSnippetPreviewSrcDoc,
  prepareSnippetForIframe,
} from "@/utils/wireframeSnippetPreview";
import {
  buildComponentPreviewPropsLiteral,
  collectRequirementsContext,
  orderPreviewComponentsByDsTable,
} from "@/utils/wireframeScreenPreview";
import { buildWireframeHtmlSketchSrcDoc } from "@/utils/wireframeHtmlSketch";
import { ensureFullHtmlDocument } from "@/utils/wireframePreviewStyles";
import { hasOrbitaPreview, WireframeOrbitaBoceto } from "@/components/WireframeOrbitaBoceto";

export interface WireframesProgressStep {
  step: number;
  totalSteps: number;
  label: string;
  status: "running" | "done";
  detail?: string;
  durationMs?: number;
}

interface WireframesPanelProps {
  content: string | null;
  onContentChange: (value: string | null) => void;
  onSave: () => void;
  isDirty: boolean;
  viewMode: "wireframe" | "preview" | "source";
  onGenerate: () => void;
  canGenerate: boolean;
  /** Mensaje cuando `canGenerate` es false (p. ej. falta Design System). */
  prerequisiteHint?: string;
  isLoading: boolean;
  isGenerating: boolean;
  placeholder?: string;
  onBlur?: () => void;
  progress?: WireframesProgressStep | null;
  stepsHistory?: WireframesProgressStep[];
  projectId?: string;
  onCancel?: () => void;
  useCasesContent?: string | null;
  userStoriesContent?: string | null;
  specContent?: string | null;
}

interface ScreenPreviewEntry {
  key: string;
  title: string;
  parsed?: ParsedScreen;
  preview?: PreviewScreenData;
  screenSketchHtml?: string;
}

type PreviewKind = "html" | "url" | "unavailable" | "error" | "legacy";

interface PreviewComponentData {
  name: string;
  moduleId: string;
  previewKind?: PreviewKind;
  document?: string;
  previewUrl?: string;
  recommendedHeight?: number;
  sandbox?: string;
  snippet?: string;
  error?: string;
  fallback?: { kind: string; url?: string; screenshotUrl?: string };
}

interface PreviewScreenData {
  screenName: string;
  components: PreviewComponentData[];
  screenSketchHtml?: string;
}

interface ScreenSketchPayload {
  screenName: string;
  html: string;
}

interface DsComponentMapping {
  requiredComponent: string;
  dsModule: string;
  exportName: string;
  confidence: "exact" | "partial" | "none" | string;
  props: string;
}

interface ParsedScreen {
  name: string;
  /** Slug interno del compositor (`**ID**: \`create-secret\``). */
  screenId?: string;
  body: string;
  description: string;
  wireframeAscii: string;
  components: string[];
  dsComponents: DsComponentMapping[];
  navigatesTo: string[];
  useCases: string[];
  userStories: string[];
  stateVariations: string;
}

/**
 * Extracts a markdown table from the body text within a specific H3 section.
 * Returns parsed rows as arrays of cell values.
 */
function parseMarkdownTable(sectionBody: string): string[][] {
  const lines = sectionBody.split("\n");
  const rows: string[][] = [];
  let foundHeader = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (!foundHeader) {
      foundHeader = true;
      rows.push(cells);
      continue;
    }
    if (cells.every((c) => /^[-:]+$/.test(c))) continue;
    rows.push(cells);
  }
  return rows;
}

/**
 * Extracts the content of a H3 (###) section from a screen body.
 */
function extractH3Section(body: string, heading: RegExp): string {
  const lines = body.split("\n");
  let capturing = false;
  const captured: string[] = [];
  for (const line of lines) {
    if (/^### /.test(line.trim())) {
      if (capturing) break;
      if (heading.test(line.trim())) {
        capturing = true;
        continue;
      }
    }
    if (capturing) captured.push(line);
  }
  return captured.join("\n").trim();
}

/** Quita negrita/cursiva markdown del título (`**Login**` → `Login`). */
function stripInlineMarkdown(name: string): string {
  return name.trim().replace(/^[`*_]+|[`*_]+$/g, "").trim();
}

/** Normaliza títulos para unificar «Crear secreto» con slug interno `create-secret`. */
function normalizeScreenKey(name: string): string {
  return stripInlineMarkdown(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/^pantalla:\s*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function screenLookupKeys(screen: ParsedScreen): string[] {
  const keys = [normalizeScreenKey(screen.name)];
  if (screen.screenId?.trim()) keys.push(normalizeScreenKey(screen.screenId));
  return keys;
}

function findParsedScreenByKey(parsedScreens: ParsedScreen[], key: string): ParsedScreen | undefined {
  const normalized = normalizeScreenKey(key);
  return parsedScreens.find((s) => screenLookupKeys(s).includes(normalized));
}

function dedupeScreenSketches(
  sketches: ScreenSketchPayload[],
  parsedScreens: ParsedScreen[],
): ScreenSketchPayload[] {
  const byKey = new Map<string, ScreenSketchPayload>();
  for (const sk of sketches) {
    const html = sk.html?.trim();
    if (!html) continue;
    const matched = parsedScreens.find((s) =>
      screenLookupKeys(s).includes(normalizeScreenKey(sk.screenName)),
    );
    const screenName = matched?.name ?? stripInlineMarkdown(sk.screenName);
    const key = normalizeScreenKey(screenName);
    if (!byKey.has(key)) byKey.set(key, { screenName, html });
  }
  return [...byKey.values()];
}

/**
 * Extracts screens from wireframe markdown. Each H2 (##) becomes a screen.
 * Parses DS component tables, wireframe ASCII, navigation, and metadata.
 */
function parseScreens(content: string): ParsedScreen[] {
  const screenStarts: Array<{ name: string; index: number }> = [];
  const screenRegex = /^## Pantalla:\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = screenRegex.exec(content)) !== null) {
    screenStarts.push({ name: match[1].trim(), index: match.index });
  }
  if (screenStarts.length === 0) return [];

  const sections: string[] = [];
  for (let i = 0; i < screenStarts.length; i++) {
    const start = screenStarts[i].index;
    const end = i + 1 < screenStarts.length ? screenStarts[i + 1].index : content.length;
    sections.push(content.slice(start, end));
  }

  return sections.map((section) => {
    const lines = section.split("\n");
    const headerMatch = (lines[0] ?? "").match(/^## Pantalla:\s*(.+)$/i);
    const name =
      stripInlineMarkdown(headerMatch?.[1]?.trim() ?? (lines[0] ?? "").trim()) ||
      (lines[0] ?? "").trim();
    const body = lines.slice(1).join("\n").trim();

    // Extract metadata from **Key**: value lines
    let description = "";
    let screenId: string | undefined;
    const useCases: string[] = [];
    const userStories: string[] = [];
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      const idMatch = trimmed.match(/^\*\*ID\*\*:\s*`([^`]+)`/);
      if (idMatch?.[1]) screenId = idMatch[1].trim();
      const descMatch = trimmed.match(/^\*\*Descripci[oó]n\*\*:\s*(.+)/i);
      if (descMatch?.[1]) description = descMatch[1].trim();
      const ucMatch = trimmed.match(/^\*\*Casos de uso\*\*:\s*(.+)/i);
      if (ucMatch?.[1]) useCases.push(...ucMatch[1].split(/[,;]\s*/));
      const usMatch = trimmed.match(/^\*\*Historias de usuario\*\*:\s*(.+)/i);
      if (usMatch?.[1]) userStories.push(...usMatch[1].split(/[,;]\s*/));
    }

    // Extract wireframe ASCII block
    const wireframeSection = extractH3Section(body, /^###\s+Wireframe/i);
    let wireframeAscii = "";
    const codeBlockMatch = wireframeSection.match(/```[^\n]*\n([\s\S]*?)```/);
    if (codeBlockMatch?.[1]) {
      wireframeAscii = codeBlockMatch[1].trimEnd();
    } else if (wireframeSection.includes("┌") || wireframeSection.includes("│") || wireframeSection.includes("[")) {
      wireframeAscii = wireframeSection;
    }

    // Extract DS component table
    const dsSection = extractH3Section(body, /^###\s+(Componentes del Design System|Componentes DS)/i);
    const dsComponents: DsComponentMapping[] = [];
    if (dsSection) {
      const tableRows = parseMarkdownTable(dsSection);
      for (let i = 1; i < tableRows.length; i++) {
        const row = tableRows[i];
        if (row.length >= 4) {
          dsComponents.push({
            requiredComponent: row[0] ?? "",
            dsModule: row[1] ?? "",
            exportName: row[2] ?? "",
            confidence: (row[3] ?? "").toLowerCase(),
            props: row[4] ?? "",
          });
        }
      }
    }

    // Extract state variations
    const stateVariations = extractH3Section(body, /^###\s+Variaciones de estado/i);

    // Legacy component & navigation extraction for fallback
    const components: string[] = [];
    const navigatesTo: string[] = [];
    const navSection = extractH3Section(body, /^###\s+Navegaci[oó]n/i);
    if (navSection) {
      for (const line of navSection.split("\n")) {
        const navMatch = line.trim().match(/(?:→|->)\s*(.+)/);
        if (navMatch?.[1]) {
          navigatesTo.push(navMatch[1].trim().replace(/[*_`]/g, ""));
        }
      }
    }
    if (navigatesTo.length === 0) {
      for (const line of lines.slice(1)) {
        const trimmed = line.trim();
        const navMatch = trimmed.match(/(?:→|->)\s*(.+)/);
        if (navMatch?.[1]) {
          navigatesTo.push(navMatch[1].trim().replace(/[*_`]/g, ""));
        }
      }
    }

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      const compMatch = trimmed.match(/^-\s*`([^`]+)`/);
      if (compMatch?.[1]) {
        components.push(compMatch[1]);
        continue;
      }
      if (/^-\s/.test(trimmed) && /component|widget|botón|button|input|card|modal|drawer|tab|badge/i.test(trimmed)) {
        const label = trimmed.replace(/^-\s*/, "").replace(/[*_`]/g, "").trim();
        if (label) components.push(label);
      }
    }

    return {
      name,
      screenId,
      body,
      description,
      wireframeAscii,
      components,
      dsComponents,
      navigatesTo,
      useCases,
      userStories,
      stateVariations,
    };
  });
}

const DEFAULT_STEP_LABELS = [
  "Analizando pantallas",
  "Mapeando componentes",
  "Componiendo wireframes",
  "Revisión del crítico",
];

function WireframesProgressStepper({
  stepsHistory,
  currentProgress,
}: {
  stepsHistory: WireframesProgressStep[];
  currentProgress: WireframesProgressStep | null;
}) {
  const totalSteps = currentProgress?.totalSteps ?? stepsHistory[stepsHistory.length - 1]?.totalSteps ?? 4;
  const currentStep = currentProgress?.step ?? 0;

  const stepEntries: Array<{
    num: number;
    label: string;
    state: "done" | "running" | "pending";
    detail?: string;
    durationMs?: number;
  }> = [];

  for (let i = 1; i <= totalSteps; i++) {
    const historyEntry = stepsHistory.find((s) => s.step === i);
    const isCurrent = currentProgress?.step === i;

    let state: "done" | "running" | "pending" = "pending";
    if (historyEntry?.status === "done") state = "done";
    else if (isCurrent && currentProgress?.status === "running") state = "running";
    else if (isCurrent && currentProgress?.status === "done") state = "done";
    // Si un paso posterior ya terminó, este no puede seguir en "running".
    if (state === "running" && stepsHistory.some((s) => s.step > i && s.status === "done")) {
      state = "done";
    }

    const label = historyEntry?.label ?? (isCurrent ? currentProgress?.label : undefined) ?? DEFAULT_STEP_LABELS[i - 1] ?? `Paso ${i}`;
    const detail = historyEntry?.status === "done" ? historyEntry.detail : undefined;
    const durationMs = historyEntry?.status === "done" ? historyEntry.durationMs : undefined;

    stepEntries.push({ num: i, label, state, detail, durationMs });
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
          Generando Wireframes
        </h3>
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          Paso {currentStep} de {totalSteps}
        </span>
      </div>

      <div className="space-y-0">
        {stepEntries.map((entry, idx) => (
          <div key={entry.num} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                  entry.state === "done" && "bg-[color-mix(in_oklch,var(--primary)_18%,var(--card))] text-[var(--primary)]",
                  entry.state === "running" && "bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] text-[var(--primary)] ring-2 ring-[color-mix(in_oklch,var(--primary)_35%,transparent)]",
                  entry.state === "pending" && "bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] text-[var(--muted-foreground)]",
                )}
              >
                {entry.state === "done" && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {entry.state === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />}
                {entry.state === "pending" && <Circle className="h-3 w-3" strokeWidth={2} />}
              </div>
              {idx < stepEntries.length - 1 && (
                <div
                  className={cn(
                    "my-0.5 w-px flex-1 min-h-[16px]",
                    entry.state === "done" ? "bg-[color-mix(in_oklch,var(--primary)_30%,var(--border))]" : "bg-[var(--border)]",
                  )}
                />
              )}
            </div>

            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pb-3">
              <span
                className={cn(
                  "text-sm transition-colors duration-200",
                  entry.state === "done" && "font-medium text-[var(--foreground)]",
                  entry.state === "running" && "font-semibold text-[var(--foreground)]",
                  entry.state === "pending" && "text-[var(--muted-foreground)]",
                )}
              >
                {entry.label}
                {entry.detail && entry.state === "done" && (
                  <span className="ml-1.5 text-xs font-normal text-[var(--muted-foreground)]">
                    — {entry.detail}
                  </span>
                )}
              </span>
              {entry.state === "done" && entry.durationMs != null && (
                <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                  {(entry.durationMs / 1000).toFixed(1)}s
                </span>
              )}
              {entry.state === "running" && (
                <span className="shrink-0 text-xs text-[var(--muted-foreground)]">…</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CONFIDENCE_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  exact: {
    label: "Exacto",
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  partial: {
    label: "Parcial",
    icon: AlertTriangle,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  none: {
    label: "No encontrado",
    icon: XCircle,
    className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  },
};

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const config = CONFIDENCE_CONFIG[confidence] ?? CONFIDENCE_CONFIG.none;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        config.className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {config.label}
    </span>
  );
}

function DsComponentsTable({ mappings }: { mappings: DsComponentMapping[] }) {
  if (mappings.length === 0) return null;
  const stats = {
    exact: mappings.filter((m) => m.confidence === "exact").length,
    partial: mappings.filter((m) => m.confidence === "partial").length,
    none: mappings.filter((m) => m.confidence === "none").length,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          <Blocks className="h-3.5 w-3.5" aria-hidden />
          Componentes del Design System
        </p>
        <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
          {stats.exact > 0 && <span className="text-emerald-600 dark:text-emerald-400">{stats.exact} exactos</span>}
          {stats.partial > 0 && <span className="text-amber-600 dark:text-amber-400">{stats.partial} parciales</span>}
          {stats.none > 0 && <span className="text-red-600 dark:text-red-400">{stats.none} sin mapear</span>}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_30%,var(--card))]">
              <th className="px-3 py-2 text-left font-semibold text-[var(--foreground)]">Componente</th>
              <th className="px-3 py-2 text-left font-semibold text-[var(--foreground)]">Módulo DS</th>
              <th className="px-3 py-2 text-left font-semibold text-[var(--foreground)]">Export</th>
              <th className="px-3 py-2 text-center font-semibold text-[var(--foreground)]">Match</th>
              <th className="px-3 py-2 text-left font-semibold text-[var(--foreground)]">Props</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {mappings.map((m, idx) => (
              <tr
                key={`${m.requiredComponent}-${idx}`}
                className="transition-colors hover:bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))]"
              >
                <td className="px-3 py-2 font-medium text-[var(--foreground)]">{m.requiredComponent}</td>
                <td className="px-3 py-2 font-mono text-[var(--muted-foreground)]">{m.dsModule || "—"}</td>
                <td className="px-3 py-2 font-mono text-[var(--muted-foreground)]">{m.exportName || "—"}</td>
                <td className="px-3 py-2 text-center">
                  <ConfidenceBadge confidence={m.confidence} />
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 font-mono text-[var(--muted-foreground)]" title={m.props}>
                  {m.props || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScreenCard({
  screen,
  compact = false,
  onRegenerateSketch,
  regeneratingSketch = false,
  regenerateSketchDisabled = false,
}: {
  screen: ParsedScreen;
  compact?: boolean;
  onRegenerateSketch?: () => void;
  regeneratingSketch?: boolean;
  regenerateSketchDisabled?: boolean;
}) {
  const hasStructuredContent = screen.dsComponents.length > 0 || screen.wireframeAscii || screen.description;

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
      <div className="border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] text-[var(--primary)]">
            <Monitor className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
              {screen.name}
            </h3>
            {screen.description && (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
                {screen.description}
              </p>
            )}
          </div>
          {onRegenerateSketch && (
            <ScreenRegenerateButton
              className={SCREEN_CARD_REGEN_BTN}
              onClick={onRegenerateSketch}
              disabled={regenerateSketchDisabled || regeneratingSketch}
              loading={regeneratingSketch}
              label={`Regenerar boceto de ${screen.name}`}
            />
          )}
          {screen.dsComponents.length > 0 && (
            <Badge variant="secondary" className="shrink-0 gap-1 rounded-full text-[11px]">
              <Blocks className="h-3 w-3" aria-hidden />
              {screen.dsComponents.length}
            </Badge>
          )}
        </div>
        {(screen.useCases.length > 0 || screen.userStories.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {screen.useCases.map((uc, idx) => (
              <span
                key={`uc-${idx}-${uc}`}
                className="rounded-md bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]"
              >
                {uc}
              </span>
            ))}
            {screen.userStories.map((us, idx) => (
              <span
                key={`us-${idx}-${us}`}
                className="rounded-md bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]"
              >
                {us}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {screen.wireframeAscii && !compact && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Wireframe
            </p>
            <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))] p-3 font-mono text-xs leading-relaxed text-[var(--foreground)]">
              {screen.wireframeAscii}
            </pre>
          </div>
        )}

        {screen.dsComponents.length > 0 && (
          <DsComponentsTable mappings={screen.dsComponents} />
        )}

        {screen.dsComponents.length === 0 && screen.components.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Componentes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {screen.components.map((comp, idx) => (
                <span
                  key={`comp-${idx}-${comp}`}
                  className="inline-flex items-center rounded-full border border-[color-mix(in_oklch,var(--primary)_25%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] px-2.5 py-0.5 text-xs font-medium text-[color-mix(in_oklch,var(--primary)_78%,var(--foreground))]"
                >
                  {comp}
                </span>
              ))}
            </div>
          </div>
        )}

        {screen.navigatesTo.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Navegación
            </p>
            <div className="flex flex-wrap gap-2">
              {screen.navigatesTo.map((target, idx) => (
                <span
                  key={`nav-${idx}-${target}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--card))] px-2 py-1 text-xs text-[var(--foreground)]"
                >
                  <ArrowRight className="h-3 w-3 shrink-0 text-[var(--primary)]" aria-hidden />
                  {target}
                </span>
              ))}
            </div>
          </div>
        )}

        {screen.stateVariations && !compact && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Variaciones de estado
            </p>
            <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--card))] p-3">
              <MddViewer content={screen.stateVariations} />
            </div>
          </div>
        )}

        {!hasStructuredContent && screen.body && (
          <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--card))] p-3">
            <MddViewer content={screen.body} />
          </div>
        )}
      </div>
    </article>
  );
}

/** Orbita may return allow-same-origin; strip it — with allow-scripts that pair can escape sandbox (Chrome warning). */
function parseIframeSandbox(sandbox?: string): string {
  const tokens = (sandbox ?? "allow-scripts")
    .trim()
    .split(/\s+/)
    .filter((t) => t && t !== "allow-same-origin");
  if (!tokens.includes("allow-scripts")) tokens.unshift("allow-scripts");
  return [...new Set(tokens)].join(" ");
}

function LegacySnippetIframeRenderer({
  code,
  height = 300,
  className,
  previewPropsLiteral,
  embeddedInSketch = false,
  componentName,
}: {
  code: string;
  height?: number;
  className?: string;
  previewPropsLiteral?: string;
  embeddedInSketch?: boolean;
  componentName?: string;
}) {
  const srcDoc = useMemo(() => {
    const prepared = prepareSnippetForIframe(code, {
      propsLiteral: previewPropsLiteral,
      componentName,
    });
    return buildSnippetPreviewSrcDoc(prepared, { transparentBg: embeddedInSketch });
  }, [code, previewPropsLiteral, embeddedInSketch, componentName]);

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className={cn(
        "w-full",
        embeddedInSketch
          ? "border-0 bg-transparent"
          : "rounded-xl border border-[var(--border)]",
        className,
      )}
      style={{ height }}
      title="Component preview"
    />
  );
}

function HostedOrbitaPreviewIframe({
  documentHtml,
  sandbox,
  frameClass,
  height,
  title,
}: {
  documentHtml: string;
  sandbox: string;
  frameClass: string;
  height: number;
  title: string;
}) {
  const srcDoc = useMemo(() => ensureFullHtmlDocument(documentHtml), [documentHtml]);
  return (
    <iframe
      srcDoc={srcDoc}
      sandbox={sandbox}
      className={frameClass}
      style={{ height }}
      title={title}
    />
  );
}

function ComponentPreviewRenderer({
  comp,
  className,
  previewPropsLiteral,
  embeddedInSketch = false,
}: {
  comp: PreviewComponentData;
  className?: string;
  previewPropsLiteral?: string;
  embeddedInSketch?: boolean;
}) {
  const defaultEmbedded =
    comp.previewKind === "html" || comp.previewKind === "url" ? 120 : 80;
  const height = comp.recommendedHeight ?? (embeddedInSketch ? defaultEmbedded : 240);
  const sandbox = parseIframeSandbox(comp.sandbox);
  const frameClass = embeddedInSketch
    ? cn("w-full border-0 bg-transparent", className)
    : cn("w-full rounded-xl border border-[var(--border)]", className);

  if (comp.previewKind === "html" && comp.document?.trim()) {
    return (
      <HostedOrbitaPreviewIframe
        documentHtml={comp.document}
        sandbox={sandbox}
        frameClass={frameClass}
        height={height}
        title={`Preview ${comp.name}`}
      />
    );
  }

  if (comp.previewKind === "url" && comp.previewUrl?.trim()) {
    return (
      <iframe
        src={comp.previewUrl}
        sandbox={sandbox}
        className={frameClass}
        style={{ height }}
        title={`Preview ${comp.name}`}
      />
    );
  }

  if (comp.previewKind === "unavailable") {
    return (
      <div
        className={cn(
          "space-y-2 px-3 py-2 text-xs text-amber-900 dark:text-amber-200",
          embeddedInSketch
            ? "rounded-lg bg-amber-50"
            : "rounded-xl border border-amber-500/30 bg-amber-500/10",
        )}
      >
        <p>{comp.error ?? "Preview no disponible para este componente."}</p>
        {comp.fallback?.screenshotUrl && (
          <img
            src={comp.fallback.screenshotUrl}
            alt=""
            className="max-h-40 w-full rounded-lg object-contain"
          />
        )}
        {comp.fallback?.url && (
          <a href={comp.fallback.url} target="_blank" rel="noreferrer" className="underline">
            Ver documentación
          </a>
        )}
      </div>
    );
  }

  if (comp.snippet?.trim()) {
    return (
      <LegacySnippetIframeRenderer
        code={comp.snippet}
        height={height}
        className={className}
        previewPropsLiteral={previewPropsLiteral}
        embeddedInSketch={embeddedInSketch}
        componentName={comp.name}
      />
    );
  }

  return null;
}

function ComposedScreenIframe({ srcDoc, height = 360 }: { srcDoc: string; height?: number }) {
  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className="w-full border-0 bg-transparent"
      style={{ height, minHeight: 200 }}
      title="Boceto de pantalla"
    />
  );
}

function ScreenSketchCanvas({
  screenTitle,
  parsedScreen,
  previewComponents,
  requirementsContext,
  agentSketchHtml,
  onRegenerateSketch,
  regeneratingSketch = false,
  regenerateSketchDisabled = false,
}: {
  screenTitle: string;
  parsedScreen?: ParsedScreen;
  previewComponents: PreviewComponentData[];
  requirementsContext: string;
  agentSketchHtml?: string;
  onRegenerateSketch?: () => void;
  regeneratingSketch?: boolean;
  regenerateSketchDisabled?: boolean;
}) {
  const dsComponents = parsedScreen?.dsComponents ?? [];
  const ordered = useMemo(
    () => orderPreviewComponentsByDsTable(previewComponents, dsComponents),
    [previewComponents, dsComponents],
  );
  const orbitaAvailable = ordered.some(hasOrbitaPreview);

  const agentSrcDoc = useMemo(() => {
    const raw = agentSketchHtml?.trim();
    if (!raw) return null;
    return ensureFullHtmlDocument(raw);
  }, [agentSketchHtml]);

  const htmlSketchSrcDoc = useMemo(() => {
    if (agentSketchHtml?.trim()) return "";
    return buildWireframeHtmlSketchSrcDoc({
      screenTitle,
      wireframeAscii: parsedScreen?.wireframeAscii,
      dsComponents,
      requirementsContext,
      description: parsedScreen?.description,
    });
  }, [
    agentSketchHtml,
    screenTitle,
    parsedScreen?.wireframeAscii,
    dsComponents,
    parsedScreen?.description,
    requirementsContext,
  ]);

  const composedLegacySrcDoc = useMemo(() => {
    if (orbitaAvailable) return null;
    let inputIdx = 0;
    let buttonIdx = 0;
    const items = ordered
      .filter((c) => c.snippet?.trim() && !c.error)
      .map((comp) => {
        const lower = comp.name.toLowerCase();
        const isInput = lower.includes("input") || lower.includes("field");
        const isButton = lower.includes("button") || lower.includes("botón");
        return {
          componentName: comp.name,
          snippet: comp.snippet!,
          propsLiteral: buildComponentPreviewPropsLiteral(
            comp.name,
            dsComponents.find((d) => d.requiredComponent === comp.name)?.props,
            requirementsContext,
            comp.snippet ?? "",
            {
              title: screenTitle,
              description: parsedScreen?.description,
              inputIndex: isInput ? inputIdx++ : undefined,
              buttonIndex: isButton ? buttonIdx++ : undefined,
            },
          ),
        };
      });
    return items.length > 0 ? buildComposedScreenPreviewSrcDoc(items) : null;
  }, [orbitaAvailable, ordered, dsComponents, requirementsContext, screenTitle, parsedScreen?.description]);

  const sketchHeight = useMemo(() => {
    const rows = (parsedScreen?.wireframeAscii?.split("\n") ?? []).filter((l) => /[│|]/.test(l)).length;
    if (rows >= 6) return 520;
    if (rows >= 4) return 440;
    return 360;
  }, [parsedScreen?.wireframeAscii]);

  const traceRefs =
    (parsedScreen?.useCases.length ?? 0) > 0 || (parsedScreen?.userStories.length ?? 0) > 0
      ? [...(parsedScreen?.useCases ?? []), ...(parsedScreen?.userStories ?? [])].join(" · ")
      : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <div className="border-b border-neutral-100 bg-neutral-50/90 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Monitor className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-neutral-800">{screenTitle}</h3>
              {traceRefs ? (
                <p className="mt-0.5 text-[10px] leading-snug text-neutral-500 line-clamp-2">
                  Datos según {traceRefs}
                </p>
              ) : null}
            </div>
          </div>
          {onRegenerateSketch ? (
            <ScreenRegenerateButton
              className={cn(SCREEN_SKETCH_REGEN_BTN, "self-center")}
              onClick={onRegenerateSketch}
              disabled={regenerateSketchDisabled || regeneratingSketch}
              loading={regeneratingSketch}
              label={`Regenerar boceto de ${screenTitle}`}
            />
          ) : null}
        </div>
      </div>

      {parsedScreen?.wireframeAscii ? (
        <section className="border-b border-neutral-100 px-4 py-3">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Wireframe
          </p>
          <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))] p-3 font-mono text-xs leading-relaxed text-[var(--foreground)]">
            {parsedScreen.wireframeAscii}
          </pre>
        </section>
      ) : null}

      <section className="p-2 sm:p-3">
        <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Boceto (preview)
        </p>
        {agentSrcDoc ? (
          <>
            <ComposedScreenIframe srcDoc={agentSrcDoc} height={sketchHeight} />
            <p className="mt-2 text-center text-[10px] text-neutral-400">
              Boceto generado por IA según wireframe ASCII y requisitos
            </p>
          </>
        ) : orbitaAvailable ? (
          <WireframeOrbitaBoceto
            screenTitle={screenTitle}
            description={parsedScreen?.description}
            wireframeAscii={parsedScreen?.wireframeAscii}
            dsComponents={dsComponents}
            previewComponents={previewComponents}
            requirementsContext={requirementsContext}
            renderPreview={(comp, propsLiteral) => (
              <ComponentPreviewRenderer
                comp={comp}
                previewPropsLiteral={propsLiteral}
                embeddedInSketch
              />
            )}
          />
        ) : composedLegacySrcDoc ? (
          <>
            <ComposedScreenIframe srcDoc={composedLegacySrcDoc} height={sketchHeight} />
            <p className="mt-2 text-center text-[10px] text-neutral-400">
              Snippets Orbita (legacy) compuestos según CU/HU
            </p>
          </>
        ) : (
          <>
            <ComposedScreenIframe srcDoc={htmlSketchSrcDoc} height={sketchHeight} />
            <p className="mt-2 text-center text-[10px] text-amber-600 dark:text-amber-400">
              Sin boceto IA ni preview Orbita. Regenera wireframes o configura el MCP en Ajustes.
            </p>
          </>
        )}
      </section>
    </article>
  );
}

const ALL_SCREENS_TAB = "__all__";

/** Botón ↻ en cabecera de pantalla (evita icono blanco sobre fondo claro del boceto). */
const SCREEN_SKETCH_REGEN_BTN =
  "h-8 w-8 shrink-0 p-0 border-neutral-300 bg-white text-neutral-700 shadow-sm hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700";

const SCREEN_CARD_REGEN_BTN =
  "h-8 w-8 shrink-0 p-0 text-[var(--foreground)] border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]";

function ScreenRegenerateButton({
  onClick,
  disabled,
  loading,
  label,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  className: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(className)}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-current" strokeWidth={2} aria-hidden />
      ) : (
        <RefreshCw className="h-3.5 w-3.5 shrink-0 text-current" strokeWidth={2} aria-hidden />
      )}
    </Button>
  );
}

export function WireframesPanel({
  content,
  onContentChange,
  onSave,
  isDirty,
  viewMode,
  onGenerate,
  canGenerate,
  prerequisiteHint,
  isLoading,
  isGenerating,
  placeholder,
  onBlur,
  progress,
  stepsHistory,
  projectId,
  onCancel,
  useCasesContent,
  userStoriesContent,
  specContent,
}: WireframesPanelProps) {
  const isEmpty = !content?.trim();
  const screens = useMemo(() => (content ? parseScreens(content) : []), [content]);
  const showStepper = isGenerating && stepsHistory != null && stepsHistory.length > 0;

  const [activeScreenTab, setActiveScreenTab] = useState(ALL_SCREENS_TAB);

  const wireframesPreviewSession = useWorkshopStore((s) => s.wireframesPreviewSession);
  const setWireframesPreviewSession = useWorkshopStore((s) => s.setWireframesPreviewSession);

  const [wireframesHash, setWireframesHash] = useState<string | null>(null);
  const [previewSnippets, setPreviewSnippets] = useState<PreviewScreenData[] | null>(null);
  const [screenSketches, setScreenSketches] = useState<ScreenSketchPayload[]>([]);
  const [sketchesStale, setSketchesStale] = useState(false);
  const [sketchesStaleReason, setSketchesStaleReason] = useState<"mdd" | "screens" | "missing" | undefined>();
  const [sketchesSyncing, setSketchesSyncing] = useState(false);
  const [sketchesRegenerating, setSketchesRegenerating] = useState(false);
  const [regeneratingScreenKeys, setRegeneratingScreenKeys] = useState<Set<string>>(() => new Set());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void contentDigestHash(content ?? "").then((hash) => {
      if (!cancelled) setWireframesHash(hash || null);
    });
    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => {
    setPreviewSnippets(null);
    setScreenSketches([]);
    setSketchesStale(false);
    setSketchesStaleReason(undefined);
    setPreviewError(null);
  }, [wireframesHash, projectId]);

  const previewLoadingRef = useRef(false);
  const screenRegenInFlightRef = useRef<Set<string>>(new Set());
  const sketchAutoPollRef = useRef(false);

  type SketchesStatus = {
    screenSketches?: ScreenSketchPayload[];
    sketchesStale?: boolean;
    sketchesStaleReason?: "mdd" | "screens" | "missing";
    syncing?: boolean;
    accepted?: boolean;
  };

  const applySketchStatus = useCallback(
    (data: SketchesStatus) => {
      const sketches = dedupeScreenSketches(data.screenSketches ?? [], screens);
      setScreenSketches(sketches);
      setSketchesStale(data.sketchesStale === true);
      setSketchesStaleReason(data.sketchesStaleReason);
      setSketchesSyncing(data.syncing === true);
      if (projectId && wireframesHash && previewSnippets !== null) {
        setWireframesPreviewSession({
          projectId,
          wireframesHash,
          screens: previewSnippets,
          screenSketches: sketches,
          sketchesStale: data.sketchesStale === true,
          sketchesStaleReason: data.sketchesStaleReason,
        });
      }
      return sketches.length;
    },
    [screens, projectId, wireframesHash, previewSnippets, setWireframesPreviewSession],
  );

  const refreshSketchesQuietly = useCallback(async () => {
    if (!projectId) return;
    try {
      const { apiFetch, API_BASE } = await import("../utils/apiClient");
      const res = await apiFetch(
        `${API_BASE}/ai-analysis/wireframes/sketches?projectId=${encodeURIComponent(projectId)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as SketchesStatus;
      applySketchStatus(data);
    } catch {
      /* best-effort */
    }
  }, [projectId, applySketchStatus]);

  useEffect(() => {
    if (viewMode !== "preview" || !projectId || !wireframesHash) return;

    const sessionHit =
      wireframesPreviewSession?.projectId === projectId &&
      wireframesPreviewSession.wireframesHash === wireframesHash;

    if (sessionHit && previewSnippets === null) {
      setPreviewSnippets(wireframesPreviewSession.screens as PreviewScreenData[]);
      setScreenSketches(dedupeScreenSketches(wireframesPreviewSession.screenSketches, screens));
      setSketchesStale(wireframesPreviewSession.sketchesStale);
      setSketchesStaleReason(wireframesPreviewSession.sketchesStaleReason);
      void refreshSketchesQuietly();
      return;
    }

    if (previewSnippets !== null || previewLoadingRef.current) return;

    let cancelled = false;
    previewLoadingRef.current = true;
    setPreviewLoading(true);
    setPreviewError(null);

    (async () => {
      try {
        const { apiFetch, API_BASE } = await import("../utils/apiClient");
        const res = await apiFetch(`${API_BASE}/ai-analysis/wireframes/preview-snippets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          screens?: PreviewScreenData[];
          screenSketches?: ScreenSketchPayload[];
          sketchesStale?: boolean;
          sketchesStaleReason?: "mdd" | "screens" | "missing";
          wireframesHash?: string;
          fromCache?: boolean;
        };
        const previewScreens = data.screens ?? [];
        const sketches = dedupeScreenSketches(data.screenSketches ?? [], screens);
        const hash = data.wireframesHash ?? wireframesHash;
        if (!cancelled) {
          setPreviewSnippets(previewScreens);
          setScreenSketches(sketches);
          setSketchesStale(data.sketchesStale === true);
          setSketchesStaleReason(data.sketchesStaleReason);
          const session: WireframesPreviewSession = {
            projectId,
            wireframesHash: hash,
            screens: previewScreens,
            screenSketches: sketches,
            sketchesStale: data.sketchesStale === true,
            sketchesStaleReason: data.sketchesStaleReason,
          };
          setWireframesPreviewSession(session);
        }
      } catch (e) {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : "Error al cargar preview");
        }
      } finally {
        previewLoadingRef.current = false;
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    viewMode,
    projectId,
    wireframesHash,
    wireframesPreviewSession,
    previewSnippets,
    refreshSketchesQuietly,
    setWireframesPreviewSession,
  ]);

  const pollSketchSync = useCallback(
    async (maxWaitMs: number, pollMs = 3000) => {
      if (!projectId) return null;
      const { apiFetch, API_BASE } = await import("../utils/apiClient");
      const started = Date.now();
      let last: SketchesStatus | null = null;
      while (Date.now() - started < maxWaitMs) {
        const pollRes = await apiFetch(
          `${API_BASE}/ai-analysis/wireframes/sketches?projectId=${encodeURIComponent(projectId)}`,
        );
        if (!pollRes.ok) {
          await new Promise((r) => setTimeout(r, pollMs));
          continue;
        }
        last = (await pollRes.json()) as SketchesStatus;
        applySketchStatus(last);
        if (!last.syncing) {
          setSketchesSyncing(false);
          return last;
        }
        await new Promise((r) => setTimeout(r, pollMs));
      }
      setSketchesSyncing(last?.syncing === true);
      return last;
    },
    [projectId, applySketchStatus],
  );

  useEffect(() => {
    if (viewMode !== "preview" || !projectId || previewLoading || previewSnippets === null) return;
    if (!sketchesSyncing) return;
    if (sketchAutoPollRef.current || sketchesRegenerating) return;

    sketchAutoPollRef.current = true;
    let cancelled = false;

    void pollSketchSync(45 * 60 * 1000).finally(() => {
      if (!cancelled) sketchAutoPollRef.current = false;
    });

    return () => {
      cancelled = true;
      sketchAutoPollRef.current = false;
    };
  }, [
    viewMode,
    projectId,
    previewLoading,
    previewSnippets,
    sketchesSyncing,
    sketchesRegenerating,
    wireframesHash,
    pollSketchSync,
  ]);

  const sketchRegenDisabled = sketchesRegenerating || !projectId;

  const regenerateScreenBoceto = useCallback(
    async (screenName: string) => {
      if (!projectId || sketchRegenDisabled) return;
      const key = normalizeScreenKey(screenName);
      if (screenRegenInFlightRef.current.has(key)) return;
      screenRegenInFlightRef.current.add(key);
      setRegeneratingScreenKeys((prev) => new Set(prev).add(key));
      setPreviewError(null);
      try {
        const { apiFetch, API_BASE } = await import("../utils/apiClient");
        const res = await apiFetch(`${API_BASE}/ai-analysis/wireframes/sync-sketches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, async: true, screenNames: [screenName] }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const final = await pollSketchSync(10 * 60 * 1000);
        if (final?.syncing) {
          setPreviewError(`El boceto de «${screenName}» sigue generándose en el servidor.`);
        }
      } catch (e) {
        console.error("[WireframesPreview] sync-screen failed", e);
        setPreviewError(
          e instanceof Error ? e.message : `Error al regenerar boceto de ${screenName}`,
        );
      } finally {
        screenRegenInFlightRef.current.delete(key);
        setRegeneratingScreenKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [projectId, sketchRegenDisabled, pollSketchSync],
  );

  const regenerateBocetos = async () => {
    if (!projectId || sketchesRegenerating) return;
    setSketchesRegenerating(true);
    setPreviewError(null);
    console.log("[WireframesPreview] sync-sketches start", { projectId, forceAll: true, async: true });
    try {
      const { apiFetch, API_BASE } = await import("../utils/apiClient");
      const res = await apiFetch(`${API_BASE}/ai-analysis/wireframes/sync-sketches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, forceAll: true, async: true }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("[WireframesPreview] sync-sketches error body", errBody.slice(0, 500));
        throw new Error(`HTTP ${res.status}`);
      }

      const initial = (await res.json()) as SketchesStatus;
      applySketchStatus(initial);

      const finalStatus = (await pollSketchSync(45 * 60 * 1000)) ?? initial;
      const finalCount = applySketchStatus(finalStatus);

      if (finalStatus.syncing) {
        setPreviewError(
          "La generación sigue en curso en el servidor. Los bocetos aparecerán al terminar; recarga en unos minutos.",
        );
      } else if (finalCount === 0) {
        setPreviewError("No se generaron bocetos. Revisa la consola del API (SketchSync).");
      }
    } catch (e) {
      console.error("[WireframesPreview] sync-sketches failed", e);
      setPreviewError(e instanceof Error ? e.message : "Error al regenerar bocetos");
    } finally {
      setSketchesRegenerating(false);
    }
  };

  const sketchByScreenKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const sk of screenSketches) {
      const html = sk.html?.trim();
      if (html) m.set(normalizeScreenKey(sk.screenName), html);
    }
    return m;
  }, [screenSketches]);

  const allScreenEntries = useMemo<ScreenPreviewEntry[]>(() => {
    const map = new Map<string, ScreenPreviewEntry>();
    const register = (entry: ScreenPreviewEntry, aliasKeys: string[]) => {
      for (const alias of aliasKeys) map.set(alias, entry);
    };

    for (const s of screens) {
      const key = normalizeScreenKey(s.name);
      const title = s.name.replace(/^Pantalla:\s*/i, "").trim() || s.name;
      const sketch =
        sketchByScreenKey.get(key) ??
        (s.screenId ? sketchByScreenKey.get(normalizeScreenKey(s.screenId)) : undefined);
      register(
        { key, title, parsed: s, screenSketchHtml: sketch },
        screenLookupKeys(s),
      );
    }
    for (const p of previewSnippets ?? []) {
      const key = normalizeScreenKey(p.screenName);
      const matched = screens.find((s) => screenLookupKeys(s).includes(key));
      const canonicalKey = matched ? normalizeScreenKey(matched.name) : key;
      const sketch =
        p.screenSketchHtml?.trim() ||
        sketchByScreenKey.get(canonicalKey) ||
        sketchByScreenKey.get(key);
      const existing = map.get(canonicalKey) ?? map.get(key);
      if (existing) {
        existing.preview = p;
        if (sketch) existing.screenSketchHtml = sketch;
      } else {
        register(
          {
            key: canonicalKey,
            title: matched?.name ?? p.screenName,
            preview: p,
            screenSketchHtml: sketch,
          },
          matched ? screenLookupKeys(matched) : [key],
        );
      }
    }
    return [...new Set(map.values())];
  }, [screens, previewSnippets, sketchByScreenKey]);

  const hasPreviewContent = useMemo(() => {
    const componentCount = (previewSnippets ?? []).reduce(
      (n, s) => n + (s.components?.length ?? 0),
      0,
    );
    return componentCount > 0 || screenSketches.length > 0 || screens.length > 0;
  }, [previewSnippets, screenSketches, screens]);

  const screenTabs = useMemo<UnderlineTabItem[]>(() => {
    if (allScreenEntries.length === 0) return [];
    const tabs: UnderlineTabItem[] = [
      { id: ALL_SCREENS_TAB, label: "Todas", icon: LayoutGrid },
    ];
    for (const entry of allScreenEntries) {
      tabs.push({
        id: entry.key,
        label: entry.title,
        icon: Monitor,
      });
    }
    return tabs;
  }, [allScreenEntries]);

  const visibleScreens = useMemo(() => {
    if (activeScreenTab === ALL_SCREENS_TAB) return screens;
    const found = findParsedScreenByKey(screens, activeScreenTab);
    return found ? [found] : screens;
  }, [screens, activeScreenTab]);

  const visiblePreviewEntries = useMemo(() => {
    if (activeScreenTab === ALL_SCREENS_TAB) return allScreenEntries;
    const one = allScreenEntries.find((e) => e.key === activeScreenTab);
    return one ? [one] : allScreenEntries;
  }, [allScreenEntries, activeScreenTab]);

  if (showStepper && isEmpty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4">
        <WireframesProgressStepper
          stepsHistory={stepsHistory ?? []}
          currentProgress={progress ?? null}
        />
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-red-600 dark:hover:text-red-400"
            onClick={onCancel}
          >
            <Square className="h-3 w-3 fill-current" strokeWidth={2} aria-hidden />
            Detener generación
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty && (viewMode === "wireframe" || viewMode === "preview")) {
    return (
      <DocEmptyState
        icon={Monitor}
        title="Wireframes"
        description="Mapeo visual de pantallas con componentes del design system (MCP). Requiere Design System generado y casos de uso o historias de usuario."
        onGenerate={onGenerate}
        loading={isGenerating || isLoading}
        hasMdd={canGenerate}
        generateButtonLabel="Generar Wireframes"
        prerequisiteHint={
          prerequisiteHint ??
          "Genera el Design System antes de crear wireframes."
        }
      />
    );
  }

  return (
    <>
      {showStepper && (
        <div className="mb-4 px-1">
          <WireframesProgressStepper
            stepsHistory={stepsHistory ?? []}
            currentProgress={progress ?? null}
          />
          {onCancel && (
            <div className="mt-2 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-red-600 dark:hover:text-red-400"
                onClick={onCancel}
              >
                <Square className="h-3 w-3 fill-current" strokeWidth={2} aria-hidden />
                Detener generación
              </Button>
            </div>
          )}
        </div>
      )}
      {viewMode === "wireframe" ? (
        <div key="wireframe-view" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {screenTabs.length > 0 && (
            <div className="shrink-0 px-1">
              <UnderlineTabs
                tabs={screenTabs}
                value={activeScreenTab}
                onValueChange={setActiveScreenTab}
                ariaLabel="Pantallas del wireframe"
                idPrefix="wf-screen"
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            {visibleScreens.length > 0 ? (
              activeScreenTab === ALL_SCREENS_TAB ? (
                <div className="grid gap-4 p-1 pt-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {visibleScreens.map((screen) => {
                    const screenKey = normalizeScreenKey(screen.name);
                    return (
                      <ScreenCard
                        key={screen.name}
                        screen={screen}
                        compact
                        onRegenerateSketch={
                          projectId ? () => void regenerateScreenBoceto(screen.name) : undefined
                        }
                        regeneratingSketch={regeneratingScreenKeys.has(screenKey)}
                        regenerateSketchDisabled={sketchRegenDisabled}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="mx-auto max-w-4xl p-1 pt-3">
                  <ScreenCard
                    screen={visibleScreens[0]}
                    onRegenerateSketch={
                      projectId
                        ? () => void regenerateScreenBoceto(visibleScreens[0]!.name)
                        : undefined
                    }
                    regeneratingSketch={regeneratingScreenKeys.has(
                      normalizeScreenKey(visibleScreens[0]!.name),
                    )}
                    regenerateSketchDisabled={sketchRegenDisabled}
                  />
                </div>
              )
            ) : (
              <MddViewer content={content ?? ""} />
            )}
          </div>
        </div>
      ) : viewMode === "preview" ? (
        <div key="preview-view" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {previewLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--muted-foreground)]">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              <span className="text-sm">Cargando vista previa…</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                Cargando previews y bocetos guardados…
              </span>
            </div>
          ) : previewError ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {previewError}
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <MddViewer content={content ?? ""} />
              </div>
            </div>
          ) : previewSnippets !== null && hasPreviewContent ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 px-1">
                <UnderlineTabs
                  tabs={[{ id: "pantallas", label: "pantallas", icon: Monitor }]}
                  value="pantallas"
                  onValueChange={() => {}}
                  ariaLabel="Vista de preview"
                  idPrefix="wf-preview"
                />
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                {sketchesSyncing ? (
                  <p className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" aria-hidden />
                    Generando bocetos en el servidor…
                  </p>
                ) : sketchesStale ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {sketchesStaleReason === "mdd"
                      ? "El MDD cambió: los bocetos pueden estar desactualizados."
                      : sketchesStaleReason === "missing"
                        ? "Aún no hay bocetos generados para este documento."
                        : "Algunas pantallas cambiaron en el markdown."}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Bocetos generados al crear o guardar wireframes.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={sketchesRegenerating || !projectId}
                  onClick={() => void regenerateBocetos()}
                >
                  {sketchesRegenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Regenerar bocetos
                </Button>
              </div>
              {screenTabs.length > 1 && (
                <div className="shrink-0 border-b border-[var(--border)] px-1 pb-2">
                  <UnderlineTabs
                    tabs={screenTabs}
                    value={activeScreenTab}
                    onValueChange={setActiveScreenTab}
                    ariaLabel="pantallas"
                    idPrefix="wf-preview-screen"
                  />
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="mx-auto max-w-4xl space-y-6 p-1 pt-3">
                  {visiblePreviewEntries.map((entry) => {
                    const parsedScreen =
                      entry.parsed ?? findParsedScreenByKey(screens, entry.title);
                    const requirementsContext = collectRequirementsContext(
                      useCasesContent ?? "",
                      userStoriesContent ?? "",
                      [
                        ...(parsedScreen?.useCases ?? []),
                        ...(parsedScreen?.userStories ?? []),
                      ],
                      specContent ?? "",
                    );
                    const screenKey = entry.key;
                    return (
                      <div key={entry.key} className="space-y-3">
                        <ScreenSketchCanvas
                          screenTitle={entry.title}
                          parsedScreen={parsedScreen}
                          previewComponents={entry.preview?.components ?? []}
                          requirementsContext={requirementsContext}
                          agentSketchHtml={entry.screenSketchHtml}
                          onRegenerateSketch={
                            projectId
                              ? () => void regenerateScreenBoceto(entry.title)
                              : undefined
                          }
                          regeneratingSketch={regeneratingScreenKeys.has(screenKey)}
                          regenerateSketchDisabled={sketchRegenDisabled}
                        />
                        {!parsedScreen?.wireframeAscii && (
                          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            Sin wireframe ASCII en el markdown para {entry.title}.
                          </div>
                        )}
                        {parsedScreen && parsedScreen.dsComponents.length > 0 && (
                          <DsComponentsTable mappings={parsedScreen.dsComponents} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No se encontraron snippets de componentes. Verifica que el MCP del design system esté configurado.
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <MddViewer content={content ?? ""} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <WorkshopDocSourceSaveBar onSave={onSave} disabled={!isDirty} />
          <textarea
            value={content ?? ""}
            onChange={(e) => onContentChange(e.target.value || null)}
            onBlur={onBlur}
            placeholder={
              placeholder ??
              "# Wireframes\n\nPantallas, componentes y flujo de navegación del producto..."
            }
            className="min-h-0 w-full flex-1 resize-none rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] p-4 font-mono text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--primary)]"
            spellCheck={false}
          />
        </div>
      )}
      {isEmpty && viewMode === "source" && (
        <div className="mt-4 flex min-h-[200px] w-full shrink-0 justify-center sm:justify-end">
          {isGenerating || isLoading ? (
            <AiDocumentBuildingPlaceholder documentTitle="Wireframes" />
          ) : (
            <Button
              type="button"
              variant="default"
              size="default"
              className={cn("w-full max-w-md sm:w-auto sm:min-w-[280px]", WORKSHOP_DOC_EMPTY_PRIMARY_BTN)}
              onClick={onGenerate}
              disabled={isGenerating || isLoading || !canGenerate}
            >
              <Sparkles className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
              Generar Wireframes
            </Button>
          )}
        </div>
      )}
    </>
  );
}
