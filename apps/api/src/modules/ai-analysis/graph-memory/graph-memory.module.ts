import { Module } from "@nestjs/common";
import { AiModule } from "../../ai/ai.module.js";
import { GraphMemoryService } from "./graph-memory.service.js";

@Module({
  imports: [AiModule],
  providers: [GraphMemoryService],
  exports: [GraphMemoryService],
})
export class GraphMemoryModule {}
