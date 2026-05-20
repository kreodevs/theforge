import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { AudioController } from "./audio.controller.js";
import { AudioService } from "./audio.service.js";

@Module({
  imports: [AiModule],
  controllers: [AudioController],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}
