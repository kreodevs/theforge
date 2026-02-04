import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AiModule } from "../ai/ai.module.js";
import { AiAnalysisController } from "./ai-analysis.controller.js";
import { AiAnalysisService } from "./ai-analysis.service.js";
import { CheckpointerService } from "./checkpoint/checkpointer.service.js";
import { EstimationService } from "./estimation/estimation.service.js";

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [AiAnalysisController],
  providers: [CheckpointerService, EstimationService, AiAnalysisService],
  exports: [AiAnalysisService, EstimationService],
})
export class AiAnalysisModule { }
