import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui";
import { useWorkshopStore, type WorkshopStage } from "../store/workshopStore";

export interface BrdTobeStagePanelProps {
  projectId: string;
  /** `Project.requireBrdTobeGate`: si true, el API exige BRD+To-Be antes del MDD técnico. */
  requireBrdTobeGate: boolean;
  activeStageId: string | null;
  stage: WorkshopStage | undefined;
  isLegacyProject: boolean;
  codebaseDocChars: number;
  /** Greenfield: longitud de `project.dbgaContent` persistido (misma fuente que el POST suggest-brd-tobe-from-dbga). */
  dbgaContentChars: number;
  /** `full` = BRD + To-Be + As-Is + gate (legacy). `brd` / `tobe` = pestañas dedicadas del Workshop. `gate-only` = solo toggle bajo MDD. */
  panel?: "full" | "brd" | "tobe" | "gate-only";
}

/**
 * BRD / Manual To-Be / As-Is por etapa: edición vía PATCH y aprobaciones HITL.
 * Toggle proyecto **Exigir BRD/To-Be** (persistido; no env).
 * Legacy: As-Is y borradores BRD/To-Be desde doc. Ariadne (`codebaseDoc`).
 * Greenfield: borradores BRD/To-Be desde DBGA (`POST …/suggest-brd-tobe-from-dbga`).
 */
export function BrdTobeStagePanel({
  projectId,
  requireBrdTobeGate,
  activeStageId,
  stage,
  isLegacyProject,
  codebaseDocChars,
  dbgaContentChars,
  panel = "full",
}: BrdTobeStagePanelProps) {
  const patchWorkshopStage = useWorkshopStore((s) => s.patchWorkshopStage);
  const setProjectRequireBrdTobeGate = useWorkshopStore((s) => s.setProjectRequireBrdTobeGate);
  const legacyGenerateAsIsManual = useWorkshopStore((s) => s.legacyGenerateAsIsManual);
  const legacySuggestBrdTobeFromCodebaseDoc = useWorkshopStore((s) => s.legacySuggestBrdTobeFromCodebaseDoc);
  const suggestBrdTobeFromDbga = useWorkshopStore((s) => s.suggestBrdTobeFromDbga);
  const storeLoading = useWorkshopStore((s) => s.loading);
  const loadingReason = useWorkshopStore((s) => s.loadingReason);

  const [brd, setBrd] = useState("");
  const [tobe, setTobe] = useState("");
  const [asis, setAsis] = useState("");
  const [localBusy, setLocalBusy] = useState(false);

  useEffect(() => {
    setBrd((stage?.brdContent ?? "").trim() ? (stage?.brdContent ?? "") : "");
    setTobe((stage?.toBeManualContent ?? "").trim() ? (stage?.toBeManualContent ?? "") : "");
    setAsis((stage?.asIsManualContent ?? "").trim() ? (stage?.asIsManualContent ?? "") : "");
  }, [stage?.id, stage?.brdContent, stage?.toBeManualContent, stage?.asIsManualContent]);

  const busy = localBusy || storeLoading;
  const asIsLoading = loadingReason === "legacy-as-is";
  const brdTobeSuggestLoading =
    loadingReason === "legacy-brd-tobe-suggest" || loadingReason === "brd-tobe-from-dbga";

  const saveBrd = useCallback(async () => {
    if (!activeStageId) return;
    setLocalBusy(true);
    await patchWorkshopStage(activeStageId, { brdContent: brd });
    setLocalBusy(false);
  }, [activeStageId, brd, patchWorkshopStage]);

  const saveTobe = useCallback(async () => {
    if (!activeStageId) return;
    setLocalBusy(true);
    await patchWorkshopStage(activeStageId, { toBeManualContent: tobe });
    setLocalBusy(false);
  }, [activeStageId, patchWorkshopStage, tobe]);

  const saveAsis = useCallback(async () => {
    if (!activeStageId) return;
    setLocalBusy(true);
    await patchWorkshopStage(activeStageId, { asIsManualContent: asis });
    setLocalBusy(false);
  }, [activeStageId, asis, patchWorkshopStage]);

  const approveBrd = useCallback(async () => {
    if (!activeStageId) return;
    setLocalBusy(true);
    await patchWorkshopStage(activeStageId, { approveBrd: true });
    setLocalBusy(false);
  }, [activeStageId, patchWorkshopStage]);

  const approveTobe = useCallback(async () => {
    if (!activeStageId) return;
    setLocalBusy(true);
    await patchWorkshopStage(activeStageId, { approveToBe: true });
    setLocalBusy(false);
  }, [activeStageId, patchWorkshopStage]);

  const runLegacyAsIs = useCallback(async () => {
    setLocalBusy(true);
    await legacyGenerateAsIsManual(projectId);
    setLocalBusy(false);
  }, [legacyGenerateAsIsManual, projectId]);

  const runSuggestBrdTobe = useCallback(async () => {
    setLocalBusy(true);
    await legacySuggestBrdTobeFromCodebaseDoc(projectId);
    setLocalBusy(false);
  }, [legacySuggestBrdTobeFromCodebaseDoc, projectId]);

  const runSuggestBrdTobeFromDbga = useCallback(async () => {
    if (!activeStageId) return;
    setLocalBusy(true);
    await suggestBrdTobeFromDbga(projectId, { stageId: activeStageId });
    setLocalBusy(false);
  }, [activeStageId, projectId, suggestBrdTobeFromDbga]);

  const toggleRequireGate = useCallback(
    async (next: boolean) => {
      setLocalBusy(true);
      await setProjectRequireBrdTobeGate(projectId, next);
      setLocalBusy(false);
    },
    [projectId, setProjectRequireBrdTobeGate],
  );

  if (!activeStageId) {
    return (
      <div className="mb-3 rounded-lg border border-zinc-600/60 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
        Selecciona una etapa para editar BRD / To-Be.
      </div>
    );
  }

  const brdOk = !!stage?.brdApprovedAt;
  const tobeOk = !!stage?.toBeApprovedAt;

  if (panel === "gate-only") {
    return (
      <div className="mb-3 space-y-2 rounded-lg border border-zinc-600/60 bg-zinc-900/40 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-zinc-200">BRD / To-Be</span>
          <span className="text-xs text-zinc-500">
            BRD {brdOk ? "✓" : "—"} · To-Be {tobeOk ? "✓" : "—"}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Edita y conversa en las pestañas <strong>BRD</strong> y <strong>To-Be</strong> (a la izquierda de MDD).
        </p>
        <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-500"
            checked={requireBrdTobeGate}
            disabled={busy}
            onChange={(e) => void toggleRequireGate(e.target.checked)}
          />
          <span>
            Exigir BRD y Manual To-Be <strong>aprobados</strong> antes del MDD técnico (§3+). En legacy suele
            desactivarse para el MDD inicial; actívalo al entrar en una fase de mejora.
          </span>
        </label>
      </div>
    );
  }

  const title =
    panel === "brd" ? "BRD (etapa)" : panel === "tobe" ? "Manual To-Be / As-Is (etapa)" : "BRD / To-Be / As-Is (etapa)";
  const showGate = panel === "full";
  const showBrdBlock = panel === "full" || panel === "brd";
  const showTobeBlock = panel === "full" || panel === "tobe";
  const showAsIsBlock = panel === "full" || panel === "tobe";

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-zinc-600/60 bg-zinc-900/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-zinc-200">{title}</span>
        <span className="text-xs text-zinc-500">
          BRD {brdOk ? "✓ aprobado" : "—"} · To-Be {tobeOk ? "✓ aprobado" : "—"}
        </span>
      </div>

      {showGate ? (
        <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-500"
            checked={requireBrdTobeGate}
            disabled={busy}
            onChange={(e) => void toggleRequireGate(e.target.checked)}
          />
          <span>
            Exigir BRD y Manual To-Be <strong>aprobados</strong> antes del MDD técnico (§3+). En legacy suele
            desactivarse para el MDD inicial; actívalo al entrar en una fase de mejora.
          </span>
        </label>
      ) : null}

      {showBrdBlock ? (
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">BRD (markdown)</label>
        <textarea
          value={brd}
          onChange={(e) => setBrd(e.target.value)}
          disabled={busy}
          rows={4}
          spellCheck={false}
          className="w-full rounded-md border border-zinc-600 bg-zinc-950/80 p-2 font-mono text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-amber-500/70"
          placeholder="Problema, KPIs, alcance…"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void saveBrd()}>
            Guardar BRD
          </Button>
          <Button type="button" size="sm" disabled={busy || !brd.trim()} onClick={() => void approveBrd()}>
            Aprobar BRD
          </Button>
        </div>
        {panel === "brd" ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-700/60 pt-2">
            {isLegacyProject ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={brdTobeSuggestLoading}
                  disabled={busy || codebaseDocChars < 300}
                  onClick={() => void runSuggestBrdTobe()}
                  title={
                    codebaseDocChars < 300
                      ? "Genera primero la doc. partida del codebase (≥300 caracteres)."
                      : "Borradores desde Ariadne; revisa pestaña To-Be también."
                  }
                >
                  BRD + To-Be desde doc. partida
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={asIsLoading}
                  disabled={busy || codebaseDocChars < 400}
                  onClick={() => void runLegacyAsIs()}
                  title={codebaseDocChars < 400 ? "Genera primero la doc. partida del codebase (≥400 caracteres)." : undefined}
                >
                  As-Is desde doc. partida
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={loadingReason === "brd-tobe-from-dbga"}
                disabled={busy || dbgaContentChars < 300}
                onClick={() => void runSuggestBrdTobeFromDbga()}
                title={
                  dbgaContentChars < 300
                    ? "Genera o guarda el DBGA en el Paso 0 (≥300 caracteres)."
                    : "Borradores BRD+To-Be desde Domain Benchmark; revisa pestaña To-Be."
                }
              >
                BRD + To-Be desde DBGA
              </Button>
            )}
          </div>
        ) : null}
      </div>
      ) : null}

      {showTobeBlock ? (
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Manual To-Be</label>
        <textarea
          value={tobe}
          onChange={(e) => setTobe(e.target.value)}
          disabled={busy}
          rows={4}
          spellCheck={false}
          className="w-full rounded-md border border-zinc-600 bg-zinc-950/80 p-2 font-mono text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-amber-500/70"
          placeholder="Lógica y comportamiento deseado…"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void saveTobe()}>
            Guardar To-Be
          </Button>
          <Button type="button" size="sm" disabled={busy || !tobe.trim()} onClick={() => void approveTobe()}>
            Aprobar To-Be
          </Button>
        </div>
      </div>
      ) : null}

      {showAsIsBlock ? (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs text-zinc-400">As-Is (mapa / proceso actual)</label>
          {isLegacyProject ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={brdTobeSuggestLoading}
                disabled={busy || codebaseDocChars < 300}
                onClick={() => void runSuggestBrdTobe()}
                title={
                  codebaseDocChars < 300
                    ? "Genera primero la doc. partida del codebase (≥300 caracteres)."
                    : "Borradores desde Ariadne; revisa y aprueba después."
                }
              >
                BRD + To-Be desde doc. partida
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={asIsLoading}
                disabled={busy || codebaseDocChars < 400}
                onClick={() => void runLegacyAsIs()}
                title={codebaseDocChars < 400 ? "Genera primero la doc. partida del codebase (≥400 caracteres)." : undefined}
              >
                As-Is desde doc. partida
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={loadingReason === "brd-tobe-from-dbga"}
              disabled={busy || dbgaContentChars < 300}
              onClick={() => void runSuggestBrdTobeFromDbga()}
              title={
                dbgaContentChars < 300
                  ? "Genera o guarda el DBGA en el Paso 0 (≥300 caracteres)."
                  : "Borradores desde Domain Benchmark; revisa y aprueba después."
              }
            >
              BRD + To-Be desde DBGA
            </Button>
          )}
        </div>
        <textarea
          value={asis}
          onChange={(e) => setAsis(e.target.value)}
          disabled={busy}
          rows={3}
          spellCheck={false}
          className="w-full rounded-md border border-zinc-600 bg-zinc-950/80 p-2 font-mono text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-amber-500/70"
          placeholder="Opcional: proceso o código actual…"
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void saveAsis()}>
          Guardar As-Is
        </Button>
      </div>
      ) : null}
    </div>
  );
}
