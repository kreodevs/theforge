import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { DocumentationGapService } from "../documentation-gap/documentation-gap.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { loadAccessibleProjectWithStages } from "./project-access.util.js";
import { pickPrimaryStage } from "./stage-helpers.js";

@Injectable()
export class ProjectSddReconcileService {
  private readonly logger = new Logger(ProjectSddReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DocumentationGapService))
    private readonly documentationGap: DocumentationGapService,
  ) {}

  /** Tras cascada o regeneración individual: detecta conflictos SDD y los expone como gaps HITL. */
  async runPostRegenSddConflictSurfacing(projectId: string): Promise<void> {
    const project = await loadAccessibleProjectWithStages(this.prisma, projectId);
    const activeStage = pickPrimaryStage(project.stages ?? []);
    if (!activeStage?.id) return;
    const summary = await this.documentationGap.detectAndSurfaceSddConflicts(
      projectId,
      activeStage.id,
    );
    if (summary.conflictsDetected > 0) {
      this.logger.debug(
        `[SDD surfacing] projectId=${projectId} conflicts=${summary.conflictsDetected} created=${summary.gapsCreated} duplicates=${summary.duplicates}`,
      );
    }
  }

  /** @deprecated Usar `runPostRegenSddConflictSurfacing`. Solo reconciliación explícita vía approve gap. */
  async runPostRegenSddAutoReconcile(projectId: string): Promise<void> {
    const project = await loadAccessibleProjectWithStages(this.prisma, projectId);
    const activeStage = pickPrimaryStage(project.stages ?? []);
    if (!activeStage?.id) return;
    const summary = await this.documentationGap.autoReconcileSddConflicts(projectId, activeStage.id);
    if (!summary.clean && summary.remainingConflicts.length > 0) {
      this.logger.warn(
        `[SDD auto-reconcile] projectId=${projectId} retries=${summary.retries} remaining=${summary.remainingConflicts.length}`,
      );
    } else if (summary.deterministicPasses > 0 || summary.reconcilePasses > 0) {
      this.logger.debug(
        `[SDD auto-reconcile] projectId=${projectId} deterministic=${summary.deterministicPasses} reconcile=${summary.reconcilePasses}`,
      );
    }
  }
}
