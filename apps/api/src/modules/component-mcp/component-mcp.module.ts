import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { ComponentMcpService } from "./component-mcp.service.js";

@Module({
  imports: [PrismaModule],
  providers: [ComponentMcpService],
  exports: [ComponentMcpService],
})
export class ComponentMcpModule {}
