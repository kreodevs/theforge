import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AiModule } from "../ai/ai.module.js";
import { ComponentSourceModule } from "../component-source/component-source.module.js";
import { WireframeSketchesSyncService } from "./wireframe-sketches-sync.service.js";

@Module({
  imports: [PrismaModule, AiModule, ComponentSourceModule],
  providers: [WireframeSketchesSyncService],
  exports: [WireframeSketchesSyncService],
})
export class WireframeSketchesModule {}
