import { Prisma } from "@theforge/database";
import type { PrismaService } from "../../prisma/prisma.service.js";

function isCacheFieldUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /wireframesPreviewCache|column.*does not exist|42703|42883/i.test(msg);
}

export async function readWireframesPreviewCacheRaw(
  prisma: PrismaService,
  projectId: string,
): Promise<unknown | null> {
  try {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      select: { wireframesPreviewCache: true },
    });
    return row?.wireframesPreviewCache ?? null;
  } catch (err) {
    if (!isCacheFieldUnavailable(err)) throw err;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ wireframesPreviewCache: unknown }>>(
      Prisma.sql`SELECT "wireframesPreviewCache" FROM "Project" WHERE id = CAST(${projectId} AS uuid) LIMIT 1`,
    );
    return rows[0]?.wireframesPreviewCache ?? null;
  } catch (err) {
    if (isCacheFieldUnavailable(err)) return null;
    throw err;
  }
}

export async function writeWireframesPreviewCacheRaw(
  prisma: PrismaService,
  projectId: string,
  payload: unknown | null,
): Promise<{ ok: boolean; error?: string }> {
  const data =
    payload == null
      ? { wireframesPreviewCache: Prisma.JsonNull }
      : { wireframesPreviewCache: payload as Prisma.InputJsonValue };

  try {
    await prisma.project.update({
      where: { id: projectId },
      data,
    });
    return { ok: true };
  } catch (err) {
    if (!isCacheFieldUnavailable(err)) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  try {
    if (payload == null) {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "Project" SET "wireframesPreviewCache" = NULL WHERE id = CAST(${projectId} AS uuid)`,
      );
    } else {
      const json = JSON.stringify(payload);
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "Project" SET "wireframesPreviewCache" = ${json}::jsonb WHERE id = CAST(${projectId} AS uuid)`,
      );
    }
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (isCacheFieldUnavailable(err)) {
      return { ok: false, error: "columna wireframesPreviewCache no disponible" };
    }
    return { ok: false, error };
  }
}
