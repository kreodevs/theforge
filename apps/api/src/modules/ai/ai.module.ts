import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { UserProvidersModule } from "../user-providers/user-providers.module.js";
import { TechnologyDocsMcpModule } from "../technology-docs-mcp/technology-docs-mcp.module.js";
import { AIFactory } from "./ai.factory.js";
import { AiService } from "./ai.service.js";
import { IntentClassifierService } from "./intent-classifier.service.js";
import { IntentRouterService } from "./intent-router.service.js";
import { DiscoveryService } from "./discovery.service.js";
import { PreferencesService } from "./preferences.service.js";
import { AiController } from "./ai.controller.js";

@Module({
  imports: [PrismaModule, UserProvidersModule, TechnologyDocsMcpModule],
  controllers: [AiController],
  providers: [
    AIFactory,
    AiService,
    IntentClassifierService,
    IntentRouterService,
    DiscoveryService,
    PreferencesService,
  ],
  exports: [
    AIFactory,
    AiService,
    IntentClassifierService,
    IntentRouterService,
    DiscoveryService,
    PreferencesService,
  ],
})
export class AiModule {}
