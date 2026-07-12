import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaService } from "../../prisma/prisma.service.js";

const DATA_ROOT = process.env.EVD_DATA_ROOT ?? "/app/data";

@Injectable()
export class EvdStorageService {
  private readonly logger = new Logger(EvdStorageService.name);

  constructor(private readonly prisma: PrismaService) {}

  private projectDir(projectId: string): string {
    return join(DATA_ROOT, projectId, "evd");
  }

  private slidesPath(projectId: string): string {
    return join(this.projectDir(projectId), "slides.json");
  }

  private brandingPath(projectId: string): string {
    return join(this.projectDir(projectId), "branding.json");
  }

  private logoDir(projectId: string): string {
    return join(this.projectDir(projectId), "logo");
  }

  ensureDir(projectId: string): void {
    const dir = this.projectDir(projectId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  async saveSlides(projectId: string, slides: unknown): Promise<{ ok: boolean; path: string }> {
    this.ensureDir(projectId);
    const json = JSON.stringify(slides, null, 2);
    writeFileSync(this.slidesPath(projectId), json, "utf-8");
    this.logger.log(`EVD slides saved for project ${projectId}`);
    return { ok: true, path: this.slidesPath(projectId) };
  }

  loadSlides(projectId: string): unknown | null {
    const path = this.slidesPath(projectId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return null;
    }
  }

  async saveBranding(projectId: string, branding: unknown): Promise<{ ok: boolean }> {
    this.ensureDir(projectId);
    writeFileSync(this.brandingPath(projectId), JSON.stringify(branding, null, 2), "utf-8");
    this.logger.log(`EVD branding saved for project ${projectId}`);
    return { ok: true };
  }

  loadBranding(projectId: string): unknown | null {
    const path = this.brandingPath(projectId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return null;
    }
  }

  async saveLogo(projectId: string, file: Express.Multer.File): Promise<{ filename: string; path: string }> {
    this.ensureDir(projectId);
    const logoDirPath = this.logoDir(projectId);
    mkdirSync(logoDirPath, { recursive: true });

    const ext = file.originalname.split(".").pop() ?? "png";
    const filename = `logo.${ext}`;
    const dest = join(logoDirPath, filename);
    writeFileSync(dest, file.buffer);
    this.logger.log(`EVD logo saved for project ${projectId}: ${filename}`);
    return { filename, path: dest };
  }

  loadLogo(projectId: string): { buffer: Buffer; mime: string } | null {
    const logoDirPath = this.logoDir(projectId);
    if (!existsSync(logoDirPath)) return null;
    const files = readdirSync(logoDirPath);
    if (files.length === 0) return null;
    const file = files[0];
    const buffer = readFileSync(join(logoDirPath, file));
    const ext = file.split(".").pop()?.toLowerCase() ?? "png";
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      svg: "image/svg+xml",
      webp: "image/webp",
    };
    return { buffer, mime: mimeMap[ext] ?? "image/png" };
  }

  deleteAll(projectId: string): boolean {
    const dir = this.projectDir(projectId);
    if (!existsSync(dir)) return false;
    rmSync(dir, { recursive: true, force: true });
    this.logger.log(`EVD data deleted for project ${projectId}`);
    return true;
  }

  listFiles(projectId: string): string[] {
    const dir = this.projectDir(projectId);
    if (!existsSync(dir)) return [];
    const result: string[] = [];
    const walk = (prefix: string) => {
      for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(rel);
        } else {
          result.push(rel);
        }
      }
    };
    walk("");
    return result;
  }

  async saveExport(projectId: string, relativePath: string, buffer: Buffer): Promise<void> {
    const dir = join(this.projectDir(projectId), "exports");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, relativePath), buffer);
    this.logger.log(`EVD export saved: ${relativePath} for project ${projectId}`);
  }

  async saveAsset(projectId: string, relativePath: string, buffer: Buffer): Promise<void> {
    const dir = join(this.projectDir(projectId), "assets");
    const filePath = join(dir, relativePath);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, buffer);
  }

  loadExport(projectId: string, relativePath: string): Buffer | null {
    const filePath = join(this.projectDir(projectId), "exports", relativePath);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath);
  }

  async persistToDb(projectId: string, evdJson: unknown): Promise<void> {
    const content = JSON.stringify(evdJson);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { evdContent: content },
    });
  }

  async loadFromDb(projectId: string): Promise<unknown | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { evdContent: true },
    });
    if (!project?.evdContent) return null;
    try {
      return JSON.parse(project.evdContent);
    } catch {
      return null;
    }
  }
}
