import { Module } from "@nestjs/common";
import { ConformanceService } from "./conformance.service.js";
import { CostCalculatorService } from "./cost-calculator.service.js";
import { SemaphoreService } from "./semaphore.service.js";
import { MddUpdatePipelineService } from "./mdd-update-pipeline.service.js";
import { GraphMemoryModule } from "../ai-analysis/graph-memory/graph-memory.module.js";

@Module({
  imports: [GraphMemoryModule],
  providers: [CostCalculatorService, SemaphoreService, ConformanceService, MddUpdatePipelineService],
  exports: [CostCalculatorService, SemaphoreService, ConformanceService, MddUpdatePipelineService],
})
export class EngineModule { }
