import { forwardRef, Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { CryptoModule } from "../crypto/crypto.module.js";
import { AiModule } from "../ai/ai.module.js";
import { AiAnalysisModule } from "../ai-analysis/ai-analysis.module.js";
import { ComponentSourceAuthController } from "./component-source-auth.controller.js";
import { ComponentSourceController } from "./component-source.controller.js";
import { ComponentSourceCredentialService } from "./component-source-credential.service.js";
import { ComponentSourceMcpToolsService } from "./component-source-mcp-tools.service.js";
import { ComponentSourceProfileService } from "./component-source-profile.service.js";
import { ComponentSourceRegenerationQueueService } from "./component-source-regeneration-queue.service.js";
import { ComponentSourceRegenerationService } from "./component-source-regeneration.service.js";
import { ComponentSourceToolMappingService } from "./component-source-tool-mapping.service.js";
import {
  COMPONENT_SOURCE_REGISTRY,
  ComponentSourceRegistry,
} from "./component-source.registry.js";

@Module({
  imports: [PrismaModule, CryptoModule, AiModule, forwardRef(() => AiAnalysisModule)],
  controllers: [ComponentSourceController, ComponentSourceAuthController],
  providers: [
    ComponentSourceCredentialService,
    ComponentSourceMcpToolsService,
    ComponentSourceToolMappingService,
    ComponentSourceRegenerationService,
    ComponentSourceRegenerationQueueService,
    ComponentSourceProfileService,
    ComponentSourceRegistry,
    {
      provide: COMPONENT_SOURCE_REGISTRY,
      useExisting: ComponentSourceRegistry,
    },
  ],
  exports: [
    ComponentSourceCredentialService,
    ComponentSourceMcpToolsService,
    ComponentSourceProfileService,
    ComponentSourceRegenerationService,
    ComponentSourceRegistry,
    COMPONENT_SOURCE_REGISTRY,
  ],
})
export class ComponentSourceModule {}
