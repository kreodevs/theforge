import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { getRequestUserId } from "../../common/request-user.store.js";
import { ComponentSourceRegistry } from "./component-source.registry.js";
import { ComponentSourceProfileService } from "./component-source-profile.service.js";
import type {
  CreateComponentSourceProfileDto,
  SetProjectComponentSourceProfileDto,
  UpdateComponentSourceProfileDto,
} from "./component-source-profile.types.js";

@Controller("component-source")
export class ComponentSourceController {
  constructor(
    private readonly profiles: ComponentSourceProfileService,
    private readonly registry: ComponentSourceRegistry,
  ) {}

  @Get("profiles")
  listProfiles() {
    return this.profiles.listProfiles(getRequestUserId());
  }

  @Post("profiles")
  createProfile(@Body() body: CreateComponentSourceProfileDto) {
    return this.profiles.createProfile(body, getRequestUserId());
  }

  @Patch("profiles/:profileId")
  updateProfile(
    @Param("profileId") profileId: string,
    @Body() body: UpdateComponentSourceProfileDto,
  ) {
    return this.profiles.updateProfile(profileId, body, getRequestUserId());
  }

  @Delete("profiles/:profileId")
  @HttpCode(200)
  deleteProfile(@Param("profileId") profileId: string) {
    return this.profiles.deleteProfile(profileId, getRequestUserId());
  }

  @Get("projects/:projectId/profile")
  getProjectProfile(@Param("projectId") projectId: string) {
    return this.profiles.getProjectProfileAssignment(projectId, getRequestUserId());
  }

  @Put("projects/:projectId/profile")
  @HttpCode(200)
  setProjectProfile(
    @Param("projectId") projectId: string,
    @Body() body: SetProjectComponentSourceProfileDto,
  ) {
    return this.profiles.setProjectProfileAssignment(projectId, body, getRequestUserId());
  }

  @Post("profiles/:profileId/test")
  @HttpCode(200)
  testProfile(
    @Param("profileId") profileId: string,
    @Body() body: import("./component-source-profile.types.js").TestComponentSourceProfileDto,
  ) {
    return this.profiles.testProfileConnection(profileId, body, getRequestUserId());
  }

  @Post("profiles/:profileId/confirm-mapping")
  @HttpCode(200)
  confirmMapping(
    @Param("profileId") profileId: string,
    @Body() body: import("./component-source-profile.types.js").ConfirmComponentSourceProfileMappingDto,
  ) {
    return this.profiles.confirmProfileMapping(profileId, body, getRequestUserId());
  }

  @Get("plugins")
  listPlugins() {
    return this.registry.listPlugins();
  }
}
