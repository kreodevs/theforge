import { Prisma } from "@theforge/database";
import type { PrismaService } from "../../prisma/prisma.service.js";

function isCacheFieldUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /wireframesSketchesCache|column.*does not exist|42703|42883/i.test(msg);
}

/** Lectura de caché: Prisma tipado, fallback SQL raw. */
export async function readWireframesSketchesCacheRaw(
  prisma: PrismaService,
  projectId: string,
): Promise<unknown | null> {
  try {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      select: { wireframesSketchesCache: true },
    });
    return row?.wireframesSketchesCache ?? null;
  } catch (err) {
    if (!isCacheFieldUnavailable(err)) throw err;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ wireframesSketchesCache: unknown }>>(
      Prisma.sql`SELECT "wireframesSketchesCache" FROM "Project" WHERE id = CAST(${projectId} AS uuid) LIMIT 1`,
    );
    return rows[0]?.wireframesSketchesCache ?? null;
  } catch (err) {
    if (isCacheFieldUnavailable(err)) return null;
    throw err;
  }
}

/** Escritura de caché: Prisma tipado, fallback SQL raw. */
export async function writeWireframesSketchesCacheRaw(
  prisma: PrismaService,
  projectId: string,
  payload: unknown | null,
): Promise<{ ok: boolean; error?: string }> {
  const data =
    payload == null
      ? { wireframesSketchesCache: Prisma.JsonNull }
      : { wireframesSketchesCache: payload as Prisma.InputJsonValue };

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
        Prisma.sql`UPDATE "Project" SET "wireframesSketchesCache" = NULL WHERE id = CAST(${projectId} AS uuid)`,
      );
    } else {
      const json = JSON.stringify(payload);
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "Project" SET "wireframesSketchesCache" = ${json}::jsonb WHERE id = CAST(${projectId} AS uuid)`,
      );
    }
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (isCacheFieldUnavailable(err)) {
      return { ok: false, error: "columna wireframesSketchesCache no disponible" };
    }
    return { ok: false, error };
  }
}

export async function loadProjectWireframesRow(
  prisma: PrismaService,
  projectId: string,
): Promise<{ wireframesContent: string | null; userId: string; cache: unknown | null } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { wireframesContent: true, userId: true },
  });
  if (!project) return null;
  const cache = await readWireframesSketchesCacheRaw(prisma, projectId);
  return { wireframesContent: project.wireframesContent, userId: project.userId, cache };
}
