import { FileText, ListOrdered, MonitorSmartphone, Play, RefreshCw } from "lucide-react";
import { formatPantallasMarkdownForPreview } from "@theforge/shared-types";
import { StandardDocPanel } from "@/components/StandardDocPanel";
import { DocumentClarificationSection } from "@/components/DocumentClarificationSection";
import { BrdStagePanel } from "@/components/BrdStagePanel";
import { Button } from "@/components/ui";
import {
  WorkshopDirtySaveBar,
  WorkshopPanelButton,
  WorkshopButtonIcon,
} from "@/components/WorkshopButtons";
import type { WorkshopSpecBrdAemPanelsProps } from "./workshopSpecBrdAemPanels.types";

export function WorkshopSpecBrdAemPanels({
  centralPanel,
  projectId,
  activeStageId,
  effectiveMddTrimmed,
  dbgaContent,
  specContent,
  aemContent,
  uiScreensContent,
  brdWorkshopDraft,
  brdDocViewMode,
  specViewMode,
  aemViewMode,
  specDirty,
  aemDirty,
  brdWorkshopDirty,
  brdTobePersistBusy,
  loading,
  loadingReason,
  canGenerateFromCodebase,
  canGenerateAem,
  deliverablesReadOnly,
  clarifySpecDialogOpen,
  isLegacyProject,
  activeLegacyState,
  activeStageBrdContent,
  stageDeliverableView,
  docTs,
  buildDocClarification,
  onSpecContentChange,
  onAemContentChange,
  onBrdWorkshopDraftChange,
  onClarifySpecDialogOpenChange,
  onPersistSpecContent,
  onPersistAemContent,
  onPersistBrdWorkshopDraft,
  onGenerateSpec,
  onOpenAemGenerateDialog,
  onSyncUiScreens,
  onSpecBlur,
  onAemBlur,
  onFetchProject,
  onLegacyGenerateSpec,
  onLegacySuggestBrdFromCodebase,
}: WorkshopSpecBrdAemPanelsProps) {
  if (centralPanel === "spec") {
    return (
                    <>
                      {stageDeliverableView?.source === "snapshot" ? (
                        <div
                          role="status"
                          className="mb-3 rounded-lg bg-[color-mix(in_oklch,var(--info)_8%,var(--card))] px-3 py-2 text-xs leading-relaxed text-[color-mix(in_oklch,var(--info)_88%,var(--foreground))]"
                        >
                          Viendo entregables congelados de etapa {stageDeliverableView.ordinal}
                          {stageDeliverableView.snapshotCapturedAt
                            ? ` · ${new Date(stageDeliverableView.snapshotCapturedAt).toLocaleString()}`
                            : ""}
                        </div>
                      ) : null}
                      <StandardDocPanel
                      icon={ListOrdered}
                      title="Spec"
                      description="Spec = Benchmark + alcance. Alimenta el MDD; revísalo antes de dar por cerrado el MDD."
                      content={specContent}
                      onContentChange={(v) => onSpecContentChange(v)}
                      onSave={() => void onPersistSpecContent()}
                      isDirty={specDirty}
                      viewMode={specViewMode}
                      onGenerate={() => onGenerateSpec()}
                      canGenerate={!!(dbgaContent?.trim() || effectiveMddTrimmed)}
                      isLoading={loading}
                      placeholder="# Spec\n\nEl contenido del Spec se genera aquí o puedes escribirlo manualmente..."
                      onBlur={onSpecBlur}
                      legacyGenerateLabel={canGenerateFromCodebase ? "Generar Spec desde MDD Inicial" : undefined}
                      onLegacyGenerate={canGenerateFromCodebase ? () => onLegacyGenerateSpec() : undefined}
                      legacyGenerateLoading={loading && loadingReason === "legacy-brd-suggest"}
                      readOnly={deliverablesReadOnly}
                      documentTimestamps={docTs("specContent")}
                      clarification={buildDocClarification(
                        "specContent",
                        (c) => onSpecContentChange(c),
                        undefined,
                        {
                          clarifyOpen: clarifySpecDialogOpen,
                          onClarifyOpenChange: onClarifySpecDialogOpenChange,
                        },
                      )}
                    />
                    </>
    );
  }

  if (centralPanel === "aem") {
    return (
                    <StandardDocPanel
                      icon={FileText}
                      title="AEM"
                      description="Análisis y Estudio de Mercado — inteligencia de mercado, competencia, monetización, glosario y dictamen de inversión digital (SEGUIR / NO SEGUIR / SEGUIR CON CONDICIONES)."
                      content={aemContent}
                      onContentChange={(v) => onAemContentChange(v)}
                      onSave={() => void onPersistAemContent()}
                      isDirty={aemDirty}
                      viewMode={aemViewMode}
                      onGenerate={() => onOpenAemGenerateDialog()}
                      canGenerate={canGenerateAem}
                      isLoading={loading && loadingReason === "aem"}
                      generateLabel="Generar AEM"
                      placeholder="# Análisis y Estudio de Mercado (AEM)\n\nMercado, competencia, planes de monetización y glosario..."
                      onBlur={onAemBlur}
                      generateBlocked={!canGenerateAem}
                      generateBlockedReason="Completa al menos Benchmark (Deep Research), Fase 0 (DBGA) o BRD antes de generar."
                      documentTimestamps={docTs("aemContent")}
                      clarification={buildDocClarification("aemContent", (c) => onAemContentChange(c))}
                    />
    );
  }

  if (centralPanel === "ui-screens") {
    return (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                      <div className="mb-1 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-[color-mix(in_oklch,var(--primary)_28%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] px-3 py-2.5">
                        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[color-mix(in_oklch,var(--primary)_62%,var(--foreground))]">
                          <strong>Pantallas / UI Screens Spec</strong> — documento de texto generado desde el MCP gráfico compatible activo. Lista las pantallas con los componentes reales de la librería conectada, la entidad de dominio asociada y el binding a endpoints. Se regenera al sincronizar (deriva de las entidades del §3 del MDD).
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => void onSyncUiScreens()}
                            disabled={loading}
                            aria-label="Sincronizar Pantallas"
                          >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                            Sincronizar Pantallas
                          </Button>
                        </div>
                      </div>
                      <StandardDocPanel
                        icon={MonitorSmartphone}
                        title="Pantallas / UI Screens Spec"
                        description="Pantallas con componentes reales del MCP gráfico conectado. Pulsa «Sincronizar Pantallas» para (re)generarlo desde las entidades del MDD."
                        content={
                          uiScreensContent
                            ? formatPantallasMarkdownForPreview(uiScreensContent)
                            : uiScreensContent
                        }
                        onContentChange={() => {}}
                        onSave={() => {}}
                        isDirty={false}
                        viewMode="preview"
                        readOnly
                        onGenerate={() => void onSyncUiScreens()}
                        canGenerate={!loading}
                        isLoading={loading}
                        generateLabel="Sincronizar Pantallas"
                        placeholder="# Pantallas\n\nPulsa «Sincronizar Pantallas» para generarlo desde el MCP gráfico conectado."
                        documentTimestamps={docTs("uiScreensContent")}
                        clarification={buildDocClarification("uiScreensContent", () => {
                          void onFetchProject(projectId);
                        })}
                      />
                    </div>
    );
  }

  if (centralPanel === "brd" && projectId) {
    return (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                      {/* Legacy: generar BRD desde codebaseDoc (AS-IS) antes de describir cambios */}
                      {isLegacyProject && (activeLegacyState?.codebaseDoc ?? "").trim().length > 0 && !brdWorkshopDraft.trim() && (
                        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color-mix(in_oklch,var(--primary)_28%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] px-3 py-2.5">
                          <span className="text-sm text-[color-mix(in_oklch,var(--primary)_62%,var(--foreground))]">
                            Documenta requisitos AS-IS desde el codebase existente.
                          </span>
                          <WorkshopPanelButton
                            tone="primary"
                            onClick={() => void onLegacySuggestBrdFromCodebase()}
                            disabled={loading && loadingReason === "legacy-brd-suggest"}
                            loading={loading && loadingReason === "legacy-brd-suggest"}
                          >
                            {!loading || loadingReason !== "legacy-brd-suggest" ? (
                              <WorkshopButtonIcon icon={Play} tone="primary" />
                            ) : null}
                            Generar BRD desde MDD Inicial
                          </WorkshopPanelButton>
                        </div>
                      )}
                      {brdWorkshopDirty && (
                        <WorkshopDirtySaveBar
                          message="Cambios sin guardar en el BRD de esta etapa."
                          onCancel={() => onBrdWorkshopDraftChange(activeStageBrdContent ?? "")}
                          onSave={() => void onPersistBrdWorkshopDraft()}
                          saving={brdTobePersistBusy}
                          disabled={brdTobePersistBusy}
                          className="py-2"
                        />
                      )}
                      {buildDocClarification("brdContent", (c) => {
                        onBrdWorkshopDraftChange(c);
                        void onFetchProject(projectId);
                      }) ? (
                        <DocumentClarificationSection
                          {...buildDocClarification("brdContent", (c) => {
                            onBrdWorkshopDraftChange(c);
                            void onFetchProject(projectId);
                          })!}
                          content={brdWorkshopDraft}
                        />
                      ) : null}
                      <BrdStagePanel
                        projectId={projectId}
                        activeStageId={activeStageId}
                        brdContent={brdWorkshopDraft}
                        onBrdContentChange={onBrdWorkshopDraftChange}
                        docViewMode={brdDocViewMode}
                        documentTimestamps={docTs("brdContent")}
                      />
                    </div>
    );
  }

  return null;
}
