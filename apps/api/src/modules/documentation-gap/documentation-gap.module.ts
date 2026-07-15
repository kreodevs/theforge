import { Module, forwardRef } from "@nestjs/common";
import {
  DOCUMENTATION_GAP_SERVICE_TOKEN,
  DOC_RECONCILE_SERVICE_TOKEN,
} from "../../injection-tokens.js";
import { ChangeLogModule } from "../change-log/change-log.module.js";
import { EngineModule } from "../engine/engine.module.js";
import { GraphMemoryModule } from "../ai-analysis/graph-memory/graph-memory.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { UiMcpModule } from "../ui-mcp/ui-mcp.module.js";
import { AgentSessionLogController } from "./agent-session-log.controller.js";
import { AgentSessionLogService } from "./agent-session-log.service.js";
import { ArchitectureDecisionService } from "./architecture-decision.service.js";
import { DocReconcileService } from "./doc-reconcile.service.js";
import { DocumentationGapController } from "./documentation-gap.controller.js";
import { DocumentationGapService } from "./documentation-gap.service.js";

@Module({
  imports: [ChangeLogModule, EngineModule, GraphMemoryModule, UiMcpModule, forwardRef(() => ProjectsModule)],
  controllers: [DocumentationGapController, AgentSessionLogController],
  providers: [
    DocumentationGapService,
    { provide: DOCUMENTATION_GAP_SERVICE_TOKEN, useExisting: DocumentationGapService },
    AgentSessionLogService,
    ArchitectureDecisionService,
    DocReconcileService,
    { provide: DOC_RECONCILE_SERVICE_TOKEN, useExisting: DocReconcileService },
  ],
  exports: [
    DocumentationGapService,
    AgentSessionLogService,
    ArchitectureDecisionService,
    DocReconcileService,
  ],
})
export class DocumentationGapModule {}
