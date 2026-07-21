import { ConflictException, Injectable } from "@nestjs/common";
import { ComplexityLevel, type Project, type Stage } from "@theforge/database";
import type { Estimation } from "@theforge/database";
import type { MddDeliveryGateResult } from "@theforge/shared-types";
import {
  buildMddDeliveryGateConflictBody,
  evaluateMddDeliveryGatePrepared,
} from "../ai-analysis/utils/mdd-delivery-gate-guard.util.js";
import { SemaphoreService } from "../engine/semaphore.service.js";
import { ConformanceService } from "../engine/conformance.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { loadAccessibleProjectWithStages } from "./project-access.util.js";
import { pickMddFromStages, buildConstitutionMarkdown } from "./constitution-markdown.util.js";
import { buildSemaphoreBaseFromProject } from "./project-mdd-persist.util.js";
import { ProjectEstimationRecalcService } from "./project-estimation-recalc.service.js";
import { ProjectMddPersistService } from "./project-mdd-persist.service.js";
import { syncDomainInventoryForStage as persistDomainInventoryForStage } from "./sync-domain-inventory-stage.util.js";
import { pickPrimaryStage } from "./stage-helpers.js";
import { mddJsonStringForSemaphore } from "./project-semaphore.util.js";
import {
  buildProjectDeliverableSource,
  evaluateCompositeSemaphore,
} from "./project-semaphore-composite.util.js";

type StageWithEst = Stage & { estimation: Estimation | null };

@Injectable()
export class ProjectDeliverableGateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semaphore: SemaphoreService,
    private readonly conformance: ConformanceService,
    private readonly estimationRecalc: ProjectEstimationRecalcService,
    private readonly mddPersist: ProjectMddPersistService,
  ) {}

  /** Recalcula semáforo de la etapa principal cuando cambian entregables/complejidad sin tocar el MDD. */
  async refreshStageSemaphoreFromProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      include: { stages: { orderBy: { ordinal: "asc" }, include: { estimation: true } } },
    });
    if (!project) return;
    const targetStage = pickPrimaryStage(project.stages);
    if (!targetStage) return;

    const mddMarkdown = buildConstitutionMarkdown(project);
    const stage = targetStage;
    const deliverableSource = buildProjectDeliverableSource(project, stage);
    const compositeEval = evaluateCompositeSemaphore(this.semaphore, {
      ...buildSemaphoreBaseFromProject(project),
      mddJsonString: mddJsonStringForSemaphore(mddMarkdown),
      mddMarkdown,
      project,
      conformance: this.conformance,
      deliverableSource,
    });
    const { status, precisionScore } = compositeEval;

    await this.prisma.stage.update({
      where: { id: targetStage.id },
      data: { status, precisionScore },
    });

    const mddForRecalc = targetStage.mddContent ?? null;
    if (mddForRecalc != null) {
      await this.estimationRecalc.recalcAndUpsert(targetStage.id, {
        mddContent: mddForRecalc,
        infraContent: project.infraContent ?? null,
        status,
      });
    }
  }

  /** Bloquea generación de entregables si el MDD no aprueba el gate (409 + ERR_MDD_DELIVERY_GATE). */
  async assertDeliverablesAllowed(
    projectId: string,
    options?: { acknowledgeGaps?: boolean },
  ): Promise<void> {
    const project = await loadAccessibleProjectWithStages(this.prisma, projectId);
    if (project.projectType === "LEGACY") return;
    await this.assertDeliverablesMddGate(project, options?.acknowledgeGaps === true);
  }

  /** Gate MDD de entrega para cualquier tipo de proyecto (incl. LEGACY). */
  async assertMddDeliveryGateForDeliverables(projectId: string): Promise<void> {
    const project = await loadAccessibleProjectWithStages(this.prisma, projectId);
    await this.assertDeliverablesMddGate(project);
  }

  private async assertDeliverablesMddGate(
    project: Project & { stages: StageWithEst[] },
    acknowledgeGaps = false,
  ): Promise<void> {
    const stage = pickPrimaryStage(project.stages);
    const mdd = pickMddFromStages(project.stages).trim();
    const cx = project.complexity ?? ComplexityLevel.HIGH;

    if (!mdd) {
      if (cx !== ComplexityLevel.HIGH) return;
      const gate: MddDeliveryGateResult = {
        ok: false,
        score: 0,
        blockers: [
          "No hay MDD en la etapa activa; completa la Constitución antes de generar entregables.",
        ],
        warnings: [],
      };
      if (stage?.id) void this.mddPersist.persistMddDeliveryGateSnapshot(stage.id, gate);
      if (!acknowledgeGaps) {
        throw new ConflictException(
          buildMddDeliveryGateConflictBody(gate, gate.blockers[0]!),
        );
      }
      return;
    }

    const gate = await evaluateMddDeliveryGatePrepared(mdd, {
      brdMarkdown: stage?.brdContent,
      dbgaMarkdown: project.dbgaContent,
    });
    if (stage?.id) {
      void this.mddPersist.persistMddDeliveryGateSnapshot(stage.id, gate);
      void persistDomainInventoryForStage(this.prisma, project, stage.id);
    }
    if (!gate.ok && !acknowledgeGaps) {
      throw new ConflictException(buildMddDeliveryGateConflictBody(gate));
    }
  }
}
