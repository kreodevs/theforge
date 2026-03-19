import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AiModule } from "../ai/ai.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { TheForgeModule } from "../theforge/theforge.module.js";
import { AgentSupervisorModule } from "../agent-supervisor/agent-supervisor.module.js";
import { AiAnalysisController } from "./ai-analysis.controller.js";
import { AiAnalysisService } from "./ai-analysis.service.js";
import { CheckpointerService } from "./checkpoint/checkpointer.service.js";
import { EstimationService } from "./estimation/estimation.service.js";
import { GraphMemoryService } from "./graph-memory/graph-memory.service.js";
import { SddIngestorService } from "./sdd-ingestor.service.js";

@Module({
  imports: [PrismaModule, AiModule, ProjectsModule, TheForgeModule, AgentSupervisorModule],
  controllers: [AiAnalysisController],
  providers: [CheckpointerService, EstimationService, AiAnalysisService, GraphMemoryService, SddIngestorService],
  exports: [AiAnalysisService, EstimationService, GraphMemoryService, SddIngestorService],
})
export class AiAnalysisModule { }
