import { Module, forwardRef } from "@nestjs/common";
import { PluginModule } from "../../plugins/plugin.module.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { PluginsController } from "./plugins.controller.js";

@Module({
  imports: [PluginModule, PrismaModule, forwardRef(() => ProjectsModule)],
  controllers: [PluginsController],
})
export class PluginsApiModule {}
