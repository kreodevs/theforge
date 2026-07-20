import { AlertTriangle, ArrowRight, Globe, History, Loader2, Play, Rocket, Trash2 } from "lucide-react";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import MddViewer from "@/components/MddViewer";
import { DocEmptyState } from "@/components/DocEmptyState";
import { DocumentClarificationSection } from "@/components/DocumentClarificationSection";
import { Phase0InterviewPanel } from "@/components/Phase0InterviewPanel";
import { Phase0PastePanel } from "@/components/Phase0PastePanel";
import { Phase0ManualAudit } from "@/components/Phase0ManualAudit";
import { WorkshopDocumentStampBar } from "@/components/WorkshopDocumentStampBar";
import { WorkshopDocTextarea } from "@/components/WorkshopDocTextarea";
import {
  WorkshopPanelActionRegion,
  WorkshopPanelButton,
  WorkshopButtonIcon,
} from "@/components/WorkshopButtons";
import type { WorkshopBenchmarkPanelProps } from "./workshopBenchmarkPanel.types";

export function WorkshopBenchmarkPanel({
  projectId,
  mergeAudit,
  dbgaContent,
  specContent,
  fase0Content,
  phase0IsEmpty,
  phase0EntryMode,
  benchmarkPhaseTab,
  benchmarkViewMode,
  phase0SummaryViewMode,
  benchmarkMarkdown,
  benchmarkNeedsRegenerate,
  phase0SummaryContent,
  loading,
  loadingReason,
  lastBenchmarkIdea,
  docTs,
  buildDocClarification,
  onBenchmarkPhaseTabChange,
  onPhase0Complete,
  onNavigatePanel,
  onDbgaRestoreOpen,
  onDbgaContentChange,
  onPhase0SummaryContentChange,
  onBenchmarkBlur,
  onPhase0SummaryBlur,
  onSuggestBrdFromDbga,
  onClearDbgaContent,
  onClearPhase0SummaryContent,
  onPhase0DeepResearch,
  onFetchProject,
}: WorkshopBenchmarkPanelProps) {
  return (
                  <>
                    <UnderlineTabs
                      className="mb-4"
                      tabs={[
                        { id: "fase0", label: "Fase 0" },
                        { id: "benchmark", label: "Benchmark" },
                      ]}
                      value={benchmarkPhaseTab}
                      onValueChange={onBenchmarkPhaseTabChange}
                      ariaLabel="Secciones de benchmark"
                    />
    
                    {benchmarkPhaseTab === "fase0" ? (
                      phase0IsEmpty ? (
                        phase0EntryMode === "paste" ? (
                          <Phase0PastePanel projectId={projectId} onComplete={onPhase0Complete} />
                        ) : (
                          <Phase0InterviewPanel projectId={projectId} onComplete={onPhase0Complete} />
                        )
                      ) : (
                      <>
                        {loading && loadingReason === "phase0-deep-research" && (
                          <div className="shrink-0 rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] border border-[color-mix(in_oklch,var(--primary)_28%,var(--border))] px-4 py-2 mb-2 text-sm text-[color-mix(in_oklch,var(--primary)_65%,var(--foreground))] flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span>Generando Deep Research… Suele tardar 1–2 minutos; no cierres la página.</span>
                          </div>
                        )}
                        <WorkshopPanelActionRegion role="region" aria-label="Acciones de Fase 0">
                          <div className="flex flex-wrap items-center gap-2">
                            <WorkshopPanelButton
                              tone="primary"
                              onClick={async () => {
                                await onSuggestBrdFromDbga();
                                onNavigatePanel("brd");
                              }}
                              disabled={loading && loadingReason === "brd-from-dbga"}
                              loading={loading && loadingReason === "brd-from-dbga"}
                              title="Generar BRD desde el Benchmark (DBGA); luego revisa y aprueba en el tab BRD"
                            >
                              {!loading || loadingReason !== "brd-from-dbga" ? (
                                <WorkshopButtonIcon icon={Play} tone="primary" />
                              ) : null}
                              Generar BRD con agentes
                            </WorkshopPanelButton>
                            <WorkshopPanelButton
                              tone="secondary"
                              onClick={() => {
                                onNavigatePanel("brd");
                              }}
                              title="Ir a BRD y editar manualmente o usar el chat"
                            >
                              <WorkshopButtonIcon icon={ArrowRight} tone="secondary" />
                              Ir a BRD (editar)
                            </WorkshopPanelButton>
                            {dbgaContent != null && dbgaContent !== "" && (
                              <WorkshopPanelButton
                                tone="secondary"
                                onClick={() => onDbgaRestoreOpen()}
                                title="Ver y restaurar copias automáticas del DBGA guardadas antes de cada cambio"
                              >
                                <WorkshopButtonIcon icon={History} tone="secondary" />
                                Versiones anteriores
                              </WorkshopPanelButton>
                            )}
                            {dbgaContent != null && dbgaContent !== '' && (
                              <WorkshopPanelButton
                                tone="danger"
                                onClick={() => projectId && onClearDbgaContent(projectId)}
                                title="Borrar el contenido de Fase 0 (podrás generar uno nuevo después)"
                              >
                                <WorkshopButtonIcon icon={Trash2} tone="danger" />
                                Borrar Fase 0
                              </WorkshopPanelButton>
                            )}
                          </div>
                          {!dbgaContent?.trim() && !specContent?.trim() ? (
                            <p className="text-sm leading-relaxed text-[var(--foreground-subtle)]">
                              Escribe tu idea en el chat y pulsa <strong>Generar</strong> para crear el análisis DBGA.
                            </p>
                          ) : null}
                        </WorkshopPanelActionRegion>
    
                        <Phase0ManualAudit
                          projectId={projectId}
                          initialAudit={mergeAudit}
                          onUpdated={async () => {
                            await onFetchProject(projectId);
                          }}
                        />
    
                        <div className="flex-1 flex flex-col min-h-0 border-t border-[var(--border)] pt-4 mt-4">
                            {buildDocClarification("dbgaContent", (c) => onDbgaContentChange(c)) ? (
                              <DocumentClarificationSection
                                {...buildDocClarification("dbgaContent", (c) => onDbgaContentChange(c))!}
                                content={fase0Content}
                              />
                            ) : null}
                            <h3 className="shrink-0 text-sm font-medium text-[var(--muted-foreground)] mb-2">Análisis (DBGA) — Fase 0</h3>
                            <div className="flex-1 flex flex-col min-h-0">
                              {benchmarkViewMode === "preview" && fase0Content != null && fase0Content !== "" ? (
                                <div className="flex-1 min-h-[200px] overflow-auto">
                                  <MddViewer content={fase0Content} documentTimestamps={docTs("dbgaContent")} />
                                </div>
                              ) : (
                                <>
                                  <WorkshopDocumentStampBar timestamps={docTs("dbgaContent")} />
                                  <WorkshopDocTextarea
                                  value={fase0Content ?? ""}
                                  onChange={(v) => onDbgaContentChange(v)}
                                  onBlur={onBenchmarkBlur}
                                  placeholder="# Domain Benchmark & Gap Analysis..."
                                  className="flex-1 min-h-[200px] w-full bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] border border-[var(--border)] rounded-lg p-4 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none resize-none"
                                  spellCheck={false}
                                />
                                </>
                              )}
                            </div>
                          </div>
                      </>
                      )) : (
                      <>
                        {phase0SummaryViewMode === "preview" && !benchmarkMarkdown?.trim() ? (
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                            {benchmarkNeedsRegenerate ? (
                              <div className="shrink-0 rounded-lg bg-[color-mix(in_oklch,var(--warning)_12%,var(--card))] border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] px-4 py-2 mb-3 text-sm text-[color-mix(in_oklch,var(--warning)_75%,var(--foreground))] flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>
                                  Actualizaste Fase 0 y el benchmark anterior quedó desincronizado. Pulsa «Generar Benchmark» para volver a formatearlo.
                                </span>
                              </div>
                            ) : null}
                            <DocEmptyState
                              icon={Globe}
                              title="Benchmark"
                              description="Deep Research y gap analysis a partir del análisis de Fase 0 (DBGA). Suele tardar 1–2 min."
                              onGenerate={() =>
                                void onPhase0DeepResearch(projectId, {
                                  userIdea: lastBenchmarkIdea.trim() || undefined,
                                  includeBenchmark: true,
                                })
                              }
                              loading={loading && loadingReason === "phase0-deep-research"}
                              hasMdd={!!dbgaContent?.trim()}
                              generateButtonLabel="Generar Benchmark"
                              prerequisiteHint="Completa el análisis en la pestaña Fase 0 antes de generar el Benchmark."
                            />
                          </div>
                        ) : (
                          <>
                            {loading && loadingReason === "phase0-deep-research" && (
                              <div className="shrink-0 rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] border border-[color-mix(in_oklch,var(--primary)_28%,var(--border))] px-4 py-2 mb-3 text-sm text-[color-mix(in_oklch,var(--primary)_65%,var(--foreground))] flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                <span>Generando Deep Research… Suele tardar 1–2 minutos; no cierres la página.</span>
                              </div>
                            )}
                            {phase0SummaryViewMode === "preview" ? (
                              <WorkshopPanelActionRegion role="region" aria-label="Acciones de Benchmark">
                                {benchmarkNeedsRegenerate ? (
                                  <div className="w-full shrink-0 rounded-lg bg-[color-mix(in_oklch,var(--warning)_12%,var(--card))] border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] px-4 py-2 mb-2 text-sm text-[color-mix(in_oklch,var(--warning)_75%,var(--foreground))] flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>
                                      El benchmark mostraba JSON del borrador tras editar Fase 0. Regenera para recuperar el markdown de Deep Research.
                                    </span>
                                  </div>
                                ) : null}
                                <div className="flex flex-wrap items-center gap-2">
                                  <WorkshopPanelButton
                                    tone="primary"
                                    onClick={async () => {
                                      await onPhase0DeepResearch(projectId, {
                                        userIdea: lastBenchmarkIdea.trim() || undefined,
                                        includeBenchmark: true,
                                      });
                                    }}
                                    disabled={loading || !dbgaContent?.trim()}
                                    loading={loading && loadingReason === "phase0-deep-research"}
                                    title="Generar Benchmark & Deep Research desde el análisis de Fase 0"
                                  >
                                    {!loading || loadingReason !== "phase0-deep-research" ? (
                                      <WorkshopButtonIcon icon={Rocket} tone="primary" />
                                    ) : null}
                                    {loading && loadingReason === "phase0-deep-research"
                                      ? "Generando…"
                                      : "Regenerar Benchmark"}
                                  </WorkshopPanelButton>
                                  {benchmarkMarkdown != null && benchmarkMarkdown !== "" ? (
                                    <WorkshopPanelButton
                                      tone="danger"
                                      onClick={() => projectId && onClearPhase0SummaryContent(projectId)}
                                      title="Borrar el resumen Benchmark (podrás generar uno nuevo desde Fase 0)"
                                    >
                                      <WorkshopButtonIcon icon={Trash2} tone="danger" />
                                      Borrar benchmark
                                    </WorkshopPanelButton>
                                  ) : null}
                                </div>
                                <p className="text-sm leading-relaxed text-[var(--foreground-subtle)]">
                                  Deep Research a partir del DBGA de Fase 0.
                                </p>
                              </WorkshopPanelActionRegion>
                            ) : benchmarkMarkdown != null && benchmarkMarkdown !== "" ? (
                              <WorkshopPanelActionRegion className="items-end" role="region" aria-label="Acciones de Benchmark">
                                <WorkshopPanelButton
                                  tone="danger"
                                  onClick={() => projectId && onClearPhase0SummaryContent(projectId)}
                                  title="Borrar el resumen Benchmark (podrás generar uno nuevo desde Fase 0)"
                                >
                                  <WorkshopButtonIcon icon={Trash2} tone="danger" />
                                  Borrar benchmark
                                </WorkshopPanelButton>
                              </WorkshopPanelActionRegion>
                            ) : null}
                            <div className="flex-1 flex flex-col min-h-0">
                              <div className="flex-1 flex flex-col min-h-0">
                                {phase0SummaryViewMode === "preview" &&
                                benchmarkMarkdown != null &&
                                benchmarkMarkdown !== "" ? (
                                  <div className="flex-1 min-h-[200px] overflow-auto">
                                    <MddViewer
                                      content={benchmarkMarkdown}
                                      documentTimestamps={docTs("dbgaContent")}
                                    />
                                  </div>
                                ) : (
                                  <WorkshopDocTextarea
                                    value={benchmarkNeedsRegenerate ? "" : (phase0SummaryContent ?? "")}
                                    onChange={(v) => onPhase0SummaryContentChange(v || null)}
                                    onBlur={onPhase0SummaryBlur}
                                    placeholder="# Resumen Deep Research..."
                                    className="flex-1 min-h-[200px] w-full bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] border border-[var(--border)] rounded-lg p-4 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none resize-none"
                                    spellCheck={false}
                                  />
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </>  );
}
