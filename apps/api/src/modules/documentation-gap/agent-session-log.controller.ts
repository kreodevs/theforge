import { Controller, Get, Param, Query } from "@nestjs/common";
import { AgentSessionLogService } from "./agent-session-log.service.js";

@Controller("projects/:projectId/stages/:stageId/agent-session-log")
export class AgentSessionLogController {
  constructor(private readonly agentSessionLog: AgentSessionLogService) {}

  @Get()
  async list(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
    @Query("limit") limit?: string,
  ) {
    const max = limit ? parseInt(limit, 10) : undefined;
    const entries = await this.agentSessionLog.listByStage(projectId, stageId, { limit: max });
    return { entries };
  }
}
