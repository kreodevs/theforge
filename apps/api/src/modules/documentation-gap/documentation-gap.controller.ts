import { Body, Controller, Param, Post } from "@nestjs/common";
import { DocumentationGapService } from "./documentation-gap.service.js";

@Controller("projects/:projectId/stages/:stageId/documentation-gaps")
export class DocumentationGapController {
  constructor(private readonly documentationGap: DocumentationGapService) {}

  @Post()
  reportGap(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
    @Body() body: unknown,
  ) {
    return this.documentationGap.reportGap(projectId, stageId, body);
  }
}
