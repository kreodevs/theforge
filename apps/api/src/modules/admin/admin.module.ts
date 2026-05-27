import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { ComponentMcpModule } from "../component-mcp/component-mcp.module.js";
import { AdminController } from "./admin.controller.js";

@Module({
  imports: [PrismaModule, ComponentMcpModule],
  controllers: [AdminController],
})
export class AdminModule {}
