import { Injectable, Logger } from "@nestjs/common";
import { ComplexityLevel, Status } from "@theforge/database";
import type { Paso0DecisionCatalog, SddGraphSyncStatus } from "@theforge/shared-types";
import { MddCoherenceService } from "./mdd-coherence/mdd-coherence.service.js";
import { resolveDomainInventory } from "./domain-inventory-persist.util.js";
import { SemaphoreService, type SemaphoreEvaluationInput } from "./semaphore.service.js";
import { prepareMddForOutput } from "../ai-analysis/utils/mdd-prepare-output.js";
import { validateMddForDelivery, isStreamPrevalidatedDeliveryGate } from "../ai-analysis/utils/mdd-delivery-gate.util.js";
import { resolvePaso0DecisionCatalogForMdd } from "../ai-analysis/phase0/paso0-pasted-definitive.util.js";
import {
  enforcePaso0CatalogOnMdd,
  repairAndInjectPaso0Section3ForGate,
  areRecoverablePersistGateAutofixBlockers,
  sanitizePaso0SsoContradictionsInMdd,
  sanitizePaso0StranglerFigInMdd,
} from "./mdd-paso0-enforcement.util.js";
import { extractSection5Body } from "../ai-analysis/utils/mdd-sanitize/section-merge.js";
import {
  prepareMddMarkdownForPersist,
  touchPrevalidatedMddBeforePersist,
} from "../ai-analysis/utils/mdd-sanitize/persist-pipeline.js";
import { deduplicateCanonicalMddSections } from "../ai-analysis/utils/mdd-sanitize/section-merge.js";
import { applyPersistDeliveryGateAutofixes } from "../ai-analysis/utils/mdd-delivery-gate-autofix.util.js";
import { preserveValidatedSectionsIfSubstantial } from "../ai-analysis/utils/mdd-section-preserve.util.js";
import { logMddPersistFenceDiag } from "../ai-analysis/utils/mdd-persist-fence-diag.util.js";
import { normalizeMddContent } from "./mdd-markdown-parser.js";
import { preRenderMddSanity } from "./mdd-pre-render.js";

export type MddUpdatePipelineGraphScope = {
  projectId: string;
  stageId: string;
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  phase0SummaryContent?: string | null;
  domainInventory?: unknown;
  /** Catálogo Paso 0 resuelto (opcional; si falta se deriva de phase0SummaryContent/dbga). */
  paso0Catalog?: Paso0DecisionCatalog | null;
};

export type MddUpdatePipelineProcessOptions = MddUpdatePipelineGraphScope & {
  /**
   * Markdown ya pasó `prepareMddForOutput` + PersistCheck en el grafo (job finalize).
   * Evita 2ª pasada destructiva con hydrate/dedupe; sólo formateo de persistencia + gate.
   */
  prevalidatedFromStream?: boolean;
  /** Borrador pre-prepare para restaurar §5 si el formateo la regresó. */
  baselineDraft?: string | null;
  /** Gate del stream (prepare_output) ya aprobó — evita re-evaluar esqueleto tras persist format. */
  streamDeliveryGatePassed?: boolean;
  /** Snapshot del gate del stream para parity persist (opcional). */
  streamDeliveryGate?: import("@theforge/shared-types").MddDeliveryGateResult | null;
};

export type MddUpdatePipelineResult =
  | {
      ok: true;
      sanitizedMdd: string;
      status: Status;
      precisionScore: number;
      sddGraph?: SddGraphSyncStatus;
      /** true cuando `sanitizedMdd` ya incluyó `prepareMddMarkdownForPersist`. */
      persistFormatted?: boolean;
    }
  | { ok: false; code: string; message: string };

/**
 * Responsabilidad única: validar MDD (sanity), sanitizar Mermaid y evaluar semáforo.
 * Usado por ProjectsService cuando se actualiza mddContent.
 */
@Injectable()
export class MddUpdatePipelineService {
  private readonly logger = new Logger(MddUpdatePipelineService.name);

  constructor(
    private readonly semaphore: SemaphoreService,
    private readonly mddCoherence: MddCoherenceService,
  ) {}

  /**
   * Valida el borrador, sanitiza bloques Mermaid y evalúa semáforo.
   * Con `graphScope`, evalúa coherencia §3/§4 desde markdown antes del semáforo (`sddDomainGraphOk` en HIGH).
   */
  async process(
    rawMddContent: string,
    semaphoreBase: Omit<SemaphoreEvaluationInput, "mddJsonString" | "sddDomainGraphOk">,
    graphScope?: MddUpdatePipelineProcessOptions,
  ): Promise<MddUpdatePipelineResult> {
    const paso0Catalog =
      graphScope?.paso0Catalog ??
      resolvePaso0DecisionCatalogForMdd(
        graphScope?.phase0SummaryContent,
        graphScope?.dbgaMarkdown,
      );
    const gateRef: { current?: ReturnType<typeof validateMddForDelivery> } = {};
    const s5Pre = extractSection5Body(rawMddContent)?.length ?? 0;
    const prevalidated = graphScope?.prevalidatedFromStream === true;
    console.log(
      `[MDD:PersistPipeline] prepare start len=${rawMddContent.length} §5=${s5Pre} prevalidated=${prevalidated}`,
    );
    logMddPersistFenceDiag("update-pipeline:pre", rawMddContent);
    let prepared: string;
    let persistFormatted = false;
    if (prevalidated) {
      const baseline = (graphScope?.baselineDraft ?? rawMddContent).trim();
      let preparedBody = touchPrevalidatedMddBeforePersist(rawMddContent, baseline || rawMddContent);
      preparedBody = prepareMddMarkdownForPersist(preparedBody);
      if (baseline) {
        preparedBody = preserveValidatedSectionsIfSubstantial(baseline, preparedBody);
      }
      preparedBody = deduplicateCanonicalMddSections(preparedBody);

      const applyPaso0ForPersistGate = (md: string): string => {
        if (!paso0Catalog) return md;
        let out = repairAndInjectPaso0Section3ForGate(md, paso0Catalog).markdown;
        out = enforcePaso0CatalogOnMdd(out, paso0Catalog).markdown;
        out = sanitizePaso0StranglerFigInMdd(out, paso0Catalog).markdown;
        out = sanitizePaso0SsoContradictionsInMdd(out, paso0Catalog).markdown;
        return deduplicateCanonicalMddSections(out);
      };

      preparedBody = applyPaso0ForPersistGate(preparedBody);
      prepared = preparedBody;
      persistFormatted = true;
      const gateEvalOpts = {
        paso0Catalog,
        brdMarkdown: graphScope?.brdMarkdown,
        dbgaMarkdown: graphScope?.dbgaMarkdown,
        skipDeterministicRepair: true as const,
      };
      gateRef.current = validateMddForDelivery(prepared, gateEvalOpts);
      let persistAutofixAttempt = 0;
      while (
        !gateRef.current.ok &&
        areRecoverablePersistGateAutofixBlockers(gateRef.current.blockers) &&
        persistAutofixAttempt < 2
      ) {
        persistAutofixAttempt += 1;
        const autofix = applyPersistDeliveryGateAutofixes(prepared, {
          paso0Catalog,
          baseline: baseline || undefined,
          inventory: graphScope
            ? resolveDomainInventory({
                persisted: graphScope.domainInventory,
                brdMarkdown: graphScope.brdMarkdown,
                dbgaMarkdown: graphScope.dbgaMarkdown,
                mddMarkdown: prepared,
              })
            : undefined,
        });
        if (autofix.markdown === prepared && autofix.applied.length === 0) break;
        prepared = autofix.markdown;
        gateRef.current = validateMddForDelivery(prepared, gateEvalOpts);
        console.log(
          `[MDD:PersistPipeline] persist autofix attempt=${persistAutofixAttempt} applied=[${autofix.applied.join(",")}] gate ok=${gateRef.current.ok} score=${gateRef.current.score} blockers=${gateRef.current.blockers.length}`,
        );
      }
      const streamGate = graphScope?.streamDeliveryGate;
      if (
        !gateRef.current.ok &&
        isStreamPrevalidatedDeliveryGate(streamGate)
      ) {
        console.log(
          `[MDD:PersistPipeline] stream gate parity — persist re-gate score=${gateRef.current.score} blockers=${gateRef.current.blockers.length}; usando stream score=${streamGate!.score}`,
        );
        gateRef.current = streamGate!;
      }
    } else {
      prepared = await prepareMddForOutput(rawMddContent, {
        deliveryGateRef: gateRef,
        formatForPersist: true,
        brdMarkdown: graphScope?.brdMarkdown,
        dbgaMarkdown: graphScope?.dbgaMarkdown,
        paso0Catalog,
      });
    }
    const s5Post = extractSection5Body(prepared)?.length ?? 0;
    console.log(
      `[MDD:PersistPipeline] prepare done len=${prepared.length} §5=${s5Pre}→${s5Post} prevalidated=${prevalidated}`,
    );
    logMddPersistFenceDiag("update-pipeline:post", prepared);
    const gate =
      gateRef.current ??
      validateMddForDelivery(prepared, {
        paso0Catalog,
        brdMarkdown: graphScope?.brdMarkdown,
        dbgaMarkdown: graphScope?.dbgaMarkdown,
        skipDeterministicRepair: prevalidated ? true : undefined,
      });
    if (!gate.ok && !isStreamPrevalidatedDeliveryGate(gate)) {
      console.warn(
        `[MDD:PersistPipeline] gate FAIL score=${gate.score} blockers=${gate.blockers.length}: ${gate.blockers.slice(0, 2).join("; ")}`,
      );
      return {
        ok: false,
        code: "ERR_MDD_DELIVERY_GATE",
        message: gate.blockers.join("; "),
      };
    }
    if (!gate.ok && isStreamPrevalidatedDeliveryGate(gate)) {
      console.log(
        `[MDD:PersistPipeline] near-pass persist allowed score=${gate.score} blockers=${gate.blockers.length}`,
      );
    }
    const sanity = preRenderMddSanity(prepared);
    if (!sanity.ok) {
      return {
        ok: false,
        code: sanity.code ?? "ERR_VALIDATION",
        message: sanity.message ?? "Error de validación del MDD",
      };
    }
    const sanitizedMdd = prepared;
    const normalized = normalizeMddContent(sanitizedMdd);
    const contentForSemaphore = JSON.stringify(normalized);

    let sddDomainGraphOk: boolean | undefined;
    let sddGraph: SddGraphSyncStatus | undefined;
    const pid = graphScope?.projectId?.trim();
    const sid = graphScope?.stageId?.trim();
    if (pid && sid && semaphoreBase.complexity === ComplexityLevel.HIGH) {
      try {
        const inventory = resolveDomainInventory({
          persisted: graphScope?.domainInventory,
          brdMarkdown: graphScope?.brdMarkdown,
          dbgaMarkdown: graphScope?.dbgaMarkdown,
          mddMarkdown: sanitizedMdd,
        });
        sddGraph = await this.mddCoherence.evaluateFromMdd(pid, sid, sanitizedMdd, undefined, {
          inventory,
        });
        sddDomainGraphOk = sddGraph.isCoherent && sddGraph.state === "synced";
        if (!sddDomainGraphOk) {
          this.logger.debug(
            `[MddPipeline] Coherencia §3/§4 sin alivio semáforo: state=${sddGraph.state} entities=${sddGraph.entityCount}/${sddGraph.expectedEntities} endpoints=${sddGraph.endpointCount}/${sddGraph.expectedEndpoints}`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `[MddPipeline] Evaluación coherencia MDD no aplicada al semáforo: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    const { status, precisionScore } = this.semaphore.evaluate({
      ...semaphoreBase,
      mddJsonString: contentForSemaphore,
      sddDomainGraphOk,
    });
    return {
      ok: true,
      sanitizedMdd,
      status,
      precisionScore,
      sddGraph,
      persistFormatted,
    };
  }
}
