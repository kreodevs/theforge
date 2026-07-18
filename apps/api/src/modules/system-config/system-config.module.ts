import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { SystemConfigController } from "./system-config.controller.js";
import { SystemConfigService } from "./system-config.service.js";

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
