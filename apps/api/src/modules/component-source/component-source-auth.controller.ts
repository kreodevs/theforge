import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { getRequestUserId } from "../../common/request-user.store.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { ComponentSourceProfileService } from "./component-source-profile.service.js";
import { ComponentSourceRegenerationService } from "./component-source-regeneration.service.js";
import type {
  ConfirmComponentSourceProfileMappingDto,
  CreateComponentSourceProfileDto,
  TestComponentSourceProfileDto,
  UpdateComponentSourceProfileDto,
} from "./component-source-profile.types.js";

/**
 * Auth-prefixed routes expected by the web app (`/api/auth/component-source/...`).
 */
@Controller("auth/component-source")
@UseGuards(JwtAuthGuard)
export class ComponentSourceAuthController {
  constructor(
    private readonly profiles: ComponentSourceProfileService,
    private readonly regeneration: ComponentSourceRegenerationService,
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
  patchProfile(
    @Param("profileId") profileId: string,
    @Body() body: UpdateComponentSourceProfileDto,
  ) {
    return this.profiles.updateProfile(profileId, body, getRequestUserId());
  }

  /** Frontend uses PUT for updates — alias of PATCH. */
  @Put("profiles/:profileId")
  @HttpCode(200)
  putProfile(
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

  @Post("profiles/:profileId/test")
  @HttpCode(200)
  testProfile(
    @Param("profileId") profileId: string,
    @Body() body: TestComponentSourceProfileDto,
  ) {
    return this.profiles.testProfileConnection(profileId, body, getRequestUserId());
  }

  @Post("profiles/:profileId/confirm-mapping")
  @HttpCode(200)
  confirmMapping(
    @Param("profileId") profileId: string,
    @Body() body: ConfirmComponentSourceProfileMappingDto,
  ) {
    return this.profiles.confirmProfileMapping(profileId, body, getRequestUserId());
  }

  /** Import full design system markdown from the project's assigned MCP profile. */
  @Post("projects/:projectId/design-system")
  @HttpCode(200)
  fetchProjectDesignSystem(@Param("projectId") projectId: string) {
    return this.profiles.fetchProjectDesignSystem(projectId, getRequestUserId());
  }

  /** NDJSON stream of regeneration progress for the authenticated user. */
  @Get("regeneration/events")
  async regenerationEvents(@Res({ passthrough: false }) res: Response): Promise<void> {
    const userId = getRequestUserId();

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const writeEvent = (payload: unknown) => {
      if (res.writableEnded) return;
      res.write(`${JSON.stringify(payload)}\n`);
    };

    const replay = await this.regeneration.getReplayEvents(userId);
    for (const event of replay) {
      writeEvent(event);
    }

    const unsubscribe = this.regeneration.subscribe(userId, (event) => {
      writeEvent(event);
    });

    res.on("close", () => {
      unsubscribe();
    });
  }
}
