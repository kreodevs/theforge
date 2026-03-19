import { BadRequestException, Body, Controller, Post, Res } from "@nestjs/common";
import { AiOrchestratorService } from "./ai-orchestrator.service.js";

/** Minimal type for SSE response (avoids express types). */
interface SseResponse {
  setHeader(name: string, value: string | number): void;
  write(chunk: string, encoding?: unknown): void;
  end(cb?: () => void): void;
  flushHeaders(): void;
}

@Controller("ai-orchestrator")
export class AiOrchestratorController {
  constructor(private readonly orchestrator: AiOrchestratorService) { }

  @Post("chat")
  chat(
    @Body()
    body: {
      projectId: string;
      sessionId?: string;
      message: string;
      mddContent?: string | null;
      uxUiGuideContent?: string | null;
      dbgaContent?: string | null;
      activeTab?: string;
      stageId?: string;
    },
  ) {
    const { projectId, sessionId, message, mddContent, uxUiGuideContent, dbgaContent, activeTab, stageId } =
      body;
    if (!projectId || !message?.trim()) {
      throw new BadRequestException("projectId and message are required");
    }
    return this.orchestrator.chat(
      projectId,
      message.trim(),
      sessionId,
      mddContent?.trim() || undefined,
      activeTab?.trim() || undefined,
      uxUiGuideContent?.trim() || undefined,
      dbgaContent?.trim() || undefined,
      stageId?.trim() || undefined,
    );
  }

  @Post("chat/stream")
  async chatStream(
    @Body()
    body: {
      projectId: string;
      sessionId?: string;
      message: string;
      mddContent?: string | null;
      uxUiGuideContent?: string | null;
      dbgaContent?: string | null;
      specContent?: string | null;
      activeTab?: string;
      stageId?: string;
    },
    @Res({ passthrough: false }) res: SseResponse,
  ) {
    const {
      projectId,
      sessionId,
      message,
      mddContent,
      uxUiGuideContent,
      dbgaContent,
      specContent,
      activeTab,
      stageId,
    } = body;
    if (!projectId || !message?.trim()) {
      throw new BadRequestException("projectId and message are required");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const stream = this.orchestrator.chatStream(
        projectId,
        message.trim(),
        sessionId?.trim(),
        mddContent?.trim() || undefined,
        activeTab?.trim() || undefined,
        uxUiGuideContent?.trim() || undefined,
        dbgaContent?.trim() || undefined,
        specContent?.trim() || undefined,
        stageId?.trim() || undefined,
      );
      for await (const msg of stream) {
        const data = JSON.stringify(msg.data);
        res.write(`event: ${msg.event}\ndata: ${data}\n\n`);
        if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
          (res as unknown as { flush: () => void }).flush();
        }
      }
    } catch (err) {
      const payload = JSON.stringify({
        error: err instanceof Error ? err.message : "Error en el stream",
      });
      res.write(`event: error\ndata: ${payload}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post("welcome")
  welcome(@Body() body: { projectId: string; sessionId?: string; activeTab?: string; stageId?: string }) {
    const { projectId, sessionId, activeTab, stageId } = body ?? {};
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.orchestrator.welcome(projectId.trim(), sessionId?.trim(), activeTab?.trim(), stageId?.trim());
  }

  @Post("clear-chat")
  clearChat(@Body() body: { projectId: string; sessionId?: string }) {
    const { projectId, sessionId } = body ?? {};
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.orchestrator.clearChat(projectId.trim(), sessionId?.trim());
  }
}
