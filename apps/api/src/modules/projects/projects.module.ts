import { Module } from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
import { ProjectsController } from "./projects.controller.js";
import { EngineModule } from "../engine/engine.module.js";
import { AiModule } from "../ai/ai.module.js";
import { ScraperModule } from "../scraper/scraper.module.js";

@Module({
  imports: [EngineModule, AiModule, ScraperModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule { }
