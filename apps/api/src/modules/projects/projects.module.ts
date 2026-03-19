import { Module } from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectEstimationRecalcService } from "./project-estimation-recalc.service.js";
import { EngineModule } from "../engine/engine.module.js";
import { AiModule } from "../ai/ai.module.js";
import { ScraperModule } from "../scraper/scraper.module.js";
import { TheForgeModule } from "../theforge/theforge.module.js";

@Module({
  imports: [EngineModule, AiModule, ScraperModule, TheForgeModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectEstimationRecalcService],
  exports: [ProjectsService],
})
export class ProjectsModule { }
