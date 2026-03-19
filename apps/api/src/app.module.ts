import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { HealthController } from "./health.controller.js";
import { AiModule } from "./modules/ai/ai.module.js";
import { EngineModule } from "./modules/engine/engine.module.js";
import { ProjectsModule } from "./modules/projects/projects.module.js";
import { SessionsModule } from "./modules/sessions/sessions.module.js";
import { AiOrchestratorModule } from "./modules/ai-orchestrator/ai-orchestrator.module.js";
import { AiAnalysisModule } from "./modules/ai-analysis/ai-analysis.module.js";
import { TheForgeModule } from "./modules/theforge/theforge.module.js";
import { LegacyFlowModule } from "./modules/legacy-flow/legacy-flow.module.js";

@Module({
  controllers: [HealthController],
  imports: [
    PrismaModule,
    AiModule,
    EngineModule,
    ProjectsModule,
    SessionsModule,
    AiOrchestratorModule,
    AiAnalysisModule,
    TheForgeModule,
    LegacyFlowModule,
  ],
})
export class AppModule { }
