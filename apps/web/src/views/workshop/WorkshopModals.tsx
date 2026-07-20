import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { AemGenerateDialog } from "@/components/AemGenerateDialog";
import MddRegenerateDialog from "@/components/MddRegenerateDialog";
import { MddPatternsWizardDialog } from "@/components/MddPatternsWizardDialog";
import { ModelsUnavailableDialog } from "@/components/ModelsUnavailableDialog";
import WorkshopHelpModal from "@/components/WorkshopHelpModal";
import { WorkshopDbgaRestoreDialog } from "@/components/WorkshopDbgaRestoreDialog";
import { WorkshopFlowOrderModal } from "@/components/WorkshopFlowOrderModal";
import { WorkshopNewStageModal } from "@/components/WorkshopNewStageModal";
import { WorkshopAuditModal } from "./WorkshopAuditModal";
import type { WorkshopModalsProps } from "./workshopModals.types";

/** All Workshop overlays/dialogs (portaled; safe to mount once at view root). */
export function WorkshopModals({
  projectId,
  isLegacyProject,
  onOpenSettings,
  workshopStagesList,
  activeStageId,
  createWorkshopStage,
  fetchProject,
  showStageModal,
  setShowStageModal,
  showHelpModal,
  setShowHelpModal,
  flowOrderModalOpen,
  setFlowOrderModalOpen,
  dbgaRestoreOpen,
  setDbgaRestoreOpen,
  modelsUnavailableModalOpen,
  setModelsUnavailableModalOpen,
  audit,
  clearMddConfirmOpen,
  setClearMddConfirmOpen,
  onClearMddConfirm,
  mddPatternsWizardOpen,
  setMddPatternsWizardOpen,
  mddPatternsWizardMode,
  effectiveMddTrimmed,
  patternsWizardPreselected,
  patternsWizardAnalyzing,
  patternsAnalyzeRationale,
  patternsWizardLoading,
  onMddPatternsWizardConfirm,
  mddRegenerateDialogOpen,
  setMddRegenerateDialogOpen,
  mddUpstreamSync,
  mddRegenerateInitialMode,
  mddRegenerateLoading,
  onMddRegenerateFull,
  onMddRegenerateSync,
  aemGenerateDialogOpen,
  setAemGenerateDialogOpen,
  aemGenerateLoading,
  onGenerateAem,
}: WorkshopModalsProps) {
  return (
    <>
      <WorkshopNewStageModal
        open={showStageModal}
        onOpenChange={setShowStageModal}
        stages={workshopStagesList}
        activeStageId={activeStageId}
        onCreate={createWorkshopStage}
      />
      <WorkshopHelpModal open={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <WorkshopFlowOrderModal
        open={flowOrderModalOpen}
        onOpenChange={setFlowOrderModalOpen}
        isLegacyProject={isLegacyProject}
      />
      <WorkshopDbgaRestoreDialog
        open={dbgaRestoreOpen}
        onOpenChange={setDbgaRestoreOpen}
        projectId={projectId}
        onRestored={async () => {
          if (projectId) await fetchProject(projectId);
        }}
      />
      <ModelsUnavailableDialog
        open={modelsUnavailableModalOpen}
        onOpenChange={setModelsUnavailableModalOpen}
        onOpenSettings={onOpenSettings}
      />
      <WorkshopAuditModal {...audit} />
      <AlertDialog open={clearMddConfirmOpen} onOpenChange={setClearMddConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Vaciar todo el MDD?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el documento completo y la sección de patrones. No se valida contra ER ni otros
              artefactos del proyecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--destructive)] hover:bg-[var(--destructive-hover)]"
              onClick={() => {
                void onClearMddConfirm();
              }}
            >
              Limpiar MDD
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MddPatternsWizardDialog
        open={mddPatternsWizardOpen}
        onOpenChange={setMddPatternsWizardOpen}
        mode={mddPatternsWizardMode}
        initialMddContent={effectiveMddTrimmed || null}
        preselectedIds={patternsWizardPreselected}
        analyzing={patternsWizardAnalyzing}
        analyzeMessage={patternsAnalyzeRationale}
        loading={patternsWizardLoading}
        onConfirm={onMddPatternsWizardConfirm}
      />
      <MddRegenerateDialog
        open={mddRegenerateDialogOpen}
        onOpenChange={setMddRegenerateDialogOpen}
        syncStatus={mddUpstreamSync}
        initialMode={mddRegenerateInitialMode}
        loading={mddRegenerateLoading}
        onConfirmFull={onMddRegenerateFull}
        onConfirmSync={onMddRegenerateSync}
      />
      <AemGenerateDialog
        open={aemGenerateDialogOpen}
        onOpenChange={setAemGenerateDialogOpen}
        loading={aemGenerateLoading}
        onGenerate={onGenerateAem}
      />
    </>
  );
}
