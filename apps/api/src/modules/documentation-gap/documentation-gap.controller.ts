import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { DocumentationGapService } from "./documentation-gap.service.js";

@Controller("projects/:projectId/stages/:stageId/documentation-gaps")
export class DocumentationGapController {
  constructor(private readonly documentationGap: DocumentationGapService) {}

  @Get()
  listGaps(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
    @Query("status") status?: string,
  ) {
    return this.documentationGap.listGaps(projectId, stageId, status);
  }

  @Post()
  reportGap(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
    @Body() body: unknown,
  ) {
    return this.documentationGap.reportGap(projectId, stageId, body);
  }

  @Post(":gapId/approve")
  approveGap(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
    @Param("gapId") gapId: string,
  ) {
    return this.documentationGap.approveGap(projectId, stageId, gapId);
  }

  @Post(":gapId/reject")
  rejectGap(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
    @Param("gapId") gapId: string,
    @Body() body: unknown,
  ) {
    return this.documentationGap.rejectGap(projectId, stageId, gapId, body);
  }
}
