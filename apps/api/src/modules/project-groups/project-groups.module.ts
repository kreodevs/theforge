import { Module } from "@nestjs/common";
import { ProjectGroupsController } from "./project-groups.controller.js";
import { ProjectGroupsService } from "./project-groups.service.js";

@Module({
  controllers: [ProjectGroupsController],
  providers: [ProjectGroupsService],
  exports: [ProjectGroupsService],
})
export class ProjectGroupsModule {}
