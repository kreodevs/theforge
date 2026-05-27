import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AiModule } from "../ai/ai.module.js";
import { WireframeSketchesSyncService } from "./wireframe-sketches-sync.service.js";

@Module({
  imports: [PrismaModule, AiModule],
  providers: [WireframeSketchesSyncService],
  exports: [WireframeSketchesSyncService],
})
export class WireframeSketchesModule {}
