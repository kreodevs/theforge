import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AiModule } from "../ai/ai.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { TheForgeModule } from "../theforge/theforge.module.js";
import { AgentSupervisorModule } from "../agent-supervisor/agent-supervisor.module.js";
import { LegacyFlowModule } from "../legacy-flow/legacy-flow.module.js";
import { AiAnalysisController } from "./ai-analysis.controller.js";
import { AiAnalysisService } from "./ai-analysis.service.js";
import { CheckpointerService } from "./checkpoint/checkpointer.service.js";
import { NodeCacheService } from "./checkpoint/node-cache.service.js";
import { EstimationModule } from "./estimation/estimation.module.js";
import { SddIngestorService } from "./sdd-ingestor.service.js";
import { MddManualAuditService } from "./mdd/mdd-manual-audit.service.js";
import { MddQueueService } from "./mdd/mdd-queue.service.js";
import { MddUpstreamSyncService } from "./mdd/mdd-upstream-sync.service.js";
import { TraceabilitySuggestService } from "./traceability/traceability-suggest.service.js";
import { GraphMemoryModule } from "./graph-memory/graph-memory.module.js";
import { Phase0Module } from "./phase0/phase0.module.js";
import { UiMcpModule } from "../ui-mcp/ui-mcp.module.js";

@Module({
  imports: [
    PrismaModule,
    AiModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => LegacyFlowModule),
    TheForgeModule,
    AgentSupervisorModule,
    GraphMemoryModule,
    Phase0Module,
    UiMcpModule,
    EstimationModule,
  ],
  controllers: [AiAnalysisController],
  providers: [
    NodeCacheService,
    CheckpointerService,
    AiAnalysisService,
    SddIngestorService,
    MddManualAuditService,
    MddQueueService,
    MddUpstreamSyncService,
    TraceabilitySuggestService,
  ],
  exports: [
    AiAnalysisService,
    EstimationModule,
    GraphMemoryModule,
    SddIngestorService,
    Phase0Module,
    MddManualAuditService,
    MddQueueService,
    MddUpstreamSyncService,
    TraceabilitySuggestService,
  ],
})
export class AiAnalysisModule { }
