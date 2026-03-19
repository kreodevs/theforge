import { Module } from "@nestjs/common";
import { SessionsService } from "./sessions.service.js";
import { SessionsController } from "./sessions.controller.js";
import { ChatResponseParserService } from "./chat-response-parser.service.js";
import { AiModule } from "../ai/ai.module.js";

@Module({
  imports: [AiModule],
  controllers: [SessionsController],
  providers: [SessionsService, ChatResponseParserService],
  exports: [SessionsService],
})
export class SessionsModule {}
