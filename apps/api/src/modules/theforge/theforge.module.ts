import { Module } from "@nestjs/common";
import { TheForgeService } from "./theforge.service.js";
import { TheForgeController } from "./theforge.controller.js";

@Module({
  controllers: [TheForgeController],
  providers: [TheForgeService],
  exports: [TheForgeService],
})
export class TheForgeModule {}
