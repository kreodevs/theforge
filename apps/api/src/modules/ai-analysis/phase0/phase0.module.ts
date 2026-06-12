import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module.js";
import { AiModule } from "../../ai/ai.module.js";
import { Phase0InterviewService } from "./phase0-interview.service.js";

/** Paso 0 interactivo sin importar ProjectsModule (evita ciclo con AiAnalysisModule). */
@Module({
  imports: [PrismaModule, AiModule],
  providers: [Phase0InterviewService],
  exports: [Phase0InterviewService],
})
export class Phase0Module {}
