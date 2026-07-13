import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createProjectGroupSchema,
  updateProjectGroupSchema,
} from "@theforge/shared-types";
import { ProjectGroupsService } from "./project-groups.service.js";

@Controller("project-groups")
export class ProjectGroupsController {
  constructor(private readonly projectGroups: ProjectGroupsService) {}

  @Get()
  findAll() {
    return this.projectGroups.findAll();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.projectGroups.create(createProjectGroupSchema.parse(body));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.projectGroups.update(id, updateProjectGroupSchema.parse(body));
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.projectGroups.remove(id);
  }

  @Post(":id/move-to-first")
  moveToFirst(@Param("id") id: string) {
    return this.projectGroups.moveToFirst(id);
  }
}
