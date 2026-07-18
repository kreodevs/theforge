import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { ProjectAriadneLinkService } from "./project-ariadne-link.service.js";
import { TheForgeContextCacheService } from "./theforge-context-cache.service.js";
import { THEFORGE_ORCHESTRATOR_PORT } from "./theforge-service.port.js";
import { TheForgeService } from "./theforge.service.js";
import { TheForgeController } from "./theforge.controller.js";

@Module({
  imports: [PrismaModule, forwardRef(() => ProjectsModule)],
  controllers: [TheForgeController],
  providers: [
    TheForgeContextCacheService,
    ProjectAriadneLinkService,
    TheForgeService,
    { provide: THEFORGE_ORCHESTRATOR_PORT, useExisting: TheForgeService },
  ],
  exports: [
    TheForgeContextCacheService,
    ProjectAriadneLinkService,
    TheForgeService,
    THEFORGE_ORCHESTRATOR_PORT,
  ],
})
export class TheForgeModule {}
