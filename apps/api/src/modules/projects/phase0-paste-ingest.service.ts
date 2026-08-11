/**
 * Ingesta explícita de Paso 0 definitivo pegado — catálogo D-ID + borrador heurístico.
 */

import { Injectable, Logger } from "@nestjs/common";
import {
  PASO0_PASTE_SIDECAR_KIND,
  phase0IngestPastedBodySchema,
  serializePaso0PasteSidecar,
  type Phase0IngestPastedBody,
} from "@theforge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  extractPaso0DecisionCatalog,
  isPastedDefinitivePaso0,
} from "../ai-analysis/phase0/paso0-pasted-definitive.util.js";
import {
  heuristicBorradorFromFreeformDbga,
  refreshBorradorFromWorkingMarkdown,
} from "../ai-analysis/phase0/phase0-load-borrador.util.js";
import { normalizePhase0Document } from "../ai-analysis/phase0/phase0-normalize.util.js";
import { loadAccessibleProjectWithStages } from "./project-access.util.js";
import { ProjectUpdateService } from "./project-update.service.js";

export type Phase0IngestPastedResult =
  | {
      ingested: true;
      decisionCount: number;
      mvpCapabilityCount: number;
      sourceHash: string;
    }
  | {
      ingested: false;
      reason: string;
    };

@Injectable()
export class Phase0PasteIngestService {
  private readonly logger = new Logger(Phase0PasteIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectUpdate: ProjectUpdateService,
  ) {}

  async ingestPasted(projectId: string, body: Phase0IngestPastedBody): Promise<Phase0IngestPastedResult> {
    try {
      const parsed = phase0IngestPastedBodySchema.parse(body);
      this.logger.debug(
        `[phase0-paste-ingest] start project=${projectId} source=${parsed.source} contentLength=${parsed.dbgaContent.length}`,
      );

      if (parsed.source !== "paste") {
        this.logger.debug(
          `[phase0-paste-ingest] skip project=${projectId} definitive=no reason=source debe ser paste`,
        );
        return { ingested: false, reason: "source debe ser paste" };
      }

      const md = parsed.dbgaContent.trim();
      if (!isPastedDefinitivePaso0(md)) {
        const reason =
          "El markdown no cumple los criterios de Paso 0 definitivo pegado (longitud, D-IDs, secciones H2, gobierno).";
        this.logger.debug(
          `[phase0-paste-ingest] skip project=${projectId} definitive=no reason=${reason}`,
        );
        return { ingested: false, reason };
      }

      this.logger.debug(
        `[phase0-paste-ingest] definitive=yes project=${projectId} contentLength=${md.length}`,
      );

      await loadAccessibleProjectWithStages(this.prisma, projectId);

      const catalog = extractPaso0DecisionCatalog(md);
      const borrador = refreshBorradorFromWorkingMarkdown(
        heuristicBorradorFromFreeformDbga(md),
        md,
      );

      const sidecar = {
        envelopeKind: PASO0_PASTE_SIDECAR_KIND,
        version: 1 as const,
        catalog,
        borrador: normalizePhase0Document(borrador) as unknown as Record<string, unknown>,
      };

      await this.projectUpdate.update(projectId, {
        dbgaContent: md,
        phase0SummaryContent: serializePaso0PasteSidecar(sidecar),
      });

      const hashPrefix = catalog.sourceHash.slice(0, 8);
      this.logger.log(
        `[phase0-paste-ingest] ok project=${projectId} decisions=${catalog.decisions.length} mvpCapabilities=${catalog.mvpCapabilities.length} sourceHash=${hashPrefix}`,
      );

      return {
        ingested: true,
        decisionCount: catalog.decisions.length,
        mvpCapabilityCount: catalog.mvpCapabilities.length,
        sourceHash: catalog.sourceHash,
      };
    } catch (err) {
      this.logger.error(
        `[phase0-paste-ingest] failed project=${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
