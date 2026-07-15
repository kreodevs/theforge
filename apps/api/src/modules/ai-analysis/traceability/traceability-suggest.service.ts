import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service.js";
import { AIFactory } from "../../ai/ai.factory.js";
import { createDbgaLLM } from "../llm/create-dbga-llm.js";
import { EstimationService } from "../estimation/estimation.service.js";
import { pickPrimaryStage } from "../../projects/stage-helpers.js";
import { getRequestUserId } from "../../../common/request-user.store.js";
import {
  traceabilitySuggestFixRequestSchema,
  type TraceabilitySuggestFixRequest,
  type TraceabilitySuggestFixResponse,
} from "@theforge/shared-types";
import {
  buildHeuristicTraceabilityFix,
  extractBrdExcerptForGap,
  extractMddTraceSections,
  shouldUseHeuristicFirst,
  suggestTraceabilityFixWithLlm,
} from "./traceability-suggest.util.js";

@Injectable()
export class TraceabilitySuggestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFactory: AIFactory,
    private readonly estimation: EstimationService,
  ) {}

  async suggestFix(body: TraceabilitySuggestFixRequest): Promise<TraceabilitySuggestFixResponse> {
    const parsed = traceabilitySuggestFixRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const { projectId, stageId, gap, mddContent: mddOverride } = parsed.data;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        userId: true,
        stages: {
          select: {
            id: true,
            ordinal: true,
            workflowStatus: true,
            brdContent: true,
            mddContent: true,
          },
        },
      },
    });
    if (!project) {
      throw new BadRequestException("Proyecto no encontrado");
    }

    const stage =
      (stageId && project.stages.find((s) => s.id === stageId)) ||
      pickPrimaryStage(project.stages);
    const brdContent = (stage?.brdContent ?? "").trim();
    if (!brdContent) {
      throw new BadRequestException("No hay BRD en la etapa activa para trazar la brecha");
    }

    const mddContent =
      (mddOverride ?? "").trim() ||
      (await this.estimation.getMddContentForProject(projectId, stage?.id)) ||
      (stage?.mddContent ?? "").trim();
    if (!mddContent) {
      throw new BadRequestException("No hay MDD para insertar el parche sugerido");
    }

    if (shouldUseHeuristicFirst(gap)) {
      return buildHeuristicTraceabilityFix(gap);
    }

    const userId = getRequestUserId() ?? project.userId;
    const llm = await createDbgaLLM(this.aiFactory, userId, {
      temperature: 0.25,
      outputTokenPurpose: "checklist",
    });

    const brdExcerpt = extractBrdExcerptForGap(brdContent, gap);
    const mddSections = extractMddTraceSections(mddContent);

    return suggestTraceabilityFixWithLlm(llm, {
      gap,
      brdExcerpt,
      mddSections,
    });
  }
}
