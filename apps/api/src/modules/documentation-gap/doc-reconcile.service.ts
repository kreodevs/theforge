import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AffectedArtifact, DocumentationGapEvidence } from "@theforge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ChangeLogService } from "../change-log/change-log.service.js";
import { ConformanceService } from "../engine/conformance.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { UiScreensService } from "../ui-mcp/ui-screens.service.js";
import { collectConformanceGaps } from "../projects/conformance-gaps.util.js";
import { AgentSessionLogService } from "./agent-session-log.service.js";
import { ArchitectureDecisionService } from "./architecture-decision.service.js";
import { isAutoReconcileInternalGap } from "./architecture-decision.util.js";

const ARTIFACT_FIELD: Partial<Record<AffectedArtifact, string>> = {
  mdd: "mddContent",
  spec: "specContent",
  architecture: "architectureContent",
  blueprint: "blueprintContent",
  useCases: "useCasesContent",
  userStories: "userStoriesContent",
  tasks: "tasksContent",
  apiContracts: "apiContractsContent",
  logicFlows: "logicFlowsContent",
  infra: "infraContent",
  uxUiGuide: "uxUiGuideContent",
  pantallas: "uiScreensContent",
  agentGovernance: "agentGovernanceContent",
};

/** Orden de dependencias para regeneración parcial (MDD primero — constitución SDD). */
const RECONCILE_ORDER: AffectedArtifact[] = [
  "mdd",
  "spec",
  "architecture",
  "apiContracts",
  "useCases",
  "userStories",
  "uxUiGuide",
  "pantallas",
  "blueprint",
  "logicFlows",
  "infra",
  "tasks",
  "agentGovernance",
];

export interface DocReconcileJobPayload {
  projectId: string;
  stageId: string;
  gapId: string;
  affectedArtifacts: AffectedArtifact[];
  gapsFeedback: string;
}

interface ReconcileSnapshot {
  projectFields: Record<string, string | null>;
  stageId: string;
  stageMddContent: string | null;
}

@Injectable()
export class DocReconcileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly changeLog: ChangeLogService,
    private readonly conformance: ConformanceService,
    private readonly agentSessionLog: AgentSessionLogService,
    private readonly architectureDecisions: ArchitectureDecisionService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    private readonly uiScreens: UiScreensService,
  ) {}

  buildGapsFeedback(description: string, evidence: DocumentationGapEvidence): string {
    const lines = [
      description.trim(),
      "",
      `Referencia SDD: ${evidence.reference}`,
    ];
    if (evidence.codePaths?.length) {
      lines.push("", "Rutas de código:", ...evidence.codePaths.map((p) => `- ${p}`));
    }
    if (evidence.snippet?.trim()) {
      lines.push("", "Evidencia:", evidence.snippet.trim());
    }
    return lines.join("\n");
  }

  /** Siempre incluye MDD (parche constitucional) y ordena el resto por dependencias. */
  orderedArtifacts(affected: AffectedArtifact[]): AffectedArtifact[] {
    const set = new Set<AffectedArtifact>(affected);
    set.add("mdd");
    return RECONCILE_ORDER.filter((a) => set.has(a));
  }

  async executeReconcile(payload: DocReconcileJobPayload): Promise<{ ok: boolean; reason?: string }> {
    const { projectId, stageId, gapId, affectedArtifacts, gapsFeedback } = payload;

    await this.prisma.documentationGap.update({
      where: { id: gapId },
      data: { status: "RECONCILING" },
    });

    const project = await this.projects.findOne(projectId);
    if (!project) throw new NotFoundException("Proyecto no encontrado");

    const stage = (project.stages ?? []).find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException("Etapa no encontrada");

    const mddBefore =
      (stage.mddContent ?? "").trim() ||
      (project as { mddContent?: string }).mddContent?.trim() ||
      "";

    const snapshot = this.snapshotForReconcile(project as Record<string, unknown>, stageId, stage);
    const gapsBefore = collectConformanceGaps(this.conformance, mddBefore, {
      blueprintContent: project.blueprintContent,
      apiContractsContent: project.apiContractsContent,
      logicFlowsContent: project.logicFlowsContent,
      infraContent: project.infraContent,
    });

    const ordered = this.orderedArtifacts(affectedArtifacts);
    const updatedFields: string[] = [];

    try {
      for (const artifact of ordered) {
        await this.regenerateArtifact(projectId, stageId, artifact, gapsFeedback);
        const field = ARTIFACT_FIELD[artifact];
        if (field) updatedFields.push(field);
      }

      const afterProject = await this.projects.findOne(projectId);
      const afterStage = (afterProject?.stages ?? []).find((s) => s.id === stageId);
      const mddAfter =
        (afterStage?.mddContent ?? "").trim() ||
        (afterProject as { mddContent?: string }).mddContent?.trim() ||
        mddBefore;

      const gapsAfter = collectConformanceGaps(this.conformance, mddAfter, {
        blueprintContent: afterProject?.blueprintContent,
        apiContractsContent: afterProject?.apiContractsContent,
        logicFlowsContent: afterProject?.logicFlowsContent,
        infraContent: afterProject?.infraContent,
      });

      if (gapsAfter.length > gapsBefore.length) {
        await this.restoreSnapshot(projectId, snapshot);
        await this.rejectGap(
          projectId,
          stageId,
          gapId,
          `Conformidad empeoró (${gapsBefore.length} → ${gapsAfter.length} gaps)`,
          { gapsBefore: gapsBefore.length, gapsAfter: gapsAfter.length },
        );
        return { ok: false, reason: "conformance_worse" };
      }

      for (const field of updatedFields) {
        if (field === "mddContent") {
          await this.agentSessionLog.append({
            projectId,
            stageId,
            kind: "ARTIFACT_UPDATED",
            gapId,
            summary: `Artefacto regenerado: ${field}`,
            payload: { field, gapId },
          });
          continue;
        }
        const content = (afterProject as unknown as Record<string, string | null | undefined>)[field];
        await this.changeLog.log(projectId, field, content ?? null);
        await this.agentSessionLog.append({
          projectId,
          stageId,
          kind: "ARTIFACT_UPDATED",
          gapId,
          summary: `Artefacto regenerado: ${field}`,
          payload: { field, gapId },
        });
      }

      await this.prisma.documentationGap.update({
        where: { id: gapId },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });

      const resolvedGap = await this.prisma.documentationGap.findUnique({ where: { id: gapId } });
      if (resolvedGap) {
        const evidence = resolvedGap.evidence as DocumentationGapEvidence;
        const adrSource = isAutoReconcileInternalGap(evidence)
          ? "auto-reconcile"
          : "hitl-approved";
        await this.architectureDecisions.recordFromResolvedGap(projectId, resolvedGap, adrSource);
      }

      return { ok: true };
    } catch (err) {
      await this.restoreSnapshot(projectId, snapshot);
      const message = err instanceof Error ? err.message : String(err);
      await this.rejectGap(projectId, stageId, gapId, message, { error: message });
      return { ok: false, reason: message };
    }
  }

  private async regenerateArtifact(
    projectId: string,
    stageId: string,
    artifact: AffectedArtifact,
    gapsFeedback: string,
  ): Promise<void> {
    switch (artifact) {
      case "mdd":
        await this.projects.patchMddFromGapFeedback(projectId, stageId, gapsFeedback);
        break;
      case "spec":
        await this.projects.generateSpec(projectId);
        break;
      case "architecture":
        await this.projects.generateArchitecture(projectId);
        break;
      case "blueprint":
        await this.projects.generateBlueprint(projectId, gapsFeedback);
        break;
      case "useCases":
        await this.projects.generateUseCases(projectId);
        break;
      case "userStories":
        await this.projects.generateUserStories(projectId);
        break;
      case "apiContracts":
        await this.projects.generateApiContracts(projectId, gapsFeedback);
        break;
      case "logicFlows":
        await this.projects.generateLogicFlows(projectId, gapsFeedback);
        break;
      case "infra":
        await this.projects.generateInfra(projectId, gapsFeedback);
        break;
      case "tasks":
        await this.projects.generateTasks(projectId);
        break;
      case "agentGovernance":
        await this.projects.generateAgentGovernance(projectId, undefined, {
          forceRegenerate: false,
          skipSddAutoReconcile: true,
        });
        break;
      case "uxUiGuide":
        await this.projects.generateUxUiGuide(projectId);
        break;
      case "pantallas":
        await this.uiScreens.syncUiScreens(projectId);
        break;
      default:
        break;
    }
  }

  private snapshotFields(project: Record<string, unknown>): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const field of Object.values(ARTIFACT_FIELD)) {
      if (!field || field === "mddContent") continue;
      const val = project[field];
      out[field] = typeof val === "string" ? val : val == null ? null : String(val);
    }
    return out;
  }

  private snapshotForReconcile(
    project: Record<string, unknown>,
    stageId: string,
    stage: { mddContent?: string | null },
  ): ReconcileSnapshot {
    return {
      projectFields: this.snapshotFields(project),
      stageId,
      stageMddContent: stage.mddContent ?? null,
    };
  }

  private async restoreSnapshot(projectId: string, snapshot: ReconcileSnapshot): Promise<void> {
    const data: Record<string, string | null> = {};
    for (const [field, value] of Object.entries(snapshot.projectFields)) {
      data[field] = value;
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.project.update({ where: { id: projectId }, data });
    }
    await this.prisma.stage.update({
      where: { id: snapshot.stageId },
      data: { mddContent: snapshot.stageMddContent },
    });
  }

  private async rejectGap(
    projectId: string,
    stageId: string,
    gapId: string,
    summary: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.documentationGap.update({
      where: { id: gapId },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });
    await this.agentSessionLog.append({
      projectId,
      stageId,
      kind: "RECONCILE_REJECTED",
      gapId,
      summary: summary.slice(0, 500),
      payload: payload ?? null,
    });
  }
}
