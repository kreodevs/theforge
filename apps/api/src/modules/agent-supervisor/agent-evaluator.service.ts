import { Injectable, Logger } from "@nestjs/common";
import { EpisodicMemoryKind } from "@theforge/database";
import { TheForgeService } from "../theforge/theforge.service.js";
import { AgentSupervisorService } from "./agent-supervisor.service.js";

/**
 * Evaluator (Auditor): cruza SDD (vía ingest previo al grafo) con validación TheForge en legacy.
 * Si detecta riesgo, persiste crítica en EpisodicMemory (Reflexion / rechazo).
 */
@Injectable()
export class AgentEvaluatorService {
  private readonly logger = new Logger(AgentEvaluatorService.name);

  constructor(
    private readonly theforge: TheForgeService,
    private readonly supervisor: AgentSupervisorService,
  ) { }

  /**
   * Chequeo ligero post-intención de cambio: plan TheForge + validate_before_edit sobre el primer archivo.
   * No sustituye un review humano; sirve para bucle reflect-refine con memoria episódica.
   */
  async evaluateLegacyProposal(
    projectId: string,
    stageId: string,
    userMessage: string,
  ): Promise<{ approved: boolean; critique: string }> {
    const route = await this.supervisor.resolveRoute(projectId);
    if (route.flow !== "LEGACY" || !route.theforgeProjectId || !this.theforge.isConfigured()) {
      return { approved: true, critique: "" };
    }
    const theforgeId = route.theforgeProjectId;
    const plan = await this.theforge.getModificationPlan(userMessage.slice(0, 4000), theforgeId);
    if (!plan?.filesToModify?.length) {
      return { approved: true, critique: "" };
    }
    const first = plan.filesToModify[0];
    const base = first.path.split("/").pop() ?? "module";
    const nodeGuess = base.replace(/\.[^.]+$/, "") || "module";
    const validation = await this.theforge.validateBeforeEdit(nodeGuess, theforgeId, first.path);
    const v = validation.trim();
    if (!v) return { approved: true, critique: "" };

    const approved = !this.looksLikeRejection(v);
    if (!approved) {
      const critique = v.slice(0, 8000);
      await this.supervisor.appendEpisodicMemory(
        stageId,
        EpisodicMemoryKind.EVALUATOR_REJECTION,
        critique,
        { source: "validate_before_edit", path: first.path },
      );
      this.logger.warn(`[Evaluator] Rechazo registrado para stage ${stageId} (proyecto ${projectId})`);
      return { approved: false, critique };
    }
    return { approved: true, critique: "" };
  }

  private looksLikeRejection(text: string): boolean {
    const t = text.toLowerCase();
    const strong = [
      "must not proceed",
      "do not edit",
      "cannot safely",
      "unsafe to",
      "blocked",
      "breaking change",
      "contract mismatch",
      "rejected",
    ];
    return strong.some((s) => t.includes(s));
  }
}
