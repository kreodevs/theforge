import { Prisma } from "@theforge/database";
import type { PrismaService } from "../../prisma/prisma.service.js";
import { readWireframesPipelineCache } from "./utils/wireframes-pipeline-cache.util.js";

function isPipelineCacheFieldUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /wireframesPipelineCache|column.*does not exist|42703|42883/i.test(msg);
}

/** Lee wireframesPipelineCache con fallback SQL si la columna aún no existe en BD. */
export async function readWireframesPipelineCacheRaw(
  prisma: PrismaService,
  projectId: string,
): Promise<unknown | null> {
  try {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      select: { wireframesPipelineCache: true },
    });
    return row?.wireframesPipelineCache ?? null;
  } catch (err) {
    if (!isPipelineCacheFieldUnavailable(err)) throw err;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ wireframesPipelineCache: unknown }>>(
      Prisma.sql`SELECT "wireframesPipelineCache" FROM "Project" WHERE id = CAST(${projectId} AS uuid) LIMIT 1`,
    );
    return rows[0]?.wireframesPipelineCache ?? null;
  } catch (err) {
    if (isPipelineCacheFieldUnavailable(err)) return null;
    throw err;
  }
}

export async function loadWireframesPipelineCache(
  prisma: PrismaService,
  projectId: string,
) {
  const raw = await readWireframesPipelineCacheRaw(prisma, projectId);
  return readWireframesPipelineCache(raw);
}
