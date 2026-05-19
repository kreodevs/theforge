import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { UserProvidersModule } from "../user-providers/user-providers.module.js";
import { AIFactory } from "./ai.factory.js";
import { AiService } from "./ai.service.js";
import { DiscoveryService } from "./discovery.service.js";
import { PreferencesService } from "./preferences.service.js";
import { AiController } from "./ai.controller.js";

@Module({
  imports: [PrismaModule, UserProvidersModule],
  controllers: [AiController],
  providers: [AIFactory, AiService, DiscoveryService, PreferencesService],
  exports: [AIFactory, AiService, DiscoveryService, PreferencesService],
})
export class AiModule {}
