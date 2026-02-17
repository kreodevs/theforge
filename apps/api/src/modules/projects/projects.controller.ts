import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
import {
  createProjectSchema,
  updateProjectSchema,
  phase0DeepResearchBodySchema,
} from "@the-forge/shared-types";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) { }

  @Post()
  create(@Body() body: unknown) {
    return this.projects.create(createProjectSchema.parse(body));
  }

  @Get()
  findAll() {
    return this.projects.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.projects.findOne(id);
  }

  @Get(":id/conformance")
  getConformance(@Param("id") id: string, @Query("useLlm") useLlm?: string) {
    return this.projects.getConformance(id, { useLlm: useLlm === "true" });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.projects.update(id, updateProjectSchema.partial().parse(body));
  }

  @Post(":id/generate-benchmark")
  generateBenchmark(
    @Param("id") id: string,
    @Body() body: { userIdea?: string; urls?: string[] },
  ) {
    const userIdea = typeof body?.userIdea === "string" ? body.userIdea : "";
    const urls = Array.isArray(body?.urls) ? body.urls.filter((u): u is string => typeof u === "string") : undefined;
    return this.projects.generateBenchmark(id, userIdea, urls);
  }

  @Post(":id/phase0-deep-research")
  phase0DeepResearch(@Param("id") id: string, @Body() body: unknown) {
    const parsed = phase0DeepResearchBodySchema.parse(body ?? {});
    return this.projects.phase0DeepResearch(id, {
      userIdea: parsed.userIdea,
      urls: parsed.urls,
      includeBenchmark: parsed.includeBenchmark,
    });
  }

  @Post(":id/generate-spec")
  generateSpec(@Param("id") id: string) {
    return this.projects.generateSpec(id);
  }

  @Post(":id/generate-tasks")
  generateTasks(@Param("id") id: string) {
    return this.projects.generateTasks(id);
  }

  @Post(":id/generate-architecture")
  generateArchitecture(@Param("id") id: string, @Body() body: { preview?: boolean }) {
    if (body?.preview) return this.projects.generateArchitecturePreview(id);
    return this.projects.generateArchitecture(id);
  }

  @Post(":id/generate-use-cases")
  generateUseCases(@Param("id") id: string, @Body() body: { preview?: boolean }) {
    if (body?.preview) return this.projects.generateUseCasesPreview(id);
    return this.projects.generateUseCases(id);
  }

  @Post(":id/generate-user-stories")
  generateUserStories(@Param("id") id: string, @Body() body: { preview?: boolean }) {
    if (body?.preview) return this.projects.generateUserStoriesPreview(id);
    return this.projects.generateUserStories(id);
  }

  @Post(":id/generate-blueprint")
  generateBlueprint(@Param("id") id: string, @Body() body: { preview?: boolean; gapsFeedback?: string }) {
    const gaps = typeof body?.gapsFeedback === "string" ? body.gapsFeedback.trim() || undefined : undefined;
    if (body?.preview) return this.projects.generateBlueprintPreview(id, gaps);
    return this.projects.generateBlueprint(id, gaps);
  }

  @Post(":id/generate-api-contracts")
  generateApiContracts(@Param("id") id: string, @Body() body: { preview?: boolean; gapsFeedback?: string }) {
    const gaps = typeof body?.gapsFeedback === "string" ? body.gapsFeedback.trim() || undefined : undefined;
    if (body?.preview) return this.projects.generateApiContractsPreview(id, gaps);
    return this.projects.generateApiContracts(id, gaps);
  }

  @Post(":id/generate-logic-flows")
  generateLogicFlows(@Param("id") id: string, @Body() body: { gapsFeedback?: string }) {
    const gaps = typeof body?.gapsFeedback === "string" ? body.gapsFeedback.trim() || undefined : undefined;
    return this.projects.generateLogicFlows(id, gaps);
  }

  @Post(":id/generate-infra")
  generateInfra(@Param("id") id: string, @Body() body: { preview?: boolean; gapsFeedback?: string }) {
    const gaps = typeof body?.gapsFeedback === "string" ? body.gapsFeedback.trim() || undefined : undefined;
    if (body?.preview) return this.projects.generateInfraPreview(id, gaps);
    return this.projects.generateInfra(id, gaps);
  }

  @Post(":id/verify-deliverable")
  verifyDeliverable(
    @Param("id") id: string,
    @Body() body: { deliverable?: "blueprint" | "api" | "infra" },
  ) {
    const deliverable = body?.deliverable ?? "blueprint";
    return this.projects.verifyDeliverable(id, deliverable);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.projects.remove(id);
  }
}
