import { Module, forwardRef } from "@nestjs/common";
import { SessionsService } from "./sessions.service.js";
import { SessionsController } from "./sessions.controller.js";
import { ChatResponseParserService } from "./chat-response-parser.service.js";
import { AiModule } from "../ai/ai.module.js";
import { AiOrchestratorModule } from "../ai-orchestrator/ai-orchestrator.module.js";

@Module({
  imports: [AiModule, forwardRef(() => AiOrchestratorModule)],
  controllers: [SessionsController],
  providers: [SessionsService, ChatResponseParserService],
  exports: [SessionsService],
})
export class SessionsModule {}
