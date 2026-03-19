import { Module } from "@nestjs/common";
import { AgentSupervisorService } from "./agent-supervisor.service.js";
import { AgentEvaluatorService } from "./agent-evaluator.service.js";
import { AgentSupervisorController } from "./agent-supervisor.controller.js";
import { TheForgeModule } from "../theforge/theforge.module.js";

@Module({
  imports: [TheForgeModule],
  controllers: [AgentSupervisorController],
  providers: [AgentSupervisorService, AgentEvaluatorService],
  exports: [AgentSupervisorService, AgentEvaluatorService],
})
export class AgentSupervisorModule { }
