import { Module } from "@nestjs/common";
import { ConformanceService } from "./conformance.service.js";
import { CostCalculatorService } from "./cost-calculator.service.js";
import { SemaphoreService } from "./semaphore.service.js";

@Module({
  providers: [CostCalculatorService, SemaphoreService, ConformanceService],
  exports: [CostCalculatorService, SemaphoreService, ConformanceService],
})
export class EngineModule { }
