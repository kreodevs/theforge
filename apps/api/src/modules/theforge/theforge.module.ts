import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { TheForgeContextCacheService } from "./theforge-context-cache.service.js";
import { THEFORGE_ORCHESTRATOR_PORT } from "./theforge-service.port.js";
import { TheForgeService } from "./theforge.service.js";
import { TheForgeController } from "./theforge.controller.js";

@Module({
  imports: [PrismaModule],
  controllers: [TheForgeController],
  providers: [
    TheForgeContextCacheService,
    TheForgeService,
    { provide: THEFORGE_ORCHESTRATOR_PORT, useExisting: TheForgeService },
  ],
  exports: [TheForgeContextCacheService, TheForgeService, THEFORGE_ORCHESTRATOR_PORT],
})
export class TheForgeModule {}
