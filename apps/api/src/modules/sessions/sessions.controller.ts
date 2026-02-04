import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { SessionsService } from "./sessions.service.js";
import { createSessionSchema, appendChatSchema } from "@the-forge/shared-types";

@Controller("sessions")
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.sessions.create(createSessionSchema.parse(body));
  }

  @Get("project/:projectId")
  findByProject(@Param("projectId") projectId: string) {
    return this.sessions.findByProject(projectId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.sessions.findOne(id);
  }

  @Post(":id/messages")
  appendMessage(@Param("id") id: string, @Body() body: unknown) {
    return this.sessions.appendMessage(id, appendChatSchema.parse(body));
  }

  @Post(":id/chat")
  chat(@Param("id") id: string, @Body() body: { message: string }) {
    return this.sessions.chat(id, body.message);
  }

  @Patch(":id/context")
  updateContextStep(
    @Param("id") id: string,
    @Body() body: { contextStep: string },
  ) {
    return this.sessions.updateContextStep(id, body.contextStep);
  }
}
