import { Module } from "@nestjs/common";
import { PluginModule } from "../../plugins/plugin.module.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { PluginsController } from "./plugins.controller.js";

@Module({
  imports: [PluginModule, PrismaModule],
  controllers: [PluginsController],
})
export class PluginsApiModule {}