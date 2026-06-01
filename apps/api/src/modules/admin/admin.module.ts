import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { ComponentSourceModule } from "../component-source/component-source.module.js";
import { AdminController } from "./admin.controller.js";

@Module({
  imports: [PrismaModule, ComponentSourceModule],
  controllers: [AdminController],
})
export class AdminModule {}
