import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { EvdStorageService } from "./evd-storage.service.js";
import { EvdExportService } from "./evd-export.service.js";

@Controller("evd")
export class EvdStorageController {
  constructor(
    private readonly evdStorage: EvdStorageService,
    private readonly evdExport: EvdExportService,
  ) {}

  @Get(":projectId/slides")
  async getSlides(@Param("projectId") projectId: string) {
    const slides = this.evdStorage.loadSlides(projectId);
    const dbSlides = await this.evdStorage.loadFromDb(projectId);
    const branding = this.evdStorage.loadBranding(projectId);
    return {
      slides: slides ?? dbSlides ?? [],
      branding,
      files: this.evdStorage.listFiles(projectId),
    };
  }

  @Post(":projectId/slides")
  async saveSlides(@Param("projectId") projectId: string, @Body() body: unknown) {
    return this.evdStorage.saveSlides(projectId, body);
  }

  @Post(":projectId/branding")
  async saveBranding(@Param("projectId") projectId: string, @Body() body: unknown) {
    return this.evdStorage.saveBranding(projectId, body);
  }

  @Post(":projectId/logo")
  @UseInterceptors(FileInterceptor("logo"))
  async uploadLogo(
    @Param("projectId") projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Logo file is required");
    return this.evdStorage.saveLogo(projectId, file);
  }

  @Get(":projectId/logo")
  getLogo(@Param("projectId") projectId: string, @Res() res: Response) {
    const logo = this.evdStorage.loadLogo(projectId);
    if (!logo) throw new NotFoundException("No logo uploaded");
    res.set("Content-Type", logo.mime);
    res.send(logo.buffer);
  }

  @Delete(":projectId")
  async deleteAll(@Param("projectId") projectId: string) {
    return this.evdStorage.deleteAll(projectId);
  }

  @Post(":projectId/persist")
  async persistToDb(@Param("projectId") projectId: string, @Body() body: unknown) {
    await this.evdStorage.persistToDb(projectId, body);
    return { ok: true };
  }

  // --- Export endpoints ---

  @Post(":projectId/export/pptx")
  async exportPptx(@Param("projectId") projectId: string, @Res() res: Response) {
    const buffer = await this.evdExport.exportPPTX(projectId);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="executive-vision-deck.pptx"`,
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  }

  @Post(":projectId/export/pdf")
  async exportPdf(@Param("projectId") projectId: string, @Res() res: Response) {
    const buffer = await this.evdExport.exportPDF(projectId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="executive-vision-deck.pdf"`,
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  }

  @Get(":projectId/export/:format")
  async downloadExport(
    @Param("projectId") projectId: string,
    @Param("format") format: string,
    @Res() res: Response,
  ) {
    const allowed = ["pptx", "pdf"];
    if (!allowed.includes(format)) throw new BadRequestException(`Format must be one of: ${allowed.join(", ")}`);

    const buffer = this.evdStorage.loadExport(projectId, `deck.${format}`);
    if (!buffer) throw new NotFoundException(`No ${format} export found. Generate it first.`);

    const mimeMap: Record<string, string> = {
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      pdf: "application/pdf",
    };

    res.set({
      "Content-Type": mimeMap[format] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="executive-vision-deck.${format}"`,
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  }

  @Post(":projectId/render")
  async renderVisuals(@Param("projectId") projectId: string) {
    return this.evdExport.renderAndPersist(projectId);
  }
}
