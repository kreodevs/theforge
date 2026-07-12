import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { EvdStorageController } from "./evd-storage.controller.js";
import { EvdStorageService } from "./evd-storage.service.js";
import { EvdChartService } from "./evd-chart.service.js";
import { EvdDiagramService } from "./evd-diagram.service.js";
import { EvdPptxService } from "./evd-pptx.service.js";
import { EvdPdfService } from "./evd-pdf.service.js";
import { EvdExportService } from "./evd-export.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [EvdStorageController],
  providers: [
    EvdStorageService,
    EvdChartService,
    EvdDiagramService,
    EvdPptxService,
    EvdPdfService,
    EvdExportService,
  ],
  exports: [
    EvdStorageService,
    EvdChartService,
    EvdDiagramService,
    EvdPptxService,
    EvdPdfService,
    EvdExportService,
  ],
})
export class EvdStorageModule {}
