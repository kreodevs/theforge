import { Module } from "@nestjs/common";
import { ConformanceService } from "./conformance.service.js";
import { CostCalculatorService } from "./cost-calculator.service.js";
import { SemaphoreService } from "./semaphore.service.js";
import { MddUpdatePipelineService } from "./mdd-update-pipeline.service.js";

@Module({
  providers: [CostCalculatorService, SemaphoreService, ConformanceService, MddUpdatePipelineService],
  exports: [CostCalculatorService, SemaphoreService, ConformanceService, MddUpdatePipelineService],
})
export class EngineModule { }
