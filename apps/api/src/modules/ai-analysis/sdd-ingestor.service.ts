import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { GraphMemoryService } from "./graph-memory/graph-memory.service.js";
import { markdownToMddStructured } from "./utils/mdd-markdown-to-structured.js";
import { pickPrimaryStage } from "../projects/stage-helpers.js";

/**
 * Ingiere el MDD textual del proyecto al Grafo SDD (FalkorDB): Project, tablas, endpoints,
 * reglas, nodos MDD_Section y embeddings donde aplique.
 */
@Injectable()
export class SddIngestorService {
  private readonly logger = new Logger(SddIngestorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphMemory: GraphMemoryService,
  ) { }

  async ingestProjectMdd(projectId: string): Promise<void> {
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { stages: { orderBy: { ordinal: "asc" } } },
    });
    const stage = pickPrimaryStage(p?.stages ?? []);
    const mdd = stage?.mddContent?.trim() ?? "";
    if (!mdd) {
      this.logger.debug(`[SddIngestor] Sin mddContent en etapa activa para ${projectId}, skip`);
      return;
    }
    try {
      await this.graphMemory.ensureProject(projectId, p?.name ?? undefined);
      const structured = markdownToMddStructured(mdd);
      await this.graphMemory.syncMddToGraph(projectId, stage?.id, structured);
      this.logger.log(`[SddIngestor] Grafo SDD actualizado para proyecto ${projectId} stage ${stage?.id}`);
    } catch (err) {
      this.logger.warn(
        `[SddIngestor] Falló ingest para ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
