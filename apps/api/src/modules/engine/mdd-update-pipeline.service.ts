import { Injectable, Logger } from "@nestjs/common";
import { ComplexityLevel, Status } from "@theforge/database";
import { GraphMemoryService } from "../ai-analysis/graph-memory/graph-memory.service.js";
import { markdownToMddStructured } from "../ai-analysis/utils/mdd-markdown-to-structured.js";
import { SemaphoreService, type SemaphoreEvaluationInput } from "./semaphore.service.js";
import { normalizeMddContent } from "./mdd-markdown-parser.js";
import { preRenderMddSanity, sanitizeMermaidInDraft } from "./mdd-pre-render.js";

export type MddUpdatePipelineResult =
  | { ok: true; sanitizedMdd: string; status: Status; precisionScore: number }
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
    private readonly graphMemory: GraphMemoryService,
  ) {}

  /**
   * Valida el borrador, sanitiza bloques Mermaid y evalúa semáforo.
   * Con `graphScope`, reingiere el MDD al Grafo SDD y consulta Cypher (coherencia CONSUMES) para relajar AMARILLO→VERDE en HIGH.
   * Si la validación falla, devuelve ok: false con code y message.
   */
  async process(
    rawMddContent: string,
    semaphoreBase: Omit<SemaphoreEvaluationInput, "mddJsonString" | "sddDomainGraphOk">,
    graphScope?: { projectId: string; stageId: string },
  ): Promise<MddUpdatePipelineResult> {
    const sanity = preRenderMddSanity(rawMddContent);
    if (!sanity.ok) {
      return {
        ok: false,
        code: sanity.code ?? "ERR_VALIDATION",
        message: sanity.message ?? "Error de validación del MDD",
      };
    }
    const sanitizedMdd = sanitizeMermaidInDraft(rawMddContent);
    const normalized = normalizeMddContent(sanitizedMdd);
    const contentForSemaphore = JSON.stringify(normalized);

    let sddDomainGraphOk: boolean | undefined;
    const pid = graphScope?.projectId?.trim();
    const sid = graphScope?.stageId?.trim();
    if (pid && sid && semaphoreBase.complexity === ComplexityLevel.HIGH) {
      try {
        const structured = markdownToMddStructured(sanitizedMdd);
        await this.graphMemory.syncMddToGraph(pid, sid, structured);
        const health = await this.graphMemory.evaluateSddDependencyHealth(pid, sid);
        sddDomainGraphOk = health?.isCoherent === true;
        if (health && !health.isCoherent) {
          this.logger.debug(
            `[MddPipeline] Grafo SDD sin alivio semáforo: endpoints=${health.endpointCount} entidades=${health.entityCount} huérfanos(ep)=${health.orphanEndpointCount} huérfanos(tab)=${health.orphanEntityCount}`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `[MddPipeline] FalkorDB / grafo SDD no aplicado al semáforo: ${e instanceof Error ? e.message : String(e)}`,
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
    };
  }
}
