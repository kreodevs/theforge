import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { getRequestUserId } from "../../common/request-user.store.js";

/** Campos con snapshot automático antes de sobrescribir. */
export const DOCUMENT_SNAPSHOT_FIELDS = [
  "dbgaContent",
  "specContent",
  "mddContent",
] as const;

export type DocumentSnapshotField = (typeof DOCUMENT_SNAPSHOT_FIELDS)[number];

export type DocumentSnapshotSource =
  | "patch"
  | "chat"
  | "restore"
  | "salvage"
  | "generation";

const MAX_SNAPSHOTS_PER_FIELD = 25;
const MIN_CONTENT_LENGTH_TO_SNAPSHOT = 400;

@Injectable()
export class DocumentSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  isSnapshotField(field: string): field is DocumentSnapshotField {
    return (DOCUMENT_SNAPSHOT_FIELDS as readonly string[]).includes(field);
  }

  /**
   * Guarda el contenido previo antes de un overwrite. Omite si no hay cambio material o el doc es muy corto.
   */
  async snapshotBeforeOverwrite(
    projectId: string,
    field: DocumentSnapshotField,
    previousContent: string | null | undefined,
    source: DocumentSnapshotSource,
  ): Promise<void> {
    const prev = (previousContent ?? "").trim();
    if (prev.length < MIN_CONTENT_LENGTH_TO_SNAPSHOT) return;

    const userId = getRequestUserId();
    await this.prisma.$transaction(async (tx) => {
      await tx.documentSnapshot.create({
        data: {
          projectId,
          userId,
          field,
          content: prev,
          contentLength: prev.length,
          source,
        },
      });

      const stale = await tx.documentSnapshot.findMany({
        where: { projectId, field },
        orderBy: { createdAt: "desc" },
        skip: MAX_SNAPSHOTS_PER_FIELD,
        select: { id: true },
      });
      if (stale.length > 0) {
        await tx.documentSnapshot.deleteMany({
          where: { id: { in: stale.map((s: { id: string }) => s.id) } },
        });
      }
    });
  }

  async listByProject(
    projectId: string,
    options?: { field?: string; limit?: number },
  ) {
    const limit = options?.limit ?? 20;
    const rows = await this.prisma.documentSnapshot.findMany({
      where: {
        projectId,
        ...(options?.field?.trim() ? { field: options.field.trim() } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        projectId: true,
        field: true,
        contentLength: true,
        source: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        content: true,
      },
    });

    return rows.map(({ content, ...meta }: { content: string; [key: string]: unknown }) => ({
      ...meta,
      preview: content.slice(0, 160).replace(/\s+/g, " ").trim(),
    }));
  }

  async getSnapshotContent(projectId: string, snapshotId: string) {
    const row = await this.prisma.documentSnapshot.findFirst({
      where: { id: snapshotId, projectId },
    });
    if (!row) {
      throw new NotFoundException("Snapshot no encontrado para este proyecto.");
    }
    return row;
  }
}
