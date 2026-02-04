import { Module } from "@nestjs/common";
import { AiOrchestratorService } from "./ai-orchestrator.service.js";
import { AiOrchestratorController } from "./ai-orchestrator.controller.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { SessionsModule } from "../sessions/sessions.module.js";

@Module({
  imports: [SessionsModule, ProjectsModule],
  controllers: [AiOrchestratorController],
  providers: [AiOrchestratorService],
  exports: [AiOrchestratorService],
})
export class AiOrchestratorModule { }
