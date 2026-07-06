import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module.js";
import { EstimationService } from "./estimation.service.js";

@Module({
  imports: [PrismaModule],
  providers: [EstimationService],
  exports: [EstimationService],
})
export class EstimationModule {}
